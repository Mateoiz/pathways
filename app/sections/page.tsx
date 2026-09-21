"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV_MENUS = {
  registrar: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Section Management", href: "/sections" },
    { label: "Manual Overrides", href: "/overrides" },
    { label: "Enrollment Reports", href: "/reports" },
  ]
};

const MOCK_SECTIONS = [
  { id: "CS101-A", instructor: "Dr. Alan Turing", enrolled: 40, capacity: 40, status: "Full", schedule: "MWF 8:00-9:00 AM" },
  { id: "CS101-B", instructor: "Grace Hopper", enrolled: 32, capacity: 40, status: "Open", schedule: "TTH 1:00-2:30 PM" },
  { id: "MATH201-A", instructor: "Katherine Johnson", enrolled: 15, capacity: 30, status: "Open", schedule: "MWF 10:00-11:00 AM" },
  { id: "PHYS101-C", instructor: "Albert Einstein", enrolled: 35, capacity: 35, status: "Full", schedule: "TTH 8:00-10:00 AM" },
];

export default function SectionManagementPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    const storedName = localStorage.getItem("mock_user_name");
    if (!storedRole || storedRole !== "registrar") {
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

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading section data…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50 font-sans">
      {/* SIDEBAR */}
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
          Registrar Portal
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_MENUS.registrar.map((item, idx) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={idx}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
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

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Section Management</h1>
            <p className="mt-1 text-zinc-500">Monitor and adjust class capacities and schedules.</p>
          </div>
          <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors">
            + Open New Section
          </button>
        </header>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/[.08] dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 dark:border-white/[.08] dark:bg-zinc-900/50">
              <tr>
                <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Section ID</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Instructor & Time</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Capacity Load</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Status</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/[.08]">
              {MOCK_SECTIONS.map((section) => {
                const fillPercentage = (section.enrolled / section.capacity) * 100;
                return (
                  <tr key={section.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold">{section.id}</td>
                    <td className="px-6 py-4">
                      <p className="text-zinc-900 dark:text-zinc-100">{section.instructor}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{section.schedule}</p>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <span className="w-12 text-right font-medium">{section.enrolled}/{section.capacity}</span>
                      <div className="h-1.5 w-24 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div 
                          className={`h-1.5 rounded-full ${fillPercentage >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${fillPercentage}%` }} 
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold border ${
                        section.status === "Full"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${section.status === "Full" ? "bg-red-500" : "bg-emerald-500"}`} />
                        {section.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white font-medium transition-colors">
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}