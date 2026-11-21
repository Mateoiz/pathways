"use client";

// app/dashboard/page.tsx

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";
import Navbar from "@/components/Navbar";
import StudentProfile from "@/components/Studentprofile";
import { AcademicConfig, DEFAULT_ACADEMIC_CONFIG, getAcademicConfig } from "@/lib/academicConfig";

/* ───────── constants & types ───────── */

const REGISTRAR_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sections", href: "/sections" },
  { label: "Override requests", href: "/overrides" },
  { label: "Enrollment reports", href: "/reports" },
];

const CLEARANCE_GATES = [
  { key: "library", label: "University Library", office: "Learning Resource Center" },
  { key: "accounting", label: "Accounting Office", office: "Finance & Assessment" },
  { key: "clinic", label: "University Clinic", office: "Health Services" },
  { key: "disciplinary", label: "Discipline Office", office: "Student Formation" },
  { key: "registrar", label: "Office of the Registrar", office: "Records & Credentials" },
  { key: "guidance", label: "Guidance & Counseling", office: "Student Wellness" },
  { key: "laboratory", label: "Laboratory Custody", office: "Science & Tech Labs" },
  { key: "studentAffairs", label: "Student Affairs (OSFA)", office: "Org & Activities" },
];

type Role = "student" | "registrar" | "admin";
export type ClearanceStatus = "cleared" | "pending" | "blocked";

export interface ClearanceItem {
  key: string;
  label: string;
  office?: string;
  status: ClearanceStatus;
}

type Tone = "ok" | "warn" | "alert" | "info";

interface NextAction {
  tone: Tone;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  secondary?: { label: string; href: string };
}

const TONE_BORDER: Record<Tone, string> = {
  ok: "border-l-emerald-700",
  warn: "border-l-amber-500",
  alert: "border-l-red-600",
  info: "border-l-sky-600",
};

const primaryBtn =
  "inline-flex items-center bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800";
const secondaryBtn =
  "inline-flex items-center border border-emerald-900/20 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-50";

/* ───────── small components ───────── */

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-emerald-900/15 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-5 py-3">
        <h2 className="text-sm font-bold text-emerald-950">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function NextActionCard({ action }: { action: NextAction }) {
  const linkFor = (l: { label: string; href: string }, cls: string) =>
    l.href.startsWith("#") ? (
      <a href={l.href} className={cls}>
        {l.label}
      </a>
    ) : (
      <Link href={l.href} className={cls}>
        {l.label}
      </Link>
    );

  return (
    <section
      aria-label="Your next step"
      className={`flex flex-col gap-4 border border-emerald-900/15 border-l-4 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between ${TONE_BORDER[action.tone]}`}
    >
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-zinc-900">{action.title}</h2>
        <p className="mt-1 max-w-xl text-sm text-zinc-600">{action.body}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {action.cta && linkFor(action.cta, primaryBtn)}
        {action.secondary && linkFor(action.secondary, secondaryBtn)}
      </div>
    </section>
  );
}

