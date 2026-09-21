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
  ]
};

// Updated with your 3rd Year - 1st Trimester enrolled subjects, parsed for UI
const STATIC_ENROLLED = [
  { code: "SE102A", title: "SOFTWARE ENGINEERING 2 LEC", days: "Tue, Thu", time: "09:30 AM - 10:50 AM", room: "RM613", status: "Enrolled" },
  { code: "SE102B", title: "SOFTWARE ENGINEERING 2 LAB", days: "Tue, Thu", time: "07:30 AM - 09:30 AM", room: "RM608", status: "Enrolled" },
  { code: "COSC117C", title: "THESIS 1 / SOFTWARE DESIGN AND DEV.", days: "Tue, Thu", time: "11:30 AM - 01:30 PM", room: "RM608", status: "Enrolled" },
  { code: "OS101A", title: "OPERATING SYSTEM LEC", days: "Sat", time: "08:00 AM - 10:40 AM", room: "TBA", status: "Enrolled" },
];

export default function ScheduleBuilderPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  
  const [enlistedSubjects, setEnlistedSubjects] = useState<any[]>([]);

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    const storedName = localStorage.getItem("mock_user_name");
    if (!storedRole || storedRole !== "student") {
      router.push("/");
    } else {
      setRole(storedRole);
      setName(storedName);
    }

    const savedEnlistments = JSON.parse(localStorage.getItem("mock_enlisted") || "[]");
    setEnlistedSubjects(savedEnlistments);
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    router.push("/");
  }

  function handleRemove(codeToRemove: string) {
    const updatedList = enlistedSubjects.filter(sub => sub.code !== codeToRemove);
    setEnlistedSubjects(updatedList);
    localStorage.setItem("mock_enlisted", JSON.stringify(updatedList));
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading schedule…
        </div>
      </div>
    );
  }

  const combinedSchedule = [
    ...STATIC_ENROLLED,
    ...enlistedSubjects.map(sub => ({ ...sub, status: "Enlisted" }))
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50 font-sans">
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-zinc-200 bg-white dark:border-white/[.08] dark:bg-zinc-950">
        <div className="flex flex-col h-full p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3z"/>
                </svg>
              </div>
              <span className="font-bold tracking-tight">PATHWAYS</span>
            </div>
            <button onClick={handleLogout} className="md:hidden text-xs font-semibold text-zinc-500 hover:text-black dark:hover:text-white">
              Sign Out
            </button>
          </div>

          <div className="hidden md:block mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Student Portal
          </div>

          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
            {NAV_MENUS.student.map((item, idx) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={idx}
                  href={item.href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
          
          <div className="hidden md:block mt-auto border-t border-zinc-200 pt-6 dark:border-white/[.08]">
            <div className="mb-4">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs capitalize text-zinc-500">{role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center rounded-lg border border-zinc-200 bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-white/[.1] dark:hover:bg-white/[.05]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
        <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Schedule Builder</h1>
            <p className="mt-1 text-sm md:text-base text-zinc-500">Review your enlisted subjects and active enrollments.</p>
          </div>
          <Link href="/catalog" className="inline-flex justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors w-full sm:w-auto">
            + Enlist Subject
          </Link>
        </header>

        <div className="flex flex-col gap-4 max-w-4xl">
          {combinedSchedule.length === 0 && (
             <div className="p-8 text-center text-zinc-500 border border-zinc-200 border-dashed rounded-xl dark:border-zinc-800">
               No subjects in your schedule yet.
             </div>
          )}

          {combinedSchedule.map((item, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-white/[.08] dark:bg-zinc-950">
              
              <div className="flex flex-col sm:w-1/3">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold">{item.code}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    item.status === "Enrolled" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug pr-4">{item.title}</p>
              </div>

              <div className="flex flex-col sm:w-1/3 border-t border-zinc-100 pt-3 sm:border-0 sm:pt-0 dark:border-white/[.08]">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item.days}
                </div>
                <p className="text-xs text-zinc-500 mt-1 pl-6">{item.time}</p>
              </div>

              <div className="flex items-center justify-between sm:justify-end sm:w-1/3 gap-4">
                <div className="flex items-center gap-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {item.room}
                </div>
                
                {item.status === "Enlisted" ? (
                  <button 
                    onClick={() => handleRemove(item.code)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors" 
                    title="Remove enlisted subject"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : (
                  <div className="w-9 h-9" /> 
                )}
              </div>
            </div>
          ))}
        </div>
        
        {enlistedSubjects.length > 0 && (
          <div className="mt-8 p-5 sm:p-6 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 max-w-4xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
               <h3 className="font-bold text-blue-900 dark:text-blue-300">Ready to finalize your schedule?</h3>
               <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">You have {enlistedSubjects.length} enlisted subject{enlistedSubjects.length > 1 ? "s" : ""} awaiting confirmation.</p>
             </div>
             <button 
                onClick={() => {
                  alert("Enrollment finalized successfully! (Mock Action)");
                  setEnlistedSubjects([]);
                  localStorage.removeItem("mock_enlisted");
                }}
                className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
             >
               Finalize Enrollment →
             </button>
          </div>
        )}
      </main>
    </div>
  );
}