"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import { getAcademicConfig } from "@/lib/academicConfig";

const TUITION_PER_UNIT = 1304.8; // 18 units = 23,486.40 (matches DLSAU SERP rate)

const MISC_FEES_BASE = [
  { label: "Registration Fee", amount: 220.0 },
  { label: "Athletic", amount: 517.0 },
  { label: "Guidance/Counseling", amount: 434.5 },
  { label: "Audio Visual", amount: 434.5 },
  { label: "Medical/Dental Fee", amount: 434.5 },
  { label: "Internet fee", amount: 770.0 },
  { label: "Insurance", amount: 27.5 },
  { label: "Library Fee", amount: 847.0 },
  { label: "ID Picture/Validation(Old)", amount: 176.0 },
  { label: "Laboratory Fee", amount: 770.0 },
  { label: "Computer Lab Fee - App.", amount: 3828.0 },
  { label: "Computer Lab Fee-Core", amount: 1683.0 },
];

const TRUST_FEES_BASE = [
  { label: "CSC", amount: 175.0 },
  { label: "Development Fee", amount: 346.5 },
  { label: "SSC", amount: 85.0 },
  { label: "Sampisanan", amount: 100.0 },
  { label: "Student Loan", amount: 10.0 },
  { label: "Tinig", amount: 125.0 },
  { label: "Research & Publication Fee", amount: 236.5 },
  { label: "TED Parents Association", amount: 100.0 },
];

type PaymentChannel = "UPAY" | "AUB" | "BDO";

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  UPAY: "UPay Online",
  BDO: "BDO (Code 2048)",
  AUB: "AUB Bills Pay",
};

// Shown in the payment window so students know which number to enter
const CHANNEL_HELP: Record<PaymentChannel, string> = {
  UPAY: "Pay on the UPay portal, then copy the transaction number from the confirmation screen or email.",
  BDO: "Use Bills Payment with Institution Code 2048. The reference is the number on your confirmation or deposit slip.",
  AUB: "Pay under the biller DLSAU INC. (a Php 7.00 service charge applies). Use the reference number on your receipt.",
};

function getOrgFeeLabel(program: string): string {
  if (program.includes("Computer Science")) return "Jr Philippine Comp Society";
  if (program.includes("Accountancy")) return "Jr Philippine Inst of Accountants";
  if (program.includes("Marketing")) return "Jr Marketing Association";
  if (program.includes("Veterinary")) return "Veterinary Clinicians Club";
  return "Academic Organization Fee";
}

function getCollegeActivityLabel(program: string): string {
  if (program.includes("Computer Science")) return "CAST Activity";
  if (program.includes("Accountancy") || program.includes("Marketing")) return "CBMA Activity";
  if (program.includes("Veterinary")) return "CVM Activity";
  return "College Activity";
}

// Converts "Mon, Wed" + "07:30 AM - 09:00 AM" into compact SERP code "MW0730-0900"
function formatSerpSchedule(days?: string, time?: string): string {
  if (!days && !time) return "TBA";
  const dayMap: Record<string, string> = {
    Mon: "M",
    Tue: "T",
    Wed: "W",
    Thu: "TH",
    Fri: "F",
    Sat: "S",
    Sun: "SU",
  };
  const compactDays = (days || "")
    .split(",")
    .map((d) => d.trim())
    .map((d) => dayMap[d] || d.toUpperCase())
    .join("");

  const to24 = (part: string) => {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return part.replace(/[^0-9]/g, "");
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ap = m[3].toUpperCase();
    if (ap === "PM" && hh !== 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}${mm}`;
  };

  if (!time) return compactDays || "TBA";
  const parts = time.split("-");
  if (parts.length === 2) {
    return `${compactDays}${to24(parts[0])}-${to24(parts[1])}`;
  }
  return `${compactDays} ${time}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

// Turns a Firebase error into a sentence a student can act on
function describeError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("permission-denied")) {
    return "Your account isn't allowed to do this. Sign out, sign in again, and retry.";
  }
  if (code.includes("unauthenticated")) {
    return "Your session has expired. Please sign in again.";
  }
  if (
    code.includes("unavailable") ||
    code.includes("network") ||
    code.includes("deadline-exceeded") ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  ) {
    return "We couldn't reach the server. Check your internet connection and try again.";
  }
  if (code.includes("resource-exhausted")) {
    return "The system is busy right now. Please wait a minute and try again.";
  }
  return "Something went wrong on our end.";
}

/* ───────────── pop-up messages ───────────── */

type ToastType = "success" | "error" | "info" | "warning";
interface ToastData {
  id: number;
  type: ToastType;
  title: string;
  text?: string;
}

// How long each kind stays up. Errors stay longest, and every message pauses while hovered or focused.
const TOAST_MS: Record<ToastType, number> = { success: 7000, info: 6000, warning: 9000, error: 12000 };

const TOAST_STYLE: Record<ToastType, { border: string; bar: string; icon: string }> = {
  success: { border: "border-emerald-200 text-emerald-950", bar: "bg-emerald-700", icon: "text-emerald-700" },
  error: { border: "border-red-200 text-red-950", bar: "bg-red-600", icon: "text-red-600" },
  info: { border: "border-sky-200 text-sky-950", bar: "bg-sky-600", icon: "text-sky-600" },
  warning: { border: "border-amber-200 text-amber-950", bar: "bg-amber-500", icon: "text-amber-600" },
};

