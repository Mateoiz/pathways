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

// Extracted from your provided dataset
const MOCK_SUBJECTS = [
  { code: "NC101A", title: "NETWORK AND COMMUNICATIONS LEC", units: 2, slots: 15, max: 40, prereq: "SE102A, OS101A", year: "3rd Year", term: "2nd Trimester" },
  { code: "COSC122C", title: "THESIS 2 / SOFTWARE DESIGN AND DEV.", units: 3, slots: 3, max: 30, prereq: "COSC117C", year: "3rd Year", term: "2nd Trimester" },
  { code: "IAS101A", title: "INFORMATION ASSURANCE AND SECURITY LEC", units: 2, slots: 28, max: 40, prereq: "SE102A, OS101A", year: "3rd Year", term: "2nd Trimester" },
  { code: "FEL005C", title: "PRESENTATION SKILLS IN I.T.", units: 3, slots: 10, max: 35, prereq: "None", year: "3rd Year", term: "2nd Trimester" },
  { code: "SE103A", title: "SOFTWARE ENGINEERING 3 LEC", units: 2, slots: 5, max: 40, prereq: "SE102A, SE102B", year: "3rd Year", term: "2nd Trimester" },
  { code: "CORE111", title: "FILIPINO (Filipino sa Iba't-ibang Disiplina)", units: 3, slots: 0, max: 40, prereq: "None", year: "3rd Year", term: "2nd Trimester" },
  { code: "CORE102", title: "ART APPRECIATION", units: 3, slots: 40, max: 40, prereq: "None", year: "3rd Year", term: "3rd Trimester" },
  { code: "COEP477B", title: "SEMINARS AND FIELD TRIPS", units: 3, slots: 30, max: 40, prereq: "NC101A, IAS101A", year: "3rd Year", term: "3rd Trimester" },
  { code: "RZAL101A", title: "LIFE AND WORKS OF RIZAL", units: 3, slots: 15, max: 40, prereq: "None", year: "3rd Year", term: "3rd Trimester" },
  { code: "SF101A", title: "SYSTEM FUNDAMENTALS", units: 3, slots: 25, max: 40, prereq: "None", year: "3rd Year", term: "3rd Trimester" },
  { code: "COSC422D", title: "ON THE JOB TRAINING", units: 3, slots: 50, max: 50, prereq: "None", year: "4th Year", term: "1st Trimester" },
];

export default function SubjectCatalogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New UI Filters to handle large data
  const [filterYear, setFilterYear] = useState("All");
  const [filterTerm, setFilterTerm] = useState("All");
  
  const [enlistedSubjects, setEnlistedSubjects] = useState<any[]>([]);

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "student") router.push("/");
    else setRole(storedRole);
    
    setEnlistedSubjects(JSON.parse(localStorage.getItem("mock_enlisted") || "[]"));
  }, [router]);

  function handleEnlist(subject: any) {
    const updated = [...enlistedSubjects, subject];
    setEnlistedSubjects(updated);
    localStorage.setItem("mock_enlisted", JSON.stringify(updated));
  }

  if (!role) return null;

  const filteredSubjects = MOCK_SUBJECTS.filter(sub => {
    const matchesSearch = sub.code.toLowerCase().includes(searchQuery.toLowerCase()) || sub.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = filterYear === "All" || sub.year === filterYear;
    const matchesTerm = filterTerm === "All" || sub.term === filterTerm;
    return matchesSearch && matchesYear && matchesTerm;
  });

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
          </div>
          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
            {NAV_MENUS.student.map((item, idx) => (
              <Link key={idx} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === item.href ? "bg-zinc-100 text-black dark:bg-white/[.08] dark:text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[.05]"}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Subject Catalog</h1>
          <p className="mt-1 text-sm md:text-base text-zinc-500">Browse and enlist in subjects for the upcoming semester.</p>
        </header>

        {/* Filter Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
          />
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="All">All Years</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>
          <select 
            value={filterTerm} 
            onChange={(e) => setFilterTerm(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="All">All Terms</option>
            <option value="1st Trimester">1st Trimester</option>
            <option value="2nd Trimester">2nd Trimester</option>
            <option value="3rd Trimester">3rd Trimester</option>
          </select>
        </div>

        <div className="flex flex-col gap-4">
          {filteredSubjects.map((subject) => {
            const isFull = subject.slots === 0;
            const isAlreadyEnlisted = enlistedSubjects.some(s => s.code === subject.code);
            
            return (
              <div key={subject.code} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-white/[.08] dark:bg-zinc-950">
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-lg font-bold">{subject.code}</h3>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">{subject.units} Units</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">{subject.year} • {subject.term}</span>
                    {isFull && <span className="rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium dark:bg-red-950 dark:text-red-400">Closed</span>}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{subject.title}</p>
                  <p className="text-xs text-zinc-500 mt-2">Prerequisite: {subject.prereq}</p>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-zinc-100 pt-4 sm:border-0 sm:pt-0 dark:border-white/[.08]">
                  <div className="text-left sm:text-right hidden sm:block">
                    <p className="text-sm font-semibold">{subject.slots} / {subject.max}</p>
                    <p className="text-xs text-zinc-500">Slots Available</p>
                  </div>
                  <button
                    disabled={isFull || isAlreadyEnlisted}
                    onClick={() => handleEnlist(subject)}
                    className={`w-full sm:w-auto shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isAlreadyEnlisted 
                        ? "bg-zinc-100 text-zinc-600 cursor-not-allowed dark:bg-zinc-900 dark:text-zinc-400"
                        : isFull 
                          ? "bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-900 dark:text-zinc-600"
                          : "bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    }`}
                  >
                    {isAlreadyEnlisted ? "Enlisted ✓" : "Enlist"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}