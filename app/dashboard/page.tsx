"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV_MENUS = {
  student: [
    { label: "Overview", href: "/dashboard" },
    { label: "Subject Catalog", href: "/catalog" },
    { label: "Schedule Builder", href: "/schedule" },
    { label: "Academic Ledger", href: "/ledger" },
  ],
  registrar: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Section Management", href: "/sections" },
    { label: "Manual Overrides", href: "/overrides" },
    { label: "Enrollment Reports", href: "/reports" },
  ],
  admin: [
    { label: "System Health", href: "/dashboard" },
    { label: "Curriculum Config", href: "/curriculum" },
    { label: "User Roles", href: "/roles" },
    { label: "Audit Logs", href: "/logs" },
  ],
};

// H1 — enrollment flow steps for students
const ENROLLMENT_STEPS = [
  { label: "Authentication & Clearance", done: true },
  { label: "Catalog Discovery", done: true },
  { label: "Cart Assembly", done: false },
  { label: "Summary & Verification", done: false },
  { label: "Confirmation & CoR", done: false },
];

// H1 — clearance gate statuses
const CLEARANCE_ITEMS = [
  { label: "Library", status: "cleared" as const },
  { label: "Accounting", status: "cleared" as const },
  { label: "Clinic", status: "pending" as const },
  { label: "Disciplinary", status: "cleared" as const },
];

type Role = keyof typeof NAV_MENUS;
type ClearanceStatus = "cleared" | "pending" | "blocked";