/** Compact 3-step tracker: Clearances → Courses → Confirmation */
function ProgressTracker({ steps }: { steps: { label: string; done: boolean }[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="flex items-center border border-emerald-900/15 bg-white px-5 py-4" aria-label="Enrollment progress">
      {steps.map((s, i) => {
        const isCurrent = i === current;
        return (
          <li key={s.label} className="flex flex-1 items-center last:flex-none" aria-current={isCurrent ? "step" : undefined}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 text-xs font-bold ${
                s.done
                  ? "border-emerald-800 bg-emerald-800 text-white"
                  : isCurrent
                    ? "border-emerald-800 bg-white text-emerald-900"
                    : "border-zinc-300 bg-white text-zinc-400"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span
              className={`ml-2 text-xs font-semibold sm:text-sm ${
                s.done || isCurrent ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className={`mx-3 h-0.5 flex-1 ${s.done ? "bg-emerald-700" : "bg-zinc-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Only shows offices that still need attention. */
function ClearanceList({ items }: { items: ClearanceItem[] }) {
  const outstanding = items
    .filter((c) => c.status !== "cleared")
    .sort((a, b) => (a.status === "blocked" ? 0 : 1) - (b.status === "blocked" ? 0 : 1));

  return (
    <div id="clearances" className="scroll-mt-6">
      <Card title="Clearances needed" right={<span className="text-xs text-zinc-500">{outstanding.length} of {items.length} outstanding</span>}>
        <ul className="divide-y divide-zinc-200">
          {outstanding.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">{c.label}</p>
                <p className="truncate text-xs text-zinc-500">{c.office}</p>
              </div>
              <span
                className={`shrink-0 border px-2 py-0.5 text-xs font-semibold ${
                  c.status === "blocked"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                {c.status === "blocked" ? "On hold" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ───────── registrar sidebar ───────── */

function RegistrarSidebar({
  pathname,
  name,
  onLogout,
}: {
  pathname: string | null;
  name: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <aside className="sticky top-0 z-40 w-full shrink-0 border-b border-emerald-900/15 bg-white md:h-dvh md:w-56 md:border-b-0 md:border-r">
      <div className="flex h-full flex-col px-4 py-3 md:p-5">
        <div className="flex items-center justify-between md:mb-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/logo/dlsau.png" alt="DLSAU logo" width={36} height={36} className="h-9 w-9 object-contain" priority />
            <div>
              <span className="block font-bold leading-none text-emerald-950">PATHWAYS</span>
              <span className="text-xs text-emerald-700">Registrar</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center border border-emerald-900/20 text-emerald-950 md:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        <div className={`${open ? "flex" : "hidden"} mt-3 flex-1 flex-col justify-between md:mt-0 md:flex`}>
          <nav className="flex flex-col gap-1">
            {REGISTRAR_LINKS.map((item) => {
              const active = pathname === item.href || (pathname ?? "").startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm font-semibold ${
                    active ? "bg-emerald-900 text-white" : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-emerald-900/10 pt-4">
            <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
            <button
              onClick={onLogout}
              className="mt-2 w-full border border-emerald-900/20 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-900 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ───────── page ───────── */

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const [academicConfig, setAcademicConfig] = useState<AcademicConfig>(DEFAULT_ACADEMIC_CONFIG);
  const [studentDoc, setStudentDoc] = useState<any | null>(null);
  const [enlistments, setEnlistments] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Registrar queue
  const [regRecords, setRegRecords] = useState<any[]>([]);
  const [regFilter, setRegFilter] = useState<"All" | "Enlisted" | "Enrolled">("Enlisted");
  const [regSearch, setRegSearch] = useState("");
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);
  const [regToast, setRegToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showRegToast(type: "success" | "error", text: string) {
    setRegToast({ type, text });
    setTimeout(() => setRegToast(null), 4000);
  }

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role") as Role | null;
    if (!storedRole || storedRole === ("undefined" as any)) {
      localStorage.clear();
      router.push("/");
    } else {
      setRole(storedRole);
      setName(localStorage.getItem("mock_user_name"));
      setUserId(localStorage.getItem("mock_user_id"));
    }
  }, [router]);

  useEffect(() => {
    async function load() {
      if (!role) return;
      try {
        const config = await getAcademicConfig();
        setAcademicConfig(config);

        if (role === "student" && userId) {
          const [stSnap, enlSnap] = await Promise.all([
            getDoc(doc(db, "students", userId)),
            getDocs(query(collection(db, "enlistments"), where("userId", "==", userId))),
          ]);
          if (stSnap.exists()) setStudentDoc(stSnap.data());

          const byCode = new Map<string, any>();
          enlSnap.docs.forEach((d) => byCode.set(d.data().code, d.data()));
          setEnlistments(Array.from(byCode.values()));
        } else if (role === "registrar" || role === "admin") {
          const [studentsSnap, allEnlSnap] = await Promise.all([
            getDocs(collection(db, "students")),
            getDocs(collection(db, "enlistments")),
          ]);

          const enlByUser = new Map<string, any[]>();
          allEnlSnap.docs.forEach((d) => {
            const data = d.data();
            const dTerm = data.enrolledTerm || data.term || "1st Trimester";
            if (dTerm === config.currentTerm && data.userId) {
              const list = enlByUser.get(data.userId) || [];
              if (!list.some((item) => item.code === data.code)) {
                list.push({ docId: d.id, ...data });
                enlByUser.set(data.userId, list);
              }
            }
          });

          const rows: any[] = [];
          studentsSnap.docs.forEach((sDoc) => {
            const s = sDoc.data();
            const sid = s.studentId || sDoc.id;
            const userEnl = enlByUser.get(sid) || [];
            if (userEnl.length === 0) return;

            rows.push({
              studentId: sid,
              name: `${s.lastName || s.personal?.lastName || ""}, ${s.firstName || s.personal?.firstName || ""}`.trim(),
              program: s.program || s.academic?.program || "—",
              section: s.section || s.academic?.section || "—",
              courses: userEnl,
              units: userEnl.reduce((sum, item) => sum + (Number(item.units) || 0), 0),
              eafStatus: userEnl.every((item) => item.status === "Enrolled") ? "Enrolled" : "Enlisted",
              eafPayment: s.eafPayment || null,
            });
          });

          rows.sort((a, b) => a.studentId.localeCompare(b.studentId));
          setRegRecords(rows);
        }
      } catch (error) {
        console.error("Failed to load dashboard overview:", error);
      } finally {
        setIsLoadingData(false);
      }
    }
    load();
  }, [role, userId]);

  async function handleSetEAFStatus(targetStudentId: string, nextStatus: "Enrolled" | "Enlisted") {
    setProcessingStudentId(targetStudentId);
    try {
      const now = new Date().toISOString();
      const snap = await getDocs(query(collection(db, "enlistments"), where("userId", "==", targetStudentId)));

      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        const dTerm = d.data().enrolledTerm || d.data().term || "1st Trimester";
        if (dTerm === academicConfig.currentTerm) {
          batch.update(d.ref, {
            status: nextStatus,
            updatedAt: now,
            ...(nextStatus === "Enrolled" ? { confirmedAt: now, confirmedBy: name || "Registrar" } : {}),
          });
        }
      });
      await batch.commit();

      const targetRow = regRecords.find((r) => r.studentId === targetStudentId);
      const updatedPayment = {
        ...(targetRow?.eafPayment || {}),
        settled: nextStatus === "Enrolled",
        status: nextStatus === "Enrolled" ? "verified" : "for_verification",
        term: academicConfig.currentTerm,
        schoolYear: academicConfig.schoolYear,
        verifiedBy: name || "Registrar",
        verifiedAt: now,
      };
      await setDoc(doc(db, "students", targetStudentId), { eafPayment: updatedPayment, updatedAt: now }, { merge: true });

      setRegRecords((prev) =>
        prev.map((r) =>
          r.studentId === targetStudentId
            ? {
                ...r,
                eafStatus: nextStatus,
                eafPayment: updatedPayment,
                courses: r.courses.map((c: any) => ({ ...c, status: nextStatus })),
              }
            : r,
        ),
      );
      showRegToast("success", `${targetStudentId} is now ${nextStatus.toLowerCase()}.`);
    } catch (error) {
      console.error("Failed to update EAF status:", error);
      showRegToast("error", "Couldn't update the EAF status. Please try again.");
    } finally {
      setProcessingStudentId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    localStorage.removeItem("mock_user_id");
    auth.signOut();
    router.push("/");
  }

  if (!role || isLoadingData)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white text-sm font-semibold text-emerald-900">
        Loading your records...
      </div>
    );

  /* ───────── derived: student ───────── */

  const clearancesMap = studentDoc?.clearances || {};
  const clearanceList: ClearanceItem[] = CLEARANCE_GATES.map((g) => {
    const raw = String(clearancesMap[g.key] || "pending").toLowerCase();
    const status: ClearanceStatus =
      raw === "cleared" ? "cleared" : raw === "blocked" || raw === "hold" ? "blocked" : "pending";
    return { ...g, status };
  });

  const outstandingCount = clearanceList.filter((c) => c.status !== "cleared").length;
  const blockedCount = clearanceList.filter((c) => c.status === "blocked").length;
  const allCleared = outstandingCount === 0;

  const maxUnits = studentDoc?.maxUnits ?? studentDoc?.academic?.maxUnits ?? academicConfig.maxUnitsDefault;
  const totalUnits = enlistments.reduce((sum, s) => sum + (s.units || 0), 0);
  const hasCourses = enlistments.length > 0;
  const isConfirmed = hasCourses && enlistments.every((s) => s.status === "Enrolled" || s.source === "block");
  const overloaded = totalUnits > maxUnits;

  const programCode = studentDoc?.program || studentDoc?.academic?.program || "BSCS";
  const yearLevel = studentDoc?.yearLevel || studentDoc?.academic?.yearLevel || "1st Year";
  const sectionCode = studentDoc?.academic?.section || studentDoc?.section || "Unassigned";

  function getNextAction(): NextAction {
    if (blockedCount > 0)
      return {
        tone: "alert",
        title: `Clear ${blockedCount} hold${blockedCount > 1 ? "s" : ""} on your record`,
        body: "Holds block enlistment. Visit the office concerned and your status will update here.",
        cta: { label: "See holds", href: "#clearances" },
      };
    if (!allCleared)
      return {
        tone: "warn",
        title: `Waiting on ${outstandingCount} office${outstandingCount > 1 ? "s" : ""}`,
        body: "Enlistment opens once every office clears your record. Nothing else is needed from you.",
        cta: { label: "See offices", href: "#clearances" },
      };
    if (isConfirmed)
      return {
        tone: "ok",
        title: "You're officially enrolled",
        body: `Your ${academicConfig.currentTerm} load is registered.`,
        cta: { label: "View EAF", href: "/eaf" },
        secondary: { label: "View timetable", href: "/schedule" },
      };
    if (hasCourses)
      return {
        tone: "info",
        title: "Pay and confirm your EAF",
        body: "Your slots are only guaranteed after the Registrar confirms your EAF.",
        cta: { label: "Open EAF", href: "/eaf" },
        secondary: { label: "Change courses", href: "/catalog" },
      };
    if (!academicConfig.enrollmentOpen)
      return {
        tone: "warn",
        title: "Enlistment is closed",
        body: "You're cleared. You can browse the catalog until enlistment opens.",
        cta: { label: "Browse catalog", href: "/catalog" },
      };
    return {
      tone: "ok",
      title: "Enlist your courses",
      body: `You're cleared for ${academicConfig.currentTerm}. Pick courses up to ${maxUnits} units.`,
      cta: { label: "Open catalog", href: "/catalog" },
    };
  }

  /* ───────── derived: registrar ───────── */

  const hasRef = (r: any) => !!r.eafPayment?.referenceNo;
  const enlistedRows = regRecords.filter((r) => r.eafStatus === "Enlisted");
  const readyToVerify = enlistedRows.filter(hasRef).length;
  const tabCount = {
    All: regRecords.length,
    Enlisted: enlistedRows.length,
    Enrolled: regRecords.length - enlistedRows.length,
  };

  const q = regSearch.trim().toLowerCase();
  const rank = (r: any) => (r.eafStatus === "Enlisted" ? (hasRef(r) ? 0 : 1) : 2);
  const filteredRows = regRecords
    .filter((r) => {
      const matchesTab = regFilter === "All" || r.eafStatus === regFilter;
      const matchesSearch =
        !q ||
        r.studentId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q) ||
        (r.eafPayment?.referenceNo || "").toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => rank(a) - rank(b) || a.studentId.localeCompare(b.studentId));

  const isStaff = role === "registrar" || role === "admin";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#F4F6F5] text-zinc-900 md:flex-row">
      {role === "admin" ? (
        <AdminNavbar />
      ) : role === "student" ? (
        <Navbar />
      ) : (
        <RegistrarSidebar pathname={pathname} name={name} onLogout={handleLogout} />
      )}

      <main className="min-w-0 flex-1 border-t-4 border-t-emerald-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-8">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-emerald-950">{name || "University User"}</h1>
              <p className="mt-1 text-sm text-zinc-600">
                {role === "student" ? (
                  <>
                    <span className="font-mono">{userId || "—"}</span> • {programCode} • {yearLevel}, {sectionCode}
                  </>
                ) : role === "registrar" ? (
                  "Registrar"
                ) : (
                  "Administrator"
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="border border-zinc-300 bg-white px-2.5 py-1 font-semibold text-zinc-700">
                {academicConfig.currentTerm}, AY {academicConfig.schoolYear}
              </span>
              <span
                className={`border px-2.5 py-1 font-semibold ${
                  academicConfig.enrollmentOpen
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-zinc-300 bg-zinc-100 text-zinc-600"
                }`}
              >
                Enlistment {academicConfig.enrollmentOpen ? "open" : "closed"}
              </span>
              {role === "student" && (
                <button onClick={() => setShowProfile((v) => !v)} className={secondaryBtn}>
                  {showProfile ? "Back to dashboard" : "My profile"}
                </button>
              )}
            </div>
          </header>

          {/* Student */}
          {role === "student" && showProfile && userId && <StudentProfile userId={userId} />}

          {role === "student" && !showProfile && (
            <>
              <NextActionCard action={getNextAction()} />

              <ProgressTracker
                steps={[
                  { label: "Clearances", done: allCleared },
                  { label: "Courses", done: hasCourses },
                  { label: "Confirmation", done: isConfirmed },
                ]}
              />

              {!allCleared && <ClearanceList items={clearanceList} />}

              <Card
                title="Study load"
                right={
                  <span className={`text-xs font-semibold ${overloaded ? "text-red-700" : "text-zinc-500"}`}>
                    {totalUnits} of {maxUnits} units{overloaded ? " (over limit, needs Dean approval)" : ""}
                  </span>
                }
              >
                {!hasCourses ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-zinc-700">No courses enlisted yet.</p>
                    {allCleared && academicConfig.enrollmentOpen && (
                      <Link href="/catalog" className={`${primaryBtn} mt-4`}>
                        Open catalog
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                          <th className="py-2.5 pl-5 pr-3 font-semibold">Code</th>
                          <th className="px-3 py-2.5 font-semibold">Title</th>
                          <th className="px-3 py-2.5 font-semibold">Section</th>
                          <th className="px-3 py-2.5 text-center font-semibold">Units</th>
                          <th className="py-2.5 pl-3 pr-5 text-right font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {enlistments.map((subj) => {
                          const enrolled = subj.status === "Enrolled" || subj.source === "block";
                          return (
                            <tr key={subj.code}>
                              <td className="whitespace-nowrap py-3 pl-5 pr-3 font-mono font-bold text-emerald-950">{subj.code}</td>
                              <td className="min-w-[160px] px-3 py-3 text-zinc-800">{subj.title || "Course offering"}</td>
                              <td className="whitespace-nowrap px-3 py-3 font-mono text-zinc-600">{subj.section || sectionCode}</td>
                              <td className="px-3 py-3 text-center font-mono font-bold">{subj.units || 0}</td>
                              <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right">
                                <span
                                  className={`border px-2 py-0.5 text-xs font-semibold ${
                                    enrolled
                                      ? "border-emerald-900 bg-emerald-900 text-white"
                                      : "border-sky-300 bg-sky-50 text-sky-900"
                                  }`}
                                >
                                  {enrolled ? "Enrolled" : "Enlisted"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <p className="text-xs text-zinc-500">
                Prerequisite overrides and overloads need Registrar approval. Questions?{" "}
                <a href="mailto:registrar@dlsau.edu.ph" className="font-semibold text-emerald-900 underline">
                  registrar@dlsau.edu.ph
                </a>
              </p>
            </>
          )}

          {/* Registrar / Admin */}
          {isStaff && (
            <>
              {regToast && (
                <div className="fixed bottom-6 right-6 z-50" role="status" aria-live="polite">
                  <div
                    className={`flex items-stretch border bg-white shadow-lg ${
                      regToast.type === "error" ? "border-red-200 text-red-900" : "border-emerald-200 text-emerald-950"
                    }`}
                  >
                    <div className={`w-1.5 shrink-0 ${regToast.type === "error" ? "bg-red-600" : "bg-emerald-700"}`} />
                    <div className="px-4 py-3 text-sm font-semibold">{regToast.text}</div>
                  </div>
                </div>
              )}

              {role === "admin" && (
                <div className="flex flex-wrap gap-2">
                  <Link href="/admin/students" className={primaryBtn}>
                    Manage students
                  </Link>
                  <Link href="/applications" className={secondaryBtn}>
                    Review admissions
                  </Link>
                </div>
              )}

              <Card
                title="EAF verification"
                right={
                  <span className="text-xs text-zinc-500">
                    {readyToVerify} ready to verify • {enlistedRows.length - readyToVerify} awaiting payment
                  </span>
                }
              >
                <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex border border-zinc-300" role="group" aria-label="Filter by status">
                    {(["Enlisted", "Enrolled", "All"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setRegFilter(tab)}
                        aria-pressed={regFilter === tab}
                        className={`px-3.5 py-1.5 text-xs font-semibold ${
                          regFilter === tab ? "bg-emerald-900 text-white" : "text-zinc-700 hover:bg-emerald-50"
                        }`}
                      >
                        {tab} <span className="font-mono opacity-70">{tabCount[tab]}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    placeholder="Search ID, name, section, reference"
                    aria-label="Search the queue"
                    className="w-full border border-zinc-300 px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-emerald-800 focus:outline-none sm:w-72"
                  />
                </div>

                {filteredRows.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-zinc-500">
                    {regRecords.length === 0
                      ? `No students have enlisted for ${academicConfig.currentTerm} yet.`
                      : "No records match your filter."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                          <th className="px-5 py-2.5 font-semibold">Student</th>
                          <th className="px-5 py-2.5 font-semibold">Load</th>
                          <th className="px-5 py-2.5 font-semibold">Payment</th>
                          <th className="px-5 py-2.5 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {filteredRows.map((row) => {
                          const isBusy = processingStudentId === row.studentId;
                          const isEnrolled = row.eafStatus === "Enrolled";
                          return (
                            <tr key={row.studentId} className="hover:bg-emerald-50/40">
                              <td className="px-5 py-3">
                                <div className="font-semibold text-zinc-900">{row.name}</div>
                                <div className="font-mono text-xs text-zinc-500">
                                  {row.studentId} • {row.program} {row.section}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-xs">
                                <span className="font-mono font-bold text-emerald-950">{row.units} units</span>
                                <span className="block text-zinc-500">{row.courses.length} courses</span>
                              </td>
                              <td className="px-5 py-3 text-xs">
                                {hasRef(row) ? (
                                  <>
                                    <span className="font-mono font-bold text-emerald-950">{row.eafPayment.referenceNo}</span>
                                    <span className="block text-zinc-500">{row.eafPayment.channel}</span>
                                  </>
                                ) : (
                                  <span className="font-medium text-amber-700">No reference yet</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {isEnrolled ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleSetEAFStatus(row.studentId, "Enlisted")}
                                    className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    {isBusy ? "Updating..." : "Revert"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleSetEAFStatus(row.studentId, "Enrolled")}
                                    className="bg-emerald-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                                  >
                                    {isBusy ? "Approving..." : "Approve"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}