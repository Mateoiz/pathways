"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";
import Navbar from "@/components/Navbar";
import StudentProfile from "@/components/Studentprofile";
import {
  AcademicConfig,
  DEFAULT_ACADEMIC_CONFIG,
  getAcademicConfig,
} from "@/lib/academicConfig";

const REGISTRAR_LINKS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "Sections",
    href: "/sections",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
  },
  {
    label: "Override Requests",
    href: "/overrides",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    label: "Enrollment Reports",
    href: "/reports",
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
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

type StepState = "done" | "current" | "blocked" | "closed" | "locked";

interface Step {
  id: string;
  title: string;
  state: StepState;
  summary: string;
  body?: React.ReactNode;
}

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M4 10.5l4 4 8-9" />
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4.5" y="9" width="11" height="8" />
    <path d="M7 9V6.5a3 3 0 016 0V9" />
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M10 4v7M10 14.5v.5" />
  </svg>
);

const MARKER: Record<StepState, string> = {
  done: "bg-emerald-800 text-white border-emerald-800",
  current: "bg-white text-emerald-900 border-emerald-800 ring-4 ring-emerald-100",
  blocked: "bg-red-600 text-white border-red-600",
  closed: "bg-zinc-100 text-zinc-600 border-zinc-400",
  locked: "bg-zinc-100 text-zinc-400 border-zinc-300",
};

const STATE_LABEL: Record<StepState, string> = {
  done: "Completed",
  current: "Current Step",
  blocked: "Hold / Action Needed",
  closed: "Enrollment Closed",
  locked: "Locked",
};

const STATE_LABEL_STYLE: Record<StepState, string> = {
  done: "text-emerald-800 bg-emerald-50 border-emerald-200",
  current: "text-emerald-900 bg-emerald-100/80 border-emerald-300",
  blocked: "text-red-800 bg-red-50 border-red-300",
  closed: "text-zinc-600 bg-zinc-100 border-zinc-300",
  locked: "text-zinc-400 bg-zinc-50 border-zinc-200",
};

