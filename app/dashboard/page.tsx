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
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sections", href: "/sections" },
  { label: "Override Requests", href: "/overrides" },
  { label: "Enrollment Reports", href: "/reports" },
];

const CLEARANCE_GATES = [
  { key: "library", label: "Library" },
  { key: "accounting", label: "Accounting Office" },
  { key: "clinic", label: "Clinic" },
  { key: "disciplinary", label: "Discipline Office" },
  { key: "registrar", label: "Registrar" },
  { key: "guidance", label: "Guidance Office" },
  { key: "laboratory", label: "Laboratory" },
  { key: "studentAffairs", label: "Student Affairs Office" },
];

type Role = "student" | "registrar" | "admin";
type ClearanceStatus = "cleared" | "pending" | "blocked";

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
    blocked: "Blocked",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-bold ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-5 w-1.5 bg-emerald-800" />
      <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">
        {children}
      </h2>
    </div>
  );
}

function StatCard({
  title,
  accent = "bg-emerald-800",
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-6 shadow-xs">
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent}`} />
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center bg-white">
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
          Loading dashboard...
        </div>
      </div>
    );

  // Compute live clearance & enrollment progress for students
  const clearancesMap = studentDoc?.clearances || {};
  const clearanceList = CLEARANCE_GATES.map((g) => ({
    ...g,
    status: (clearancesMap[g.key] === "cleared" ? "cleared" : "pending") as ClearanceStatus,
  }));
  const allCleared = clearanceList.every((c) => c.status === "cleared");
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

  const enrollmentSteps = [
    { label: "Sign-in & Profile", done: true },
    { label: "Office Clearances", done: allCleared },
    { label: "Pick Subjects", done: hasAddedSubjects },
    { label: "Confirm Schedule", done: isConfirmed },
  ];
  const currentStep = enrollmentSteps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      {/* Sidebar */}
      {role === "admin" ? (
        <AdminNavbar />
      ) : role === "student" ? (
        <Navbar />
      ) : (
        <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-emerald-900/15 bg-white">
          <div className="flex flex-col h-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-8 pb-4 border-b border-emerald-900/10">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo/dlsau.png"
                  alt="DLSAU logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                  priority
                />
                <div>
                  <span className="block font-bold tracking-tight text-emerald-950 leading-none">
                    PATHWAYS
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                    DLSAU Portal
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="md:hidden border border-emerald-800 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
              >
                Sign Out
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <span className="h-2.5 w-1 bg-emerald-700" />
              Registrar
            </div>

            <nav className="flex flex-row md:flex-col flex-1 gap-1.5 overflow-x-auto pb-2 md:pb-0">
              {REGISTRAR_LINKS.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative shrink-0 px-3.5 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-emerald-900 text-white shadow-xs"
                        : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-950"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400" />
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden md:block border-t border-emerald-900/10 pt-5 mt-6">
              <div className="mb-4 border-l-2 border-emerald-700 pl-3">
                <p className="text-sm font-bold text-zinc-900 truncate">{name}</p>
                <p className="text-xs font-medium capitalize text-emerald-800">
                  {role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center border border-emerald-900/20 bg-emerald-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 transition-colors hover:bg-emerald-900 hover:text-white"
              >
                Sign Out
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <span>{academicConfig.schoolYear}</span>
                <span>•</span>
                <span>{academicConfig.currentTerm}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">
                Welcome back, {name?.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {studentDoc
                  ? `${studentDoc.program} • ${studentDoc.yearLevel} (${
                      studentDoc.academic?.section || studentDoc.section || "No Section"
                    })`
                  : "Here's an overview for today."}
              </p>
            </div>
            {role === "student" && (
              <button
                onClick={() => setShowProfile((v) => !v)}
                className="shrink-0 border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
              >
                {showProfile ? "Back to Overview" : "View Profile"}
              </button>
            )}
          </header>

          {/* ---------- STUDENT (PROFILE VIEW) ---------- */}
          {role === "student" && showProfile && userId && (
            <StudentProfile userId={userId} />
          )}

          {/* ---------- STUDENT (OVERVIEW VIEW) ---------- */}
          {role === "student" && !showProfile && (
            <div className="flex flex-col gap-6">
           

              {/* Top Stats */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <StatCard title="Enrollment Status" accent="bg-emerald-800">
                  <p className="mt-3 text-3xl font-bold text-emerald-800">
                    {isConfirmed
                      ? "Enrolled"
                      : hasAddedSubjects
                        ? "In Progress"
                        : allCleared
                          ? "Cleared"
                          : "Pending Clearance"}
                  </p>
                  <p className="mt-2 text-xs font-medium text-zinc-500">
                    Standing: {studentDoc?.enrollmentStatus || "Regular"}
                  </p>
                </StatCard>

                <StatCard title="Term Units" accent="bg-emerald-600">
                  <p className="mt-3 text-3xl font-bold text-emerald-950 font-mono">
                    {totalUnits} / {maxUnits}
                  </p>
                  <div className="mt-3 h-2 w-full bg-emerald-50 border border-emerald-100">
                    <div
                      className="h-full bg-emerald-700 transition-all"
                      style={{
                        width: `${Math.min((totalUnits / maxUnits) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </StatCard>

                <StatCard title="Clearance Gates" accent="bg-emerald-950">
                  <p className="mt-3 text-3xl font-bold text-emerald-950 font-mono">
                    {CLEARANCE_GATES.length - pendingCount} / {CLEARANCE_GATES.length}
                  </p>
                  <p className="mt-2 text-xs font-bold text-emerald-800">
                    {allCleared
                      ? "All offices cleared"
                      : `${pendingCount} office${pendingCount === 1 ? "" : "s"} pending`}
                  </p>
                </StatCard>
              </div>

              {/* Live Department Clearances */}
              <section
                id="clearances"
                className="border border-emerald-900/15 bg-white shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                  <SectionTitle>Department Clearances</SectionTitle>
                  <StatusBadge status={allCleared ? "cleared" : "pending"} />
                </div>
                <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-4">
                  {clearanceList.map((c) => (
                    <div
                      key={c.key}
                      className={`flex flex-col items-start justify-between gap-3 border border-l-4 p-4 ${
                        c.status === "pending"
                          ? "border-amber-300 border-l-amber-500 bg-amber-50/50"
                          : "border-zinc-200 border-l-emerald-700 bg-white"
                      }`}
                    >
                      <span className="text-sm font-bold text-zinc-800">
                        {c.label}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Call to Action Banner */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-l-4 bg-white p-5 shadow-xs ${
                  !academicConfig.enrollmentOpen
                    ? "border-zinc-300 border-l-zinc-600"
                    : allCleared
                      ? "border-emerald-200 border-l-emerald-700"
                      : "border-amber-200 border-l-amber-500"
                }`}
              >
                <div>
                  <p
                    className={`text-sm font-bold ${
                      !academicConfig.enrollmentOpen
                        ? "text-zinc-800"
                        : allCleared
                          ? "text-emerald-900"
                          : "text-amber-900"
                    }`}
                  >
                    {!academicConfig.enrollmentOpen
                      ? "Enrollment is currently closed"
                      : isConfirmed
                        ? "You are officially enrolled for this term"
                        : allCleared
                          ? "Ready to enroll"
                          : "Clearance needed before enrollment"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {!academicConfig.enrollmentOpen
                      ? "You can still view your schedule and subjects while the enrollment period is closed."
                      : isConfirmed
                        ? "View your weekly class timetable in the Schedule tab."
                        : allCleared
                          ? "Your clearance is complete. You can now pick your subjects and confirm your schedule."
                          : `You have ${pendingCount} pending office clearance${
                              pendingCount > 1 ? "s" : ""
                            }. Submit your requirements to the admin/registrar to unlock subject selection.`}
                  </p>
                </div>
                <Link
                  href={isConfirmed ? "/schedule" : "/catalog"}
                  className="shrink-0 border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-800"
                >
                  {isConfirmed ? "View My Schedule →" : "Go to Subjects →"}
                </Link>
              </div>
            </div>
          )}

          {/* ---------- REGISTRAR ---------- */}
          {role === "registrar" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 border border-emerald-200 border-l-4 border-l-emerald-700 bg-white px-5 py-4 shadow-xs">
                <span className="h-2.5 w-2.5 bg-emerald-600 animate-pulse" />
                <p className="text-sm font-semibold text-emerald-900">
                  Enrollment for{" "}
                  <strong>
                    {academicConfig.schoolYear} ({academicConfig.currentTerm})
                  </strong>{" "}
                  is currently{" "}
                  <strong>{academicConfig.enrollmentOpen ? "open" : "closed"}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ---------- ADMIN ---------- */}
          {role === "admin" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4 border border-emerald-200 border-l-4 border-l-emerald-700 bg-white px-5 py-4 shadow-xs">
                <div className="flex items-center gap-4">
                  <span className="h-3 w-3 bg-emerald-600 animate-pulse shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">
                      All systems running ({academicConfig.schoolYear} •{" "}
                      {academicConfig.currentTerm})
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      Manage student records, clearances, and trimester rollovers in the Student Profiles tab.
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/students"
                  className="shrink-0 border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Manage Students →
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}