function ToastIcon({ type }: { type: ToastType }) {
  const common = { viewBox: "0 0 20 20", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true } as const;
  if (type === "success")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="8" />
        <path d="M6.5 10.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (type === "error")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="8" />
        <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" strokeLinecap="round" />
      </svg>
    );
  if (type === "warning")
    return (
      <svg {...common}>
        <path d="M10 3l8 14H2L10 3z" strokeLinejoin="round" />
        <path d="M10 8v4M10 14.5v.5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5M10 6v.5" strokeLinecap="round" />
    </svg>
  );
}

function Toast({
  toast,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: ToastData;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const s = TOAST_STYLE[toast.type];
  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[26rem] print:hidden">
      <div
        role={toast.type === "error" ? "alert" : "status"}
        onMouseEnter={onPause}
        onMouseLeave={onResume}
        onFocus={onPause}
        onBlur={onResume}
        className={`flex items-stretch border bg-white shadow-xl ${s.border}`}
      >
        <div className={`w-2 shrink-0 ${s.bar}`} />
        <div className="flex flex-1 items-start gap-3 px-4 py-3">
          <span className={`mt-0.5 shrink-0 ${s.icon}`}>
            <ToastIcon type={toast.type} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{toast.title}</p>
            {toast.text && <p className="mt-0.5 text-xs leading-relaxed text-zinc-700">{toast.text}</p>}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="-mr-1 shrink-0 px-1.5 text-lg leading-none text-zinc-500 hover:text-zinc-900"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EAFPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [studentMissing, setStudentMissing] = useState(false);

  const [student, setStudent] = useState<any | null>(null);
  const [enlistments, setEnlistments] = useState<any[]>([]);
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [currentTerm, setCurrentTerm] = useState("1st Trimester");

  // Payment & Assessment Controls
  const [paymentPlan, setPaymentPlan] = useState<"Installment4B" | "Full">("Installment4B");
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>("UPAY");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [printedTimestamp, setPrintedTimestamp] = useState("");

  // Pop-up message
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSeq = useRef(0);

  function clearToastTimer() {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
  }
  function startToastTimer(type: ToastType) {
    clearToastTimer();
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS[type]);
  }
  function dismissToast() {
    clearToastTimer();
    setToast(null);
  }
  function showToast(type: ToastType, title: string, text?: string) {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, type, title, text });
    startToastTimer(type);
  }
  useEffect(() => () => clearToastTimer(), []);

  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setPrintedTimestamp(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    );

    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole) {
      router.push("/");
      return;
    }
    setRole(storedRole);

    const unsub = onAuthStateChanged(auth, (user) => {
      const id = localStorage.getItem("mock_user_id") || (user?.email ? user.email.split("@")[0] : null);
      if (!id) {
        setIsLoading(false);
        setLoadError("We couldn't identify your account. Please sign out and sign in again.");
        return;
      }
      setUserId(id);
    });
    return () => unsub();
  }, [router]);

  const loadEAFData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const [config, stSnap, enlSnap, subSnap] = await Promise.all([
        getAcademicConfig(),
        getDoc(doc(db, "students", userId)),
        getDocs(query(collection(db, "enlistments"), where("userId", "==", userId))),
        getDocs(collection(db, "subjects")),
      ]);

      setSchoolYear(config.schoolYear);
      setCurrentTerm(config.currentTerm);

      if (stSnap.exists()) {
        const stData = stSnap.data();
        setStudent(stData);
        setStudentMissing(false);
        if (stData.eafPayment?.plan) setPaymentPlan(stData.eafPayment.plan);
      } else {
        setStudentMissing(true);
      }

      const subMap: Record<string, any> = {};
      subSnap.docs.forEach((d) => {
        const data = d.data();
        subMap[data.code || d.id] = data;
      });

      const activeTermEnlistments: any[] = [];
      const seen = new Set<string>();
      enlSnap.docs.forEach((d) => {
        const data = d.data();
        const docTerm = data.enrolledTerm || data.term || "1st Trimester";
        if (docTerm === config.currentTerm && data.code && !seen.has(data.code)) {
          seen.add(data.code);
          const liveSub = subMap[data.code] || {};
          activeTermEnlistments.push({
            ...data,
            title: liveSub.title || data.title || "",
            units: Number(liveSub.units ?? data.units ?? 3),
            days: liveSub.days || data.days || "",
            time: liveSub.time || data.time || "",
            room: liveSub.room || data.room || "TBA",
          });
        }
      });

      activeTermEnlistments.sort((a, b) => a.code.localeCompare(b.code));
      setEnlistments(activeTermEnlistments);
    } catch (err) {
      console.error("Failed to load EAF:", err);
      setLoadError(`We couldn't load your enrollment details. ${describeError(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadEAFData();
  }, [loadEAFData]);

  // Close the payment window with Escape
  useEffect(() => {
    if (!paymentModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isFinalizing) setPaymentModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paymentModalOpen, isFinalizing]);

  const programName = student?.program || student?.academic?.program || "BS Computer Science";
  const sectionCode = student?.section || student?.academic?.section || "BSCS1A";
  const courseCodeShort = sectionCode.replace(/[A-Z]$/, "") || "BSCS1";
  const yearLevel = student?.yearLevel || student?.academic?.yearLevel || "1st Year";
  const studentType = yearLevel === "1st Year" && currentTerm === "1st Trimester" ? "New" : "Old";

  const rawIdDigits = (userId || "2026-00-000001").replace(/-/g, "");
  const familyId =
    rawIdDigits.length >= 8 ? `${rawIdDigits.slice(0, 4)}${rawIdDigits.slice(-4)}` : rawIdDigits;

  const fullNameFormatted = useMemo(() => {
    const last = (student?.lastName || student?.personal?.lastName || "STUDENT").toUpperCase();
    const first = (student?.firstName || student?.personal?.firstName || "").toUpperCase();
    const mid = (student?.middleName || student?.personal?.middleName || "").trim();
    const midInitial = mid ? ` ${mid.charAt(0).toUpperCase()}.` : "";
    return `${last}, ${first}${midInitial}`;
  }, [student]);

  const totalUnits = useMemo(
    () => enlistments.reduce((sum, s) => sum + (Number(s.units) || 0), 0),
    [enlistments]
  );

  const isPaymentSubmitted = useMemo(() => {
    return (
      student?.eafPayment?.term === currentTerm &&
      student?.eafPayment?.schoolYear === schoolYear &&
      !!student?.eafPayment?.referenceNo
    );
  }, [student, currentTerm, schoolYear]);

  const isOfficiallyEnrolled = useMemo(() => {
    const verifiedByRegistrar =
      student?.eafPayment?.term === currentTerm &&
      student?.eafPayment?.schoolYear === schoolYear &&
      student?.eafPayment?.settled === true;
    const allMarkedEnrolled = enlistments.length > 0 && enlistments.every((s) => s.status === "Enrolled");
    return verifiedByRegistrar || allMarkedEnrolled;
  }, [student, enlistments, currentTerm, schoolYear]);

  const awaitingVerification = isPaymentSubmitted && !isOfficiallyEnrolled;

  // ───────── Live DLSAU Fee Assessment Computation ─────────
  const assessment = useMemo(() => {
    const basicTuition = +(totalUnits * TUITION_PER_UNIT).toFixed(2);
    const miscTotal = MISC_FEES_BASE.reduce((s, f) => s + f.amount, 0);

    const trustFees = [...TRUST_FEES_BASE, { label: getOrgFeeLabel(programName), amount: 150.0 }];
    const trustTotal = trustFees.reduce((s, f) => s + f.amount, 0);

    const installmentFee = paymentPlan === "Installment4B" ? 2007.53 : 0.0;
    const otherFees = [
      { label: "Student Activity", amount: 110.0 },
      { label: "Cultural Activities", amount: 88.33 },
      { label: getCollegeActivityLabel(programName), amount: 192.5 },
      { label: "Institutional Development Fee", amount: 3833.34 },
      { label: "Adviser's Fee", amount: 300.0 },
      ...(installmentFee > 0 ? [{ label: "Installment fee", amount: installmentFee }] : []),
      { label: "Aircon Fee", amount: 670.0 },
    ];
    const otherTotal = +otherFees.reduce((s, f) => s + f.amount, 0).toFixed(2);
    const surcharge = 0.0;
    const grandTotal = +(basicTuition + miscTotal + trustTotal + otherTotal + surcharge).toFixed(2);

    // 4-Payment Installment Schedule (Installment4B)
    const quarter = Math.floor((grandTotal / 4) * 100) / 100;
    const fourth = +(grandTotal - quarter * 3).toFixed(2);

    const paid1 = isOfficiallyEnrolled;
    const paidFull = isOfficiallyEnrolled && student?.eafPayment?.plan === "Full";

    const syStart = parseInt(schoolYear.split("-")[0] || "2026", 10);
    const syEnd = syStart + 1;

    // Generate dynamic due dates based on the active trimester
    const getDates = (term: string) => {
      if (term === "1st Trimester") {
        return [`${syStart}/09/12`, `${syStart}/09/30`, `${syStart}/10/31`, `${syStart}/11/30`];
      } else if (term === "2nd Trimester") {
        return [`${syEnd}/01/12`, `${syEnd}/01/30`, `${syEnd}/02/28`, `${syEnd}/03/30`];
      } else {
        return [`${syEnd}/05/12`, `${syEnd}/05/30`, `${syEnd}/06/30`, `${syEnd}/07/30`];
      }
    };
    const dates = getDates(currentTerm);

    const schedule =
      paymentPlan === "Full"
        ? [
            { dueDate: dates[0], desc: "Full Payment (1 of 1)", assessed: grandTotal, outstanding: paidFull || paid1 ? 0 : grandTotal },
          ]
        : [
            { dueDate: dates[0], desc: "Payment 1 of 4", assessed: quarter, outstanding: paid1 ? 0.0 : quarter },
            { dueDate: dates[1], desc: "Payment 2 of 4", assessed: quarter, outstanding: paidFull ? 0.0 : quarter },
            { dueDate: dates[2], desc: "Payment 3 of 4", assessed: quarter, outstanding: paidFull ? 0.0 : quarter },
            { dueDate: dates[3], desc: "Payment 4 of 4", assessed: fourth, outstanding: paidFull ? 0.0 : fourth },
          ];

    const totalOutstanding = +schedule.reduce((s, r) => s + r.outstanding, 0).toFixed(2);

    return {
      basicTuition,
      miscFees: MISC_FEES_BASE,
      miscTotal,
      trustFees,
      trustTotal,
      otherFees,
      otherTotal,
      surcharge,
      grandTotal,
      schedule,
      totalOutstanding,
      downpaymentRequired: paymentPlan === "Full" ? grandTotal : quarter,
    };
  }, [totalUnits, programName, paymentPlan, isOfficiallyEnrolled, student, schoolYear, currentTerm]);

  function openPaymentModal() {
    // If a reference was already submitted, start from it so the student can correct it
    setReferenceNo(awaitingVerification ? student?.eafPayment?.referenceNo ?? "" : "");
    if (awaitingVerification && student?.eafPayment?.channel) setPaymentChannel(student.eafPayment.channel);
    setReferenceError("");
    setPaymentModalOpen(true);
  }

  // Submit the payment reference for Registrar verification (status stays "Enlisted" until the Registrar approves)
  async function handleFinalizeAndPay(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) {
      showToast("error", "Can't submit yet", "We couldn't identify your account. Please sign out and sign in again.");
      return;
    }
    if (enlistments.length === 0) {
      showToast("warning", "No subjects to submit", "Add your subjects in the Subject Catalog first.");
      return;
    }

    const enteredRef = referenceNo.trim();
    if (enteredRef && enteredRef.length < 6) {
      setReferenceError("That looks too short. Reference numbers are usually 6 or more characters. Check your receipt.");
      return;
    }

    setIsFinalizing(true);
    try {
      const now = new Date().toISOString();
      const generated = !enteredRef;
      const txRef = enteredRef || `${paymentChannel}-${Date.now().toString().slice(-8)}`;
      const wasUpdate = awaitingVerification;

      const enlSnap = await getDocs(query(collection(db, "enlistments"), where("userId", "==", userId)));

      // One batch: either the subjects AND the payment are saved, or neither is
      const batch = writeBatch(db);
      enlSnap.docs.forEach((d) => {
        const dTerm = d.data().enrolledTerm || d.data().term || "1st Trimester";
        if (dTerm === currentTerm && d.data().status !== "Enrolled") {
          batch.update(d.ref, { status: "Enlisted", submittedAt: now });
        }
      });

      const eafPayment = {
        settled: false,
        status: "for_verification",
        plan: paymentPlan,
        channel: paymentChannel,
        referenceNo: txRef,
        amountPaid: assessment.downpaymentRequired,
        assessedTotal: assessment.grandTotal,
        term: currentTerm,
        schoolYear,
        paidAt: now,
      };
      batch.set(doc(db, "students", userId), { eafPayment, updatedAt: now }, { merge: true });
      await batch.commit();

      setStudent((prev: any) => ({ ...(prev || {}), eafPayment }));
      setPaymentModalOpen(false);

      showToast(
        "success",
        wasUpdate ? "Payment reference updated" : "Payment reference submitted",
        `${txRef} via ${CHANNEL_LABEL[paymentChannel]} for Php ${fmtMoney(assessment.downpaymentRequired)}. ` +
          `The Registrar will verify it, and your status stays "Enlisted" until then.` +
          (generated ? " You didn't enter a reference, so a placeholder was created. Keep your receipt in case the Registrar asks for it." : "")
      );
    } catch (error) {
      console.error("Error submitting EAF payment:", error);
      showToast(
        "error",
        "Couldn't submit your payment reference",
        `${describeError(error)} Nothing was saved, so it's safe to try again. If it keeps failing, contact the Registrar's Office.`
      );
    } finally {
      setIsFinalizing(false);
    }
  }

  if (!role || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div role="status" className="flex items-center gap-3 text-emerald-900 text-sm font-semibold">
          <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
          Generating Enrollment Assessment Form (EAF)...
        </div>
      </div>
    );
  }

  const pay = student?.eafPayment;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
      <div className="flex flex-col md:flex-row min-h-screen bg-[#F4F6F5] text-zinc-900 font-sans print:bg-white">
        {toast && (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
            onPause={clearToastTimer}
            onResume={() => startToastTimer(toast.type)}
          />
        )}

        {/* Hide Sidebar when Printing */}
        <div className="print:hidden">
          <Navbar />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="h-2 w-full bg-emerald-900 flex print:hidden">
            <div className="h-full w-32 bg-emerald-600" />
            <div className="h-full w-12 bg-emerald-400" />
          </div>

          <div className="mx-auto max-w-5xl p-4 sm:p-8 print:p-0 print:max-w-none">
            {/* Interactive Action Bar (Hidden on Print) */}
            <div className="mb-4 flex flex-col gap-4 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  <span>SERP • Official EAF</span>
                  <span>•</span>
                  <span>
                    {schoolYear} ({currentTerm})
                  </span>
                </div>
                <h1 className="mt-0.5 text-xl font-bold text-emerald-950">Enrollment Assessment Form &amp; Payment</h1>
                <p className="mt-0.5 max-w-xl text-xs text-zinc-600">
                  {isOfficiallyEnrolled
                    ? "Your study load is confirmed and your initial tuition payment is verified."
                    : awaitingVerification
                      ? "Your payment reference is with the Registrar. You'll be marked Enrolled once it's verified."
                      : "Check your fees below and pick a payment plan. Then pay through one of the channels at the bottom of the form, and submit your reference number here."}
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Payment Plan Toggle */}
                  <div className="inline-flex border border-zinc-300 bg-white" role="group" aria-label="Payment plan">
                    <button
                      type="button"
                      onClick={() => setPaymentPlan("Installment4B")}
                      aria-pressed={paymentPlan === "Installment4B"}
                      className={`px-3 py-2 text-xs font-bold transition-colors ${
                        paymentPlan === "Installment4B" ? "bg-emerald-900 text-white" : "text-zinc-700 hover:bg-emerald-50"
                      }`}
                    >
                      Installment (4 Payments)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentPlan("Full")}
                      aria-pressed={paymentPlan === "Full"}
                      className={`px-3 py-2 text-xs font-bold transition-colors ${
                        paymentPlan === "Full" ? "bg-emerald-900 text-white" : "text-zinc-700 hover:bg-emerald-50"
                      }`}
                    >
                      Full Payment
                    </button>
                  </div>

                  {!isOfficiallyEnrolled && enlistments.length > 0 && (
                    <button
                      type="button"
                      onClick={openPaymentModal}
                      className="border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
                    >
                      {awaitingVerification ? "Update payment reference →" : "Submit payment reference →"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="border border-emerald-800 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 hover:bg-emerald-50"
                  >
                    Print / Save PDF ⎙
                  </button>
                </div>

                {!isOfficiallyEnrolled && enlistments.length > 0 && (
                  <p className="text-xs text-zinc-600">
                    Due to enroll:{" "}
                    <strong className="font-mono text-emerald-950">Php {fmtMoney(assessment.downpaymentRequired)}</strong>{" "}
                    ({paymentPlan === "Full" ? "full payment" : "payment 1 of 4"})
                  </p>
                )}
              </div>
            </div>

            {/* Status banners (stay on screen, unlike pop-ups) */}
            {loadError && (
              <div role="alert" className="mb-4 flex flex-col gap-3 border border-red-200 border-l-4 border-l-red-600 bg-white px-5 py-4 text-red-950 shadow-xs sm:flex-row sm:items-center sm:justify-between print:hidden">
                <p className="text-sm font-semibold">{loadError}</p>
                <button
                  type="button"
                  onClick={loadEAFData}
                  className="shrink-0 border border-red-700 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-800 hover:bg-red-50"
                >
                  Try again
                </button>
              </div>
            )}

            {studentMissing && !loadError && (
              <div role="status" className="mb-4 border border-amber-200 border-l-4 border-l-amber-500 bg-white px-5 py-4 text-amber-950 shadow-xs print:hidden">
                <p className="text-sm font-bold">We couldn&apos;t find your student record</p>
                <p className="mt-0.5 text-xs text-zinc-700">
                  Your name and program below are placeholders. Please contact the Registrar&apos;s Office before paying, so your record can be fixed.
                </p>
              </div>
            )}

            {awaitingVerification && pay && (
              <div role="status" className="mb-4 border border-sky-200 border-l-4 border-l-sky-600 bg-white px-5 py-4 text-sky-950 shadow-xs print:hidden">
                <p className="text-sm font-bold">Payment submitted. Waiting for Registrar verification.</p>
                <p className="mt-1 text-xs text-zinc-700">
                  Reference <span className="font-mono font-bold">{pay.referenceNo}</span> via {CHANNEL_LABEL[pay.channel as PaymentChannel] ?? pay.channel},
                  Php {fmtMoney(Number(pay.amountPaid || 0))}
                  {pay.paidAt ? `, submitted ${fmtDateTime(pay.paidAt)}` : ""}. Your status stays &quot;Enlisted&quot; until the Registrar confirms
                  it. If you entered the wrong reference, use &quot;Update payment reference&quot;.
                </p>
              </div>
            )}

            {enlistments.length === 0 ? (
              !loadError && (
                <div className="border border-emerald-900/15 bg-white p-12 text-center shadow-xs">
                  <p className="text-sm font-bold text-zinc-800">No Enlisted Courses Found for {currentTerm}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Add your subjects in the Subject Catalog first to generate your Enrollment Assessment Form.
                  </p>
                  <Link
                    href="/catalog"
                    className="mt-4 inline-flex border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
                  >
                    Go to Subject Catalog →
                  </Link>
                </div>
              )
            ) : (
              /* ───────── OFFICIAL DLSAU SERP EAF DOCUMENT SHEET ───────── */
              <div className="border border-zinc-400 bg-white p-6 sm:p-8 shadow-sm text-zinc-900 print:border-0 print:p-2 print:shadow-none">
                {/* Top Timestamp Strip */}
                <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-zinc-600">
                  <span>
                    {rawIdDigits}/{printedTimestamp}
                  </span>
                  <span>Enrollment Assessment Form (EAF)</span>
                </div>

                {/* University Header */}
                <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-4">
                  <div className="flex items-center gap-4">
                    <Image src="/logo/dlsau.png" alt="DLSAU Seal" width={56} height={56} className="h-14 w-14 object-contain" priority />
                    <div>
                      <h2 className="text-lg font-extrabold tracking-wide text-emerald-950 uppercase">
                        DE LA SALLE ARANETA UNIVERSITY
                      </h2>
                      <p className="text-xs font-semibold text-zinc-700">Salvador Araneta Campus, Victoneta Avenue, Malabon City</p>
                      <p className="text-[11px] text-zinc-600">Tel: 330-9128 &nbsp; Website: www.dlsau.edu.ph</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold uppercase tracking-wider text-zinc-900">Enrollment Assessment Form (EAF)</p>
                    <p className="mt-0.5 font-mono text-xs font-bold text-emerald-900">
                      {currentTerm.replace("Trimester", "Term")}, SY{schoolYear}
                    </p>
                  </div>
                </div>

                {/* Student Identity Bar */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-zinc-800 bg-zinc-50 px-3 py-2 text-xs">
                  <div className="font-bold">
                    <span className="text-zinc-500 font-normal mr-1">Name:</span>
                    <span className="font-mono text-sm">{fullNameFormatted}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-5 font-mono">
                    <span>
                      <strong>ID:</strong> {rawIdDigits}
                    </span>
                    <span>
                      <strong>Type:</strong> {studentType}
                    </span>
                    <span>
                      <strong>Family ID:</strong> {familyId}
                    </span>
                  </div>
                </div>

                {/* Enlisted Subjects Table */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse border border-zinc-800 text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-100 text-left font-bold">
                        <th className="border-r border-zinc-800 px-2.5 py-1.5">Subject</th>
                        <th className="border-r border-zinc-800 px-2.5 py-1.5">Description</th>
                        <th className="border-r border-zinc-800 px-2.5 py-1.5 text-center">Sec</th>
                        <th className="border-r border-zinc-800 px-2.5 py-1.5 text-right">Units</th>
                        <th className="border-r border-zinc-800 px-2.5 py-1.5 text-center">Schedule</th>
                        <th className="px-2.5 py-1.5 text-center">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-300 font-mono">
                      {enlistments.map((s) => (
                        <tr key={s.code}>
                          <td className="border-r border-zinc-800 px-2.5 py-1.5 font-bold">{s.code}</td>
                          <td className="border-r border-zinc-800 px-2.5 py-1.5 font-sans">{s.title}</td>
                          <td className="border-r border-zinc-800 px-2.5 py-1.5 text-center">{s.section || sectionCode}</td>
                          <td className="border-r border-zinc-800 px-2.5 py-1.5 text-right">{Number(s.units || 0).toFixed(2)}</td>
                          <td className="border-r border-zinc-800 px-2.5 py-1.5 text-center">{formatSerpSchedule(s.days, s.time)}</td>
                          <td className="px-2.5 py-1.5 text-center">{s.room || "TBA"}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-zinc-800 bg-zinc-50 font-bold">
                        <td colSpan={3} className="px-2.5 py-1.5 text-right">
                          Total Load:
                        </td>
                        <td className="border-r border-zinc-800 px-2.5 py-1.5 text-right">{totalUnits.toFixed(2)}</td>
                        <td colSpan={2} className="px-2.5 py-1.5 text-left">
                          unit(s)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Status & Disclaimer Row */}
                <div className="mt-3 grid grid-cols-1 gap-4 border-b border-zinc-800 pb-3 md:grid-cols-12 text-xs">
                  <div className="md:col-span-5 space-y-0.5">
                    <p className="font-bold">{student?.enrollmentStatus || "Regular"}</p>
                    <p className="font-bold">
                      Enrollment Status:{" "}
                      <span className={isOfficiallyEnrolled ? "text-emerald-800 underline" : "text-amber-700 underline"}>
                        {isOfficiallyEnrolled
                          ? "Enrolled"
                          : awaitingVerification
                            ? "Enlisted (Payment for verification)"
                            : "Enlisted (Unconfirmed)"}
                      </span>
                    </p>
                    <p className="font-mono font-bold">
                      Course: {courseCodeShort} &nbsp;|&nbsp; {currentTerm.replace("Trimester", "Term")}, SY{schoolYear}
                    </p>
                  </div>
                  <div className="md:col-span-7 text-[11px] leading-snug text-zinc-600 italic">
                    <strong>Note:</strong> The information is correct as of the printing date and time. This PEF/EAF does not
                    serve as proof of official enrollment unless Enrollment Status is marked <strong>Enrolled</strong> and
                    validated by the Cashier&apos;s Office.
                  </div>
                </div>

                {/* 2-Column Detailed Fee Assessment & Installment Schedule */}
                <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-12 text-xs">
                  {/* LEFT COLUMN: Itemized Assessment of Fees */}
                  <div className="md:col-span-6 border border-zinc-800 p-3 space-y-3">
                    <div className="border-b border-zinc-800 pb-1 font-bold uppercase tracking-wider">
                      Assessment of Fees ({paymentPlan})
                    </div>

                    {/* Basic Fees */}
                    <div>
                      <p className="font-bold text-zinc-800">Basic Fees</p>
                      <div className="flex justify-between pl-3 font-mono">
                        <span>Tuition Fee - Regular ({totalUnits}u)</span>
                        <span>{fmtMoney(assessment.basicTuition)}</span>
                      </div>
                      <div className="flex justify-end border-t border-zinc-300 font-mono font-bold">
                        <span>{fmtMoney(assessment.basicTuition)}</span>
                      </div>
                    </div>

                    {/* Miscellaneous Fees */}
                    <div>
                      <p className="font-bold text-zinc-800">Miscellaneous Fees</p>
                      {assessment.miscFees.map((f) => (
                        <div key={f.label} className="flex justify-between pl-3 font-mono text-[11px]">
                          <span className="font-sans">{f.label}</span>
                          <span>{fmtMoney(f.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-end border-t border-zinc-300 font-mono font-bold">
                        <span>{fmtMoney(assessment.miscTotal)}</span>
                      </div>
                    </div>

                    {/* Funds Held in Trust */}
                    <div>
                      <p className="font-bold text-zinc-800">Funds Held in Trust</p>
                      {assessment.trustFees.map((f) => (
                        <div key={f.label} className="flex justify-between pl-3 font-mono text-[11px]">
                          <span className="font-sans">{f.label}</span>
                          <span>{fmtMoney(f.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-end border-t border-zinc-300 font-mono font-bold">
                        <span>{fmtMoney(assessment.trustTotal)}</span>
                      </div>
                    </div>

                    {/* Other Fees */}
                    <div>
                      <p className="font-bold text-zinc-800">Other Fees</p>
                      {assessment.otherFees.map((f) => (
                        <div key={f.label} className="flex justify-between pl-3 font-mono text-[11px]">
                          <span className="font-sans">{f.label}</span>
                          <span>{fmtMoney(f.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-end border-t border-zinc-300 font-mono font-bold">
                        <span>{fmtMoney(assessment.otherTotal)}</span>
                      </div>
                    </div>

                    {/* Grand Total Line */}
                    <div className="flex justify-between border-t-2 border-zinc-800 pt-2 font-mono text-sm font-bold">
                      <span>Total Assessed:</span>
                      <span>Php {fmtMoney(assessment.grandTotal)}</span>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Summary & Payment Schedule */}
                  <div className="md:col-span-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      {/* Summary Box */}
                      <div className="border border-zinc-800 p-3 space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="font-sans">Basic Fees</span>
                          <span>{fmtMoney(assessment.basicTuition)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans">Miscellaneous Fees</span>
                          <span>{fmtMoney(assessment.miscTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans">Funds Held in Trust</span>
                          <span>{fmtMoney(assessment.trustTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans">Other Fees</span>
                          <span>{fmtMoney(assessment.otherTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans">Surcharges</span>
                          <span>{fmtMoney(assessment.surcharge)}</span>
                        </div>
                        <div className="flex justify-between border-t border-zinc-800 pt-1 text-sm font-bold">
                          <span className="font-sans">Total:</span>
                          <span>{fmtMoney(assessment.grandTotal)}</span>
                        </div>
                      </div>

                      {/* Installment / Due Date Table */}
                      <div className="border border-zinc-800">
                        <table className="w-full border-collapse text-xs font-mono">
                          <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-100 font-sans font-bold">
                              <th className="border-r border-zinc-800 px-2 py-1.5 text-left">DueDate</th>
                              <th className="border-r border-zinc-800 px-2 py-1.5 text-left">Desc</th>
                              <th className="border-r border-zinc-800 px-2 py-1.5 text-right">Assessed</th>
                              <th className="px-2 py-1.5 text-right">Outstanding</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-300">
                            {assessment.schedule.map((row) => (
                              <tr key={row.desc}>
                                <td className="border-r border-zinc-800 px-2 py-1.5">{row.dueDate}</td>
                                <td className="border-r border-zinc-800 px-2 py-1.5 font-sans">{row.desc}</td>
                                <td className="border-r border-zinc-800 px-2 py-1.5 text-right">{fmtMoney(row.assessed)}</td>
                                <td
                                  className={`px-2 py-1.5 text-right font-bold ${
                                    row.outstanding === 0 ? "text-emerald-800" : "text-zinc-900"
                                  }`}
                                >
                                  {fmtMoney(row.outstanding)}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-zinc-800 bg-zinc-50 font-bold">
                              <td colSpan={2} className="border-r border-zinc-800 px-2 py-1.5 text-right font-sans">
                                Net Total:
                              </td>
                              <td className="border-r border-zinc-800 px-2 py-1.5 text-right">{fmtMoney(assessment.grandTotal)}</td>
                              <td className="px-2 py-1.5 text-right text-emerald-950">{fmtMoney(assessment.totalOutstanding)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Payment verified */}
                      {pay?.settled && (
                        <div className="border border-emerald-800 bg-emerald-50/60 p-3 text-xs">
                          <p className="font-bold uppercase tracking-wider text-emerald-950">✓ Official Payment Validated</p>
                          <p className="mt-1 font-mono text-[11px] text-emerald-900">
                            Ref: <strong>{pay.referenceNo}</strong> ({pay.channel}) • Paid Php{" "}
                            <strong>{fmtMoney(Number(pay.amountPaid || 0))}</strong>
                          </p>
                        </div>
                      )}

                      {/* Payment submitted, not yet verified */}
                      {awaitingVerification && pay && !pay.settled && (
                        <div className="border border-amber-700 bg-amber-50/60 p-3 text-xs">
                          <p className="font-bold uppercase tracking-wider text-amber-900">Payment submitted, awaiting verification</p>
                          <p className="mt-1 font-mono text-[11px] text-amber-900">
                            Ref: <strong>{pay.referenceNo}</strong> ({pay.channel}) • Php{" "}
                            <strong>{fmtMoney(Number(pay.amountPaid || 0))}</strong>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* DLSAU Official Payment Channels Box */}
                    <div className="border border-zinc-800 bg-zinc-50/70 p-3 text-[11px] leading-relaxed space-y-1.5">
                      <p className="font-bold uppercase text-zinc-900 border-b border-zinc-300 pb-1">
                        DLSAU TUITION FEE ONLINE / OTC BANK PAYMENT
                      </p>
                      <p>
                        <strong>Beneficiary:</strong> DE LA SALLE ARANETA UNIVERSITY INC.
                      </p>
                      <p>
                        <strong>1. Asia United Bank (AUB):</strong> Bills Payment Biller:{" "}
                        <span className="font-mono">DLSAU INC.</span> (+Php 7.00 service charge).
                      </p>
                      <p>
                        <strong>2. Banco de Oro (BDO):</strong> Bills Payment Institution Code:{" "}
                        <span className="font-mono font-bold">2048</span> | Current Acct:{" "}
                        <span className="font-mono">007-2400-86698</span>.
                      </p>
                      <p>
                        <strong>3. UPay Online Portal:</strong> Debit/Credit Card, UnionBank, InstaPay, or PCHC Bank Transfer.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-[10px] text-zinc-500 italic">
                  *Tuition and other school fees shall be subject to reassessment upon approval by the CHED of the pending
                  application for fee increase.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Submit payment reference */}
        {paymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-xs print:hidden">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pay-title"
              className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden border-2 border-emerald-900 bg-white shadow-2xl"
            >
              <div className="h-2 w-full bg-emerald-800 flex shrink-0">
                <div className="h-full w-24 bg-emerald-500" />
              </div>
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-emerald-900 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-1.5 bg-emerald-400" />
                  <div>
                    <h2 id="pay-title" className="text-base font-bold tracking-tight">
                      {awaitingVerification ? "Update payment reference" : "Submit payment reference"}
                    </h2>
                    <p className="text-xs text-emerald-200">
                      {schoolYear} • {currentTerm} ({paymentPlan === "Full" ? "Full payment" : "Installment"})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  disabled={isFinalizing}
                  className="border border-emerald-700 bg-emerald-800/60 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Close ✕
                </button>
              </div>

              <form onSubmit={handleFinalizeAndPay} className="space-y-5 overflow-y-auto p-6">
                <p className="text-xs leading-relaxed text-zinc-600">
                  Pay through your chosen channel first, then enter the reference number from your receipt. The Registrar
                  checks it before your status changes from Enlisted to Enrolled.
                </p>

                <div className="border border-emerald-900/15 border-l-4 border-l-emerald-700 bg-emerald-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Amount due to enroll</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-emerald-950">Php {fmtMoney(assessment.downpaymentRequired)}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {paymentPlan === "Full" ? "Full trimester assessment (100%)" : "Payment 1 of 4 (downpayment upon enrollment)"}
                  </p>
                </div>

                <fieldset className="space-y-2">
                  <legend className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Payment channel you used
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(CHANNEL_LABEL) as PaymentChannel[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPaymentChannel(id)}
                        aria-pressed={paymentChannel === id}
                        className={`border px-3 py-2.5 text-xs font-bold transition-all ${
                          paymentChannel === id
                            ? "border-emerald-900 border-l-4 border-l-emerald-400 bg-emerald-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700 hover:bg-emerald-50"
                        }`}
                      >
                        {CHANNEL_LABEL[id]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-600">{CHANNEL_HELP[paymentChannel]}</p>
                </fieldset>

                <div className="space-y-1.5">
                  <label htmlFor="referenceNo" className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Reference number
                  </label>
                  <input
                    id="referenceNo"
                    type="text"
                    value={referenceNo}
                    onChange={(e) => {
                      setReferenceNo(e.target.value);
                      setReferenceError("");
                    }}
                    placeholder="e.g. UPAY-2026-849201"
                    aria-invalid={!!referenceError}
                    aria-describedby="referenceNo-help"
                    className={`w-full border bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:ring-1 ${
                      referenceError
                        ? "border-red-500 focus:border-red-600 focus:ring-red-500"
                        : "border-zinc-300 focus:border-emerald-800 focus:ring-emerald-800"
                    }`}
                  />
                  {referenceError ? (
                    <p id="referenceNo-help" className="text-xs font-medium text-red-600">
                      {referenceError}
                    </p>
                  ) : (
                    <p id="referenceNo-help" className="text-xs text-zinc-500">
                      Strongly recommended. If you leave this blank we&apos;ll create a placeholder, and the Registrar may ask to see your receipt.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(false)}
                    disabled={isFinalizing}
                    className="border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFinalizing}
                    className="border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {isFinalizing ? "Submitting..." : awaitingVerification ? "Save updated reference" : "Submit payment reference"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}