function StatusBadge({ status }: { status: ClearanceStatus }) {
  const styles: Record<ClearanceStatus, string> = {
    cleared: "border-emerald-300 bg-emerald-50 text-emerald-900",
    pending: "border-amber-300 bg-amber-50 text-amber-900",
    blocked: "border-red-300 bg-red-50 text-red-900",
  };
  const dots: Record<ClearanceStatus, string> = {
    cleared: "bg-emerald-700",
    pending: "bg-amber-600",
    blocked: "bg-red-600",
  };
  const labels: Record<ClearanceStatus, string> = {
    cleared: "Cleared",
    pending: "Pending",
    blocked: "On Hold",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}

function SectionHeader({
  title,
  subtitle,
  rightContent,
}: {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/70 px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className="h-4 w-1.5 bg-emerald-800" />
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
            {title}
          </h2>
          {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {rightContent}
    </div>
  );
}

function EnrollmentStepper({
  enrollmentOpen,
  clearances,
  subjectCount,
  totalUnits,
  maxUnits,
  isConfirmed,
}: {
  enrollmentOpen: boolean;
  clearances: ClearanceItem[];
  subjectCount: number;
  totalUnits: number;
  maxUnits: number;
  isConfirmed: boolean;
}) {
  const cleared = clearances.filter((c) => c.status === "cleared");
  const blocked = clearances.filter((c) => c.status === "blocked");
  const allCleared = cleared.length === clearances.length;
  const hasSubjects = subjectCount > 0;

  const doneFlags = [true, allCleared, hasSubjects, isConfirmed];
  const currentIndex = doneFlags.findIndex((d) => !d);

  function stateFor(index: number): StepState {
    if (doneFlags[index]) return "done";
    if (index !== currentIndex) return "locked";
    if (index === 1 && blocked.length > 0) return "blocked";
    if (index >= 2 && !enrollmentOpen) return "closed";
    return "current";
  }

  const steps: Step[] = [
    {
      id: "profile",
      title: "1. Verify Student Profile & Academic Standing",
      state: stateFor(0),
      summary: "Signed in and active. Program, curriculum code, and term eligibility verified.",
    },
    {
      id: "clearance",
      title: "2. Settle Institutional & Department Clearances",
      state: stateFor(1),
      summary: allCleared
        ? `All ${clearances.length} university offices cleared for enrollment`
        : `${cleared.length} of ${clearances.length} offices cleared`,
      body: (
        <div>
          <p className="text-sm text-zinc-700">
            {blocked.length > 0
              ? `${blocked.length} office${
                  blocked.length > 1 ? "s have" : " has"
                } placed an accountability hold on your record. Coordinate with the concerned office to lift the hold.`
              : `You have ${clearances.length - cleared.length} pending office clearance${
                  clearances.length - cleared.length === 1 ? "" : "s"
                }. Subject enlistment unlocks automatically once all offices mark your record Cleared.`}
          </p>
          <ul className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {clearances.map((c) => (
              <li
                key={c.key}
                className={`flex items-center justify-between gap-3 border border-l-4 px-3 py-2 text-xs ${
                  c.status === "cleared"
                    ? "border-zinc-200 border-l-emerald-700 bg-white text-zinc-700"
                    : c.status === "blocked"
                      ? "border-red-200 border-l-red-600 bg-red-50/70 font-semibold text-red-900"
                      : "border-amber-200 border-l-amber-500 bg-amber-50/50 text-amber-900"
                }`}
              >
                <span className="font-semibold truncate">{c.label}</span>
                <span className="font-mono text-[11px] font-bold uppercase shrink-0">
                  {c.status === "cleared" ? "Cleared" : c.status === "blocked" ? "Hold" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "subjects",
      title: "3. Course Enlistment & Section Selection",
      state: stateFor(2),
      summary: hasSubjects
        ? `${subjectCount} course${subjectCount === 1 ? "" : "s"} enlisted (${totalUnits} of ${maxUnits} max units)`
        : "Unlocks automatically once all 8 department clearances are satisfied.",
      body: (
        <div>
          <p className="text-sm text-zinc-700">
            Select your courses and sections from the Trimester Offerings Catalog. Your maximum allowable load for this term is{" "}
            <strong className="font-mono text-emerald-950">{maxUnits} units</strong>.
          </p>
          <Link
            href="/catalog"
            className="mt-3.5 inline-flex items-center gap-2 border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
          >
            Open Subject Catalog →
          </Link>
        </div>
      ),
    },
    {
      id: "confirm",
      title: "4. Schedule Confirmation & EAF Generation",
      state: stateFor(3),
      summary: isConfirmed
        ? "Officially enrolled. Your Enrollment Assessment Form (EAF) and timetable are active."
        : "Unlocks after adding at least one course to your study load.",
      body: (
        <div>
          <p className="text-sm text-zinc-700">
            Review your <strong className="font-mono">{subjectCount}</strong> enlisted course
            {subjectCount === 1 ? "" : "s"} (<strong className="font-mono">{totalUnits} units</strong>) and finalize your confirmation to lock in your slots.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
            >
              Review &amp; Confirm Load →
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center gap-2 border border-emerald-900/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 hover:bg-emerald-50"
            >
              Preview Timetable
            </Link>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section aria-label="Enrollment progress" className="border border-emerald-900/15 bg-white shadow-xs">
      <SectionHeader
        title="Online Enrollment Workflow"
        subtitle="Complete each requirement in sequence to finalize your trimester load"
        rightContent={
          <span className="border border-emerald-900/15 bg-white px-2.5 py-1 font-mono text-xs font-bold text-emerald-950">
            {currentIndex === -1 ? "4 / 4 COMPLETE" : `STEP ${currentIndex + 1} OF ${steps.length}`}
          </span>
        }
      />

      {!enrollmentOpen && !isConfirmed && (
        <div
          role="status"
          className="flex items-center gap-2.5 border-b border-amber-200 bg-amber-50/70 px-5 py-3 text-xs font-medium text-amber-950"
        >
          <span className="h-2 w-2 shrink-0 bg-amber-600" />
          Online enlistment is currently closed. You may still monitor your department clearances and academic records.
        </div>
      )}

      <ol className="p-5 sm:p-6">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const expanded = step.state === "current" || step.state === "blocked";
          return (
            <li
              key={step.id}
              className="relative flex gap-4"
              aria-current={expanded ? "step" : undefined}
            >
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${
                    step.state === "done" ? "bg-emerald-700" : "bg-zinc-200"
                  }`}
                />
              )}

              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center border-2 text-xs font-bold ${MARKER[step.state]}`}
              >
                {step.state === "done" ? (
                  <CheckIcon />
                ) : step.state === "locked" || step.state === "closed" ? (
                  <LockIcon />
                ) : step.state === "blocked" ? (
                  <AlertIcon />
                ) : (
                  i + 1
                )}
              </span>

              <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-6"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    className={`text-sm font-bold ${
                      step.state === "locked" ? "text-zinc-400" : "text-zinc-900"
                    }`}
                  >
                    {step.title}
                  </h3>
                  <span
                    className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATE_LABEL_STYLE[step.state]}`}
                  >
                    {STATE_LABEL[step.state]}
                  </span>
                </div>

                {expanded ? (
                  <div className="mt-3 border border-emerald-900/15 border-l-4 border-l-emerald-700 bg-[#F8FAF9] p-4">
                    {step.body}
                  </div>
                ) : (
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      step.state === "locked" ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {step.summary}
                    {step.id === "subjects" && step.state === "done" && !isConfirmed && (
                      <>
                        {" · "}
                        <Link
                          href="/catalog"
                          className="font-bold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
                        >
                          Modify Enlistment
                        </Link>
                      </>
                    )}
                    {step.id === "confirm" && step.state === "done" && (
                      <>
                        {" · "}
                        <Link
                          href="/schedule"
                          className="font-bold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
                        >
                          View Official Schedule
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [regCollapsed, setRegCollapsed] = useState(false);
  const [regMobileOpen, setRegMobileOpen] = useState(false);

  // Live database states
  const [academicConfig, setAcademicConfig] = useState<AcademicConfig>(
    DEFAULT_ACADEMIC_CONFIG
  );
  const [studentDoc, setStudentDoc] = useState<any | null>(null);
  const [enlistments, setEnlistments] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role") as Role | null;
    const storedName = localStorage.getItem("mock_user_name");
    const storedId = localStorage.getItem("mock_user_id");

    if (!storedRole || storedRole === ("undefined" as any)) {
      localStorage.clear();
      router.push("/");
    } else {
      setRole(storedRole);
      setName(storedName);
      setUserId(storedId);
    }
  }, [router]);

  useEffect(() => {
    async function loadStudentOverview() {
      if (!role) return;
      try {
        const config = await getAcademicConfig();
        setAcademicConfig(config);

        if (role === "student" && userId) {
          const [stSnap, enlSnap] = await Promise.all([
            getDoc(doc(db, "students", userId)),
            getDocs(
              query(collection(db, "enlistments"), where("userId", "==", userId))
            ),
          ]);

          if (stSnap.exists()) {
            setStudentDoc(stSnap.data());
          }
          const byCode = new Map<string, any>();
          enlSnap.docs.forEach((d) => {
            const data = d.data();
            byCode.set(data.code, data);
          });
          setEnlistments(Array.from(byCode.values()));
        }
      } catch (error) {
        console.error("Failed to load dashboard overview:", error);
      } finally {
        setIsLoadingData(false);
      }
    }
    loadStudentOverview();
  }, [role, userId]);

  function handleLogout() {
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    localStorage.removeItem("mock_user_id");
    auth.signOut();
    router.push("/");
  }

  if (!role || isLoadingData)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-emerald-900 text-sm font-semibold">
          <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
          <svg
            className="animate-spin h-5 w-5 text-emerald-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          Loading portal records...
        </div>
      </div>
    );

  // Compute live clearance & enrollment progress for students (supports cleared, pending, blocked)
  const clearancesMap = studentDoc?.clearances || {};
  const clearanceList: ClearanceItem[] = CLEARANCE_GATES.map((g) => {
    const raw = String(clearancesMap[g.key] || "pending").toLowerCase();
    const status: ClearanceStatus =
      raw === "cleared" ? "cleared" : raw === "blocked" || raw === "hold" ? "blocked" : "pending";
    return {
      ...g,
      status,
    };
  });

  const allCleared = clearanceList.every((c) => c.status === "cleared");
  const blockedCount = clearanceList.filter((c) => c.status === "blocked").length;
  const pendingCount = clearanceList.filter((c) => c.status !== "cleared").length;

  const maxUnits =
    studentDoc?.maxUnits ??
    studentDoc?.academic?.maxUnits ??
    academicConfig.maxUnitsDefault;
  const totalUnits = enlistments.reduce((sum, s) => sum + (s.units || 0), 0);
  const hasAddedSubjects = enlistments.length > 0;
  const isConfirmed =
    enlistments.length > 0 &&
    enlistments.every((s) => s.status === "Enrolled" || s.source === "block");

  const programCode =
    studentDoc?.program || studentDoc?.academic?.program || "BSCS";
  const yearLevel =
    studentDoc?.yearLevel || studentDoc?.academic?.yearLevel || "1st Year";
  const sectionCode =
    studentDoc?.academic?.section || studentDoc?.section || "Unassigned";
  const studentStanding =
    studentDoc?.enrollmentStatus || studentDoc?.academic?.standing || "Regular";

  return (
    <div className="flex flex-col md:flex-row min-h-dvh w-full bg-[#F4F6F5] text-zinc-900 font-sans">
      {/* Sidebar */}
      {role === "admin" ? (
        <AdminNavbar />
      ) : role === "student" ? (
        <Navbar />
      ) : (
        <aside
          className={`sticky top-0 z-40 w-full md:h-dvh shrink-0 border-b md:border-b-0 md:border-r border-emerald-900/15 bg-white transition-[width] duration-200 ${
            regCollapsed ? "md:w-[72px]" : "md:w-64"
          }`}
        >
          <div
            className={`flex flex-col h-full px-4 py-3 ${
              regCollapsed ? "md:px-3 md:py-6" : "md:p-6"
            }`}
          >
            <div
              className={`flex items-center justify-between md:mb-8 md:pb-4 md:border-b md:border-emerald-900/10 ${
                regCollapsed ? "md:flex-col md:gap-3" : ""
              }`}
            >
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <Image
                  src="/logo/dlsau.png"
                  alt="DLSAU logo"
                  width={40}
                  height={40}
                  className="h-9 w-9 md:h-10 md:w-10 object-contain shrink-0"
                  priority
                />
                <div className={regCollapsed ? "md:hidden" : ""}>
                  <span className="block font-bold tracking-tight text-emerald-950 leading-none">
                    PATHWAYS
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                    DLSAU Portal
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRegMobileOpen((p) => !p)}
                  className="md:hidden flex h-9 w-9 items-center justify-center border border-emerald-900/20 text-emerald-950"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d={regMobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setRegCollapsed((p) => !p)}
                  title={regCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  className="hidden md:flex h-8 w-8 items-center justify-center border border-emerald-900/20 text-emerald-900 hover:bg-emerald-50"
                >
                  <svg
                    className={`h-4 w-4 transition-transform ${regCollapsed ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              className={`hidden md:flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 ${
                regCollapsed ? "md:hidden" : ""
              }`}
            >
              <span className="h-2.5 w-1 bg-emerald-700" />
              Registrar
            </div>

            <div
              className={`${
                regMobileOpen ? "flex" : "hidden"
              } md:flex flex-col flex-1 justify-between pt-3 pb-2 md:p-0 mt-3 md:mt-0 border-t md:border-t-0 border-emerald-900/10`}
            >
              <nav className="flex flex-col gap-1.5">
                {REGISTRAR_LINKS.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={regCollapsed ? item.label : undefined}
                      className={`relative flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold transition-all ${
                        regCollapsed ? "md:justify-center md:px-0" : ""
                      } ${
                        isActive
                          ? "bg-emerald-900 text-white shadow-xs"
                          : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-950"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400" />
                      )}
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className={regCollapsed ? "md:hidden" : ""}>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-emerald-900/10 pt-4 mt-4 md:pt-5 md:mt-6">
                {!regCollapsed && (
                  <div className="mb-4 border-l-2 border-emerald-700 pl-3">
                    <p className="text-sm font-bold text-zinc-900 truncate">{name}</p>
                    <p className="text-xs font-medium capitalize text-emerald-800">{role}</p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center border border-emerald-900/20 bg-emerald-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 transition-colors hover:bg-emerald-900 hover:text-white"
                >
                  {regCollapsed ? "Out" : "Sign Out"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0">
        {/* Classic Top LaSalle Green Ribbon */}
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        {/* Institutional Sub-Bar (Archer's Hub style) */}
        <div className="border-b border-emerald-900/10 bg-white px-4 py-2.5 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-zinc-600">
              <span className="font-bold uppercase tracking-wider text-emerald-900">
                Office of the University Registrar
              </span>
              <span className="text-zinc-300">|</span>
              <span>Academic Portal &amp; Online Enlistment System</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-zinc-600">
                AY <strong className="text-zinc-900">{academicConfig.schoolYear}</strong> •{" "}
                <strong className="text-zinc-900">{academicConfig.currentTerm}</strong>
              </span>
              <span
                className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  academicConfig.enrollmentOpen
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-zinc-300 bg-zinc-100 text-zinc-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 ${
                    academicConfig.enrollmentOpen ? "bg-emerald-600 animate-pulse" : "bg-zinc-500"
                  }`}
                />
                {academicConfig.enrollmentOpen ? "Enlistment Open" : "Enlistment Closed"}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl p-4 sm:p-8 lg:p-10">
          {/* Student Official Record Header Strip */}
          <header className="mb-6 border border-emerald-900/15 bg-white shadow-xs">
            <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 border-l-4 border-l-emerald-800 px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">
                  {role === "student"
                    ? "Official Student Record"
                    : role === "registrar"
                      ? "Registrar Operations Center"
                      : "System Administration"}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-emerald-950 md:text-3xl">
                  {name || "University User"}
                </h1>
                {role !== "student" && (
                  <p className="mt-1 text-xs text-zinc-500">
                    De La Salle Araneta University • Institutional Management Portal
                  </p>
                )}
              </div>

              {role === "student" && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setShowProfile((v) => !v)}
                    className="border border-emerald-900/20 bg-emerald-50/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 transition-colors hover:bg-emerald-900 hover:text-white"
                  >
                    {showProfile ? "← Return to Hub" : "Student Profile & Info"}
                  </button>
                  <Link
                    href={isConfirmed ? "/schedule" : "/catalog"}
                    className="border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-emerald-800"
                  >
                    {isConfirmed ? "View EAF / Schedule →" : "Course Enlistment →"}
                  </Link>
                </div>
              )}
            </div>

            {/* Key Student Metadata Strip (Archer's Hub Style) */}
            {role === "student" && (
              <div className="grid grid-cols-2 divide-y divide-zinc-200 bg-zinc-50/50 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0 lg:divide-x">
                <div className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    ID Number
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-zinc-900">
                    {userId || "—"}
                  </p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Degree Program
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-950 truncate">
                    {programCode}
                  </p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Year &amp; Section
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-zinc-900">
                    {yearLevel} • <span className="font-mono">{sectionCode}</span>
                  </p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Student Standing
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-zinc-900">
                    {studentStanding}
                  </p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Term Load
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-emerald-950">
                    {totalUnits} / {maxUnits} Units
                  </p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Registration Status
                  </p>
                  <p
                    className={`mt-0.5 text-xs font-bold uppercase tracking-wider ${
                      isConfirmed
                        ? "text-emerald-800"
                        : blockedCount > 0
                          ? "text-red-700"
                          : hasAddedSubjects
                            ? "text-sky-800"
                            : "text-amber-800"
                    }`}
                  >
                    {isConfirmed
                      ? "Officially Enrolled"
                      : blockedCount > 0
                        ? "On Hold"
                        : hasAddedSubjects
                          ? "Enlisted (Unconfirmed)"
                          : allCleared
                            ? "Cleared to Enlist"
                            : "Pending Clearance"}
                  </p>
                </div>
              </div>
            )}
          </header>

          {/* ---------- STUDENT (PROFILE VIEW) ---------- */}
          {role === "student" && showProfile && userId && (
            <StudentProfile userId={userId} />
          )}

          {/* ---------- STUDENT (ARCHER'S HUB OVERVIEW) ---------- */}
          {role === "student" && !showProfile && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left / Primary Column (8 cols) */}
              <div className="flex flex-col gap-6 lg:col-span-8">
                {/* 1. Interactive Enrollment Stepper */}
                <EnrollmentStepper
                  enrollmentOpen={academicConfig.enrollmentOpen}
                  clearances={clearanceList}
                  subjectCount={enlistments.length}
                  totalUnits={totalUnits}
                  maxUnits={maxUnits}
                  isConfirmed={isConfirmed}
                />

                {/* 2. Current Term Study Load / EAF Preview */}
                <section className="border border-emerald-900/15 bg-white shadow-xs">
                  <SectionHeader
                    title="Current Trimester Study Load (EAF Preview)"
                    subtitle={`${academicConfig.schoolYear} • ${academicConfig.currentTerm}`}
                    rightContent={
                      <span className="font-mono text-xs font-bold text-emerald-950">
                        Total: {totalUnits} / {maxUnits} Units
                      </span>
                    }
                  />

                  {enlistments.length === 0 ? (
                    <div className="px-6 py-10 text-center">
                      <p className="text-sm font-semibold text-zinc-700">
                        No courses enlisted for {academicConfig.currentTerm} yet.
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Once your department clearances are complete, proceed to the Subjects tab to build your schedule.
                      </p>
                      <Link
                        href="/catalog"
                        className="mt-4 inline-flex border border-emerald-900/20 bg-emerald-50/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 hover:bg-emerald-900 hover:text-white transition-colors"
                      >
                        Browse Course Offerings →
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50/40 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                              <th className="py-2.5 pl-5 pr-3">Code</th>
                              <th className="py-2.5 px-3">Course Title</th>
                              <th className="py-2.5 px-3">Section</th>
                              <th className="py-2.5 px-3 text-center">Units</th>
                              <th className="py-2.5 pl-3 pr-5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200/80 text-xs">
                            {enlistments.map((subj) => {
                              const enrolled =
                                subj.status === "Enrolled" || subj.source === "block";
                              return (
                                <tr
                                  key={subj.code}
                                  className="transition-colors hover:bg-emerald-50/30"
                                >
                                  <td className="py-3 pl-5 pr-3 font-mono font-bold text-emerald-950 whitespace-nowrap">
                                    {subj.code}
                                  </td>
                                  <td className="py-3 px-3 font-medium text-zinc-800 min-w-[180px]">
                                    {subj.title || "Course Offering"}
                                  </td>
                                  <td className="py-3 px-3 font-mono text-zinc-600 whitespace-nowrap">
                                    {subj.section || sectionCode}
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono font-bold text-zinc-800">
                                    {subj.units || 0}
                                  </td>
                                  <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3 text-xs">
                        <span className="text-zinc-500">
                          {isConfirmed
                            ? "Your study load is officially registered."
                            : "Courses marked Enlisted must be confirmed in the Catalog tab."}
                        </span>
                        <div className="flex items-center gap-4 font-bold text-emerald-900">
                          <Link href="/catalog" className="hover:underline">
                            Add / Drop Courses
                          </Link>
                          <Link href="/schedule" className="hover:underline">
                            Full Timetable →
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                {/* 3. Institutional Clearance & Accountability Ledger */}
                <section
                  id="clearances"
                  className="border border-emerald-900/15 bg-white shadow-xs"
                >
                  <SectionHeader
                    title="Department Clearance & Accountability Ledger"
                    subtitle="All 8 institutional gates must be cleared prior to subject enlistment"
                    rightContent={
                      <StatusBadge
                        status={
                          blockedCount > 0
                            ? "blocked"
                            : allCleared
                              ? "cleared"
                              : "pending"
                        }
                      />
                    }
                  />
                  <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-y-0 sm:gap-px sm:bg-zinc-200">
                    {clearanceList.map((c) => (
                      <div
                        key={c.key}
                        className={`flex items-center justify-between gap-3 bg-white px-5 py-3.5 ${
                          c.status === "blocked"
                            ? "bg-red-50/30"
                            : c.status === "pending"
                              ? "bg-amber-50/20"
                              : "bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 truncate">
                            {c.label}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">
                            {c.office}
                          </p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right Column: Quick Services, Deadlines & Advisories (4 cols) */}
              <div className="flex flex-col gap-6 lg:col-span-4">
                {/* Online Services Directory */}
                <section className="border border-emerald-900/15 bg-white shadow-xs">
                  <SectionHeader
                    title="Student Self-Service"
                    subtitle="Quick access to portal modules"
                  />
                  <div className="divide-y divide-zinc-200">
                    {[
                      {
                        label: "Course Offerings & Enlistment",
                        desc: "Search open sections, add or drop subjects",
                        href: "/catalog",
                        tag: "Enlist",
                      },
                      {
                        label: "Weekly Class Schedule",
                        desc: "View room assignments and time blocks",
                        href: "/schedule",
                        tag: "Timetable",
                      },
                      {
                        label: "Curriculum Audit & Grades",
                        desc: "Track GWA, passed units, and prerequisites",
                        href: "/ledger",
                        tag: "Records",
                      },
                    ].map((srv) => (
                      <Link
                        key={srv.href}
                        href={srv.href}
                        className="group flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-emerald-50/50"
                      >
                        <div>
                          <p className="text-xs font-bold text-emerald-950 group-hover:text-emerald-700">
                            {srv.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {srv.desc}
                          </p>
                        </div>
                        <span className="shrink-0 border border-emerald-900/15 bg-zinc-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-900 group-hover:bg-emerald-900 group-hover:text-white transition-colors">
                          {srv.tag} →
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>

                {/* Trimester Load Meter Card */}
                <section className="border border-emerald-900/15 bg-white shadow-xs">
                  <SectionHeader title="Load Utilization" />
                  <div className="p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-zinc-600">
                        Enlisted / Maximum Allowable
                      </span>
                      <span className="font-mono text-lg font-bold text-emerald-950">
                        {totalUnits} / {maxUnits} Units
                      </span>
                    </div>
                    <div className="mt-2.5 h-2.5 w-full bg-zinc-100 border border-zinc-200">
                      <div
                        className="h-full bg-emerald-800 transition-all duration-300"
                        style={{
                          width: `${Math.min((totalUnits / (maxUnits || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2.5 text-[11px] text-zinc-500 leading-relaxed">
                      Overload requests exceeding{" "}
                      <strong className="font-mono text-zinc-700">{maxUnits} units</strong>{" "}
                      require endorsement from the College Dean and approval from the Office of the Registrar.
                    </p>
                  </div>
                </section>

                {/* Registrar Advisory Bulletin */}
                <section className="border border-emerald-900/15 bg-white shadow-xs">
                  <SectionHeader
                    title="Registrar Bulletin"
                    subtitle="Important reminders for this term"
                  />
                  <div className="divide-y divide-zinc-200 text-xs">
                    <div className="p-4">
                      <span className="inline-block bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-900">
                        Prerequisite Policy
                      </span>
                      <p className="mt-1.5 font-semibold text-zinc-800">
                        Strict Prerequisite Enforcement
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-600 leading-relaxed">
                        Courses with unsatisfied prerequisites in your Curriculum Audit Ledger cannot be enlisted without a formal Registrar Override.
                      </p>
                    </div>
                    <div className="p-4">
                      <span className="inline-block bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-900">
                        Slot Reservation
                      </span>
                      <p className="mt-1.5 font-semibold text-zinc-800">
                        Unconfirmed Loads
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-600 leading-relaxed">
                        Adding a course to your list does not guarantee a slot until you click Confirm Schedule.
                      </p>
                    </div>
                    <div className="bg-zinc-50/70 px-4 py-3 text-[11px] text-zinc-500">
                      Need assistance? Contact{" "}
                      <a
                        href="mailto:registrar@dlsau.edu.ph"
                        className="font-bold text-emerald-900 underline"
                      >
                        registrar@dlsau.edu.ph
                      </a>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ---------- REGISTRAR VIEW ---------- */}
          {role === "registrar" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-3 flex items-center justify-between gap-4 border border-emerald-200 border-l-4 border-l-emerald-700 bg-white px-6 py-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 bg-emerald-600 animate-pulse" />
                  <p className="text-sm font-semibold text-emerald-950">
                    Enrollment for{" "}
                    <strong>
                      {academicConfig.schoolYear} ({academicConfig.currentTerm})
                    </strong>{" "}
                    is currently{" "}
                    <strong className="uppercase">
                      {academicConfig.enrollmentOpen ? "open" : "closed"}
                    </strong>
                    .
                  </p>
                </div>
                <Link
                  href="/sections"
                  className="border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
                >
                  Manage Sections →
                </Link>
              </div>
            </div>
          )}

          {/* ---------- ADMIN VIEW ---------- */}
          {role === "admin" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-emerald-200 border-l-4 border-l-emerald-700 bg-white px-6 py-5 shadow-xs">
                <div className="flex items-center gap-4">
                  <span className="h-3 w-3 bg-emerald-600 animate-pulse shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">
                      All systems operational ({academicConfig.schoolYear} •{" "}
                      {academicConfig.currentTerm})
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Manage student profiles, department clearances, curriculum configurations, and trimester rollovers.
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/students"
                  className="shrink-0 border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
                >
                  Manage Student Profiles →
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}