function StatusBadge({ status }: { status: ClearanceStatus }) {
  const styles: Record<ClearanceStatus, string> = {
    cleared: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    blocked: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  };
  const labels: Record<ClearanceStatus, string> = {
    cleared: "Cleared",
    pending: "Pending",
    blocked: "Blocked",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "cleared" ? "bg-emerald-500" : status === "pending" ? "bg-amber-500" : "bg-red-500"}`} />
      {labels[status]}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role") as Role | null;
    const storedName = localStorage.getItem("mock_user_name");
    if (!storedRole) {
      router.push("/");
    } else {
      setRole(storedRole);
      setName(storedName);
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    router.push("/");
  }

  // H1 — show nothing while reading auth state (avoids flash of wrong content)
  if (!role) return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading your dashboard…
      </div>
    </div>
  );

  const currentMenu = NAV_MENUS[role] || [];
  const allCleared = CLEARANCE_ITEMS.every((c) => c.status === "cleared");
  const pendingCount = CLEARANCE_ITEMS.filter((c) => c.status === "pending").length;
  const currentStep = ENROLLMENT_STEPS.filter((s) => s.done).length;

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50 font-sans">

      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-zinc-200 bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3z"/>
            </svg>
          </div>
          <span className="font-bold tracking-tight">PATHWAYS</span>
        </div>

        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {role} Portal
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {currentMenu.map((item, idx) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={idx}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors
                  ${isActive
                    ? "bg-zinc-100 text-black dark:bg-white/[.08] dark:text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.05] dark:hover:text-white"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User & logout */}
        <div className="border-t border-zinc-200 pt-6 dark:border-white/[.08]">
          <div className="mb-4">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-xs capitalize text-zinc-500">{role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center rounded-lg border border-zinc-200 bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-white/[.1] dark:hover:bg-white/[.05]"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {name?.split(" ")[0]}</h1>
          <p className="mt-1 text-zinc-500">Here is what is happening with your enrollment today.</p>
        </header>

        {/* ── STUDENT VIEW ── */}
        {role === "student" && (
          <div className="flex flex-col gap-6">

            {/* H1 — Enrollment Progress Tracker */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Enrollment Progress</h2>
                <span className="text-xs text-zinc-500">Step {currentStep} of {ENROLLMENT_STEPS.length}</span>
              </div>
              <div className="flex items-center gap-0">
                {ENROLLMENT_STEPS.map((step, i) => (
                  <div key={i} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                        ${step.done
                          ? "bg-black border-black text-white dark:bg-white dark:border-white dark:text-black"
                          : i === currentStep
                            ? "border-zinc-400 text-zinc-500 dark:border-zinc-500"
                            : "border-zinc-200 text-zinc-300 dark:border-zinc-700 dark:text-zinc-600"
                        }`}>
                        {step.done ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : i + 1}
                      </div>
                      <span className={`mt-1.5 text-center text-[10px] leading-tight max-w-[64px]
                        ${step.done ? "text-zinc-700 dark:text-zinc-300 font-medium" : "text-zinc-400 dark:text-zinc-600"}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < ENROLLMENT_STEPS.length - 1 && (
                      <div className={`h-0.5 w-full mb-5 transition-colors ${step.done ? "bg-black dark:bg-white" : "bg-zinc-200 dark:bg-zinc-800"}`} />
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* H1 — Clearance Gate Status */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Clearance Gate</h2>
                {/* H1 — overall clearance status visible at a glance */}
                {allCleared
                  ? <StatusBadge status="cleared" />
                  : <StatusBadge status="pending" />
                }
              </div>
              {/* H5 — if not fully cleared, warn before they try to enroll */}
              {!allCleared && (
                <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400">
                  <strong>{pendingCount} clearance{pendingCount > 1 ? "s" : ""} pending.</strong>{" "}
                  You won't be able to proceed to subject enrollment until all clearances are resolved.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {CLEARANCE_ITEMS.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-zinc-100 dark:border-white/[.06] p-3">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{c.label}</span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </section>

            {/* Stat widgets */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Enrollment Status</h3>
                {/* H1 — color-coded status, not just text */}
                <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">Cleared</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Enrolled Units</h3>
                <p className="mt-2 text-2xl font-bold">18 / 21</p>
                {/* H1 — visual unit load bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-black dark:bg-white" style={{ width: `${(18 / 21) * 100}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Current GWA</h3>
                <p className="mt-2 text-2xl font-bold">1.25</p>
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">Dean's List Eligible</p>
              </div>
            </div>

            {/* H5 — action blocked warning if clearance is pending */}
            <div className={`rounded-xl border p-5 flex items-center justify-between
              ${allCleared
                ? "border-zinc-200 bg-white dark:border-white/[.08] dark:bg-zinc-950"
                : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
              }`}>
              <div>
                <p className="text-sm font-semibold">
                  {allCleared ? "Ready to enroll" : "Enrollment blocked"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {allCleared
                    ? "All clearances verified. You may proceed to the Subject Catalog."
                    : "Resolve all pending clearances before accessing the Subject Catalog."
                  }
                </p>
              </div>
              
              <Link
                href={allCleared ? "/catalog" : "#"}
                className={`ml-4 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all
                  ${allCleared
                    ? "bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600 pointer-events-none"
                  }`}
              >
                Go to Catalog →
              </Link>
            </div>
          </div>
        )}

        {/* ── REGISTRAR VIEW ── */}
        {role === "registrar" && (
          <div className="flex flex-col gap-6">
            {/* H1 — system-level status banner */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-5 py-4 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Enrollment portal is <strong>Open</strong>. Students may currently submit enrollment requests.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Pending Overrides</h3>
                {/* H1 — amber to signal attention needed */}
                <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">14</p>
                <p className="mt-1 text-xs text-zinc-400">Requires manual review</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Total Enrolled</h3>
                <p className="mt-2 text-2xl font-bold">2,451</p>
                <p className="mt-1 text-xs text-zinc-400">Out of 3,200 capacity</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-black dark:bg-white" style={{ width: `${(2451 / 3200) * 100}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">System Status</h3>
                <p className="mt-2 text-2xl font-bold text-emerald-600">Open</p>
                <p className="mt-1 text-xs text-zinc-400">Since Aug 12, 2026 · 8:00 AM</p>
              </div>
            </div>
          </div>
        )}

        {/* ── ADMIN VIEW ── */}
        {role === "admin" && (
          <div className="flex flex-col gap-6">
            {/* H1 — system health summary bar */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/[.08] dark:bg-zinc-950 flex items-center gap-4">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <p className="text-sm font-semibold">All systems operational</p>
                <p className="text-xs text-zinc-500">No incidents in the last 24 hours. Last checked: just now.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Active Sessions</h3>
                <p className="mt-2 text-2xl font-bold">342</p>
                <p className="mt-1 text-xs text-zinc-400">Peak today: 891</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Database Load</h3>
                <p className="mt-2 text-2xl font-bold text-emerald-600">Low (12%)</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: "12%" }} />
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-500">Error Rate</h3>
                <p className="mt-2 text-2xl font-bold">0.01%</p>
                <p className="mt-1 text-xs text-emerald-600 font-medium">Within acceptable threshold</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}