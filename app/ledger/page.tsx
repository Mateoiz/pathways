"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV_MENUS = {
  student: [
    { label: "Overview", href: "/dashboard" },
    { label: "Subject Catalog", href: "/catalog" },
    { label: "Schedule Builder", href: "/schedule" },
    { label: "Academic Grades", href: "/ledger" },
  ]
};

// 1. ADDED TYPESCRIPT DEFINITIONS HERE
type Subject = {
  code: string;
  title: string;
  units: number;
  status: "Taken" | "Enrolled" | "In Progress" | "Pending";
  grade?: string;  // Optional
  prereq?: string; // Optional
};

type TermBlock = {
  term: string;
  subjects: Subject[];
};

type YearBlock = {
  year: string;
  terms: TermBlock[];
};

// 2. APPLIED THE TYPE TO THE CURRICULUM ARRAY
const CURRICULUM: YearBlock[] = [
  {
    year: "1st Year",
    terms: [
      {
        term: "1st Trimester",
        subjects: [
          { code: "CORE107", title: "UNDERSTANDING THE SELF", units: 3, grade: "2.5", status: "Taken" },
          { code: "CORE106", title: "MATHEMATICS IN THE MODERN WORLD", units: 3, grade: "2.5", status: "Taken" },
          { code: "PEED101", title: "PATHFIT-1", units: 2, grade: "3.0", status: "Taken" },
          { code: "CC101A", title: "INTRODUCTION TO COMPUTING LEC", units: 2, grade: "3.5", status: "Taken" },
          { code: "CC102A", title: "COMPUTER PROGRAMMING 1 LEC", units: 2, grade: "2.5", status: "Taken" },
          { code: "NSTP101A", title: "NATIONAL SERVICE TRAINING PROGRAM 1", units: 3, grade: "4.0", status: "Taken" },
          { code: "CC101B", title: "INTRODUCTION TO COMPUTING LAB", units: 1, grade: "3.5", status: "Taken" },
          { code: "CC102B", title: "COMPUTER PROGRAMMING 1 LAB", units: 1, grade: "4.0", status: "Taken" },
        ]
      },
      {
        term: "2nd Trimester",
        subjects: [
          { code: "LSVI101", title: "THE SPIRIT OF FAITH", units: 3, grade: "4.0", status: "Taken" },
          { code: "CORE109", title: "PANITIKAN NG PILIPINO", units: 3, grade: "3.0", status: "Taken" },
          { code: "PEED102", title: "PATHFIT-2", units: 2, grade: "4.0", status: "Taken" },
          { code: "CC103A", title: "COMPUTER PROGRAMMING 2 LEC", units: 2, grade: "2.5", status: "Taken" },
          { code: "CC103B", title: "COMPUTER PROGRAMMING 2 LAB", units: 1, grade: "2.5", status: "Taken" },
          { code: "NSTP102A", title: "NATIONAL SERVICE TRAINING PROGRAM 2", units: 3, grade: "4.0", status: "Taken" },
          { code: "CORE105", title: "SCIENCE, TECHNOLOGY AND SOCIETY", units: 3, grade: "3.5", status: "Taken" },
        ]
      },
      {
        term: "3rd Trimester",
        subjects: [
          { code: "CORE101", title: "READINGS IN PHILIPPINE HISTORY", units: 3, grade: "2.5", status: "Taken" },
          { code: "COEF362A", title: "LOGIC CIRCUITS AND DESIGN", units: 2, grade: "1.5", status: "Taken" },
          { code: "PEED103", title: "PATHFIT-3", units: 2, grade: "3.5", status: "Taken" },
          { code: "SDF104A", title: "OBJECT-ORIENTED PROGRAMMING LEC", units: 2, grade: "3.0", status: "Taken" },
          { code: "SDF104B", title: "OBJECT-ORIENTED PROGRAMMING LAB", units: 1, grade: "3.0", status: "Taken" },
          { code: "CC104A", title: "DATA STRUCTURE AND ALGORITHMS LEC", units: 2, grade: "1.5", status: "Taken" },
          { code: "CC104B", title: "DATA STRUCTURE AND ALGORITHMS LAB", units: 1, grade: "3.0", status: "Taken" },
          { code: "DS101A", title: "DISCRETE STRUCTURES 1", units: 3, grade: "2.0", status: "Taken" },
        ]
      }
    ]
  },
  {
    year: "2nd Year",
    terms: [
      {
        term: "1st Trimester",
        subjects: [
          { code: "COEE402A", title: "TECHNOPRENEURSHIP", units: 3, grade: "2.5", status: "Taken" },
          { code: "PEED104", title: "PATHFIT-4", units: 2, grade: "3.0", status: "Taken" },
          { code: "AL101A", title: "ALGORITHM AND COMPLEXITY", units: 3, grade: "1.5", status: "Taken" },
          { code: "CC105A", title: "INFORMATION MANAGEMENT LEC", units: 2, grade: "3.0", status: "Taken" },
          { code: "CC105B", title: "INFORMATION MANAGEMENT LAB", units: 1, grade: "3.0", status: "Taken" },
          { code: "LSVI102", title: "THE SPIRIT OF COMMUNION", units: 3, grade: "3.0", status: "Taken" },
          { code: "DS102A", title: "DISCRETE STRUCTURES 2", units: 3, grade: "2.0", status: "Taken" },
        ]
      },
      {
        term: "2nd Trimester",
        subjects: [
          { code: "CC106A", title: "APP DEV AND EMERGING TECH LEC", units: 2, grade: "3.0", status: "Taken" },
          { code: "AL102A", title: "AUTOMATA THEORY AND FORMAL LANGUAGE", units: 3, grade: "3.5", status: "Taken" },
          { code: "AR101A", title: "ARCHITECTURE AND ORGANIZATION LEC", units: 2, grade: "2.0", status: "Taken" },
          { code: "CN101A", title: "CSE 1 COMPUTATIONAL SCIENCE LEC", units: 2, grade: "3.5", status: "Taken" },
          { code: "CORE110", title: "ETHICS", units: 3, grade: "2.5", status: "Taken" },
          { code: "LSVI103", title: "THE SPIRIT OF SERVICE", units: 3, grade: "3.0", status: "Taken" },
        ]
      },
      {
        term: "3rd Trimester",
        subjects: [
          { code: "PD101A", title: "CSE 2 PARALLEL AND DISTRIBUTING COMPUTATION", units: 2, grade: "IP", status: "In Progress" },
          { code: "SE101A", title: "SOFTWARE ENGINEERING 1 LEC", units: 2, grade: "IP", status: "In Progress" },
          { code: "PL101A", title: "PROGRAMMING LANGUAGE LEC", units: 2, grade: "IP", status: "In Progress" },
          { code: "COEN122A", title: "PROBABILITY AND STATISTICS", units: 3, grade: "IP", status: "In Progress" },
          { code: "SP101A", title: "SOCIAL ISSUES AND PROFESSIONAL PRACTICE", units: 3, grade: "IP", status: "In Progress" },
        ]
      }
    ]
  },
  {
    year: "3rd Year",
    terms: [
      {
        term: "1st Trimester",
        subjects: [
          { code: "SE102A", title: "SOFTWARE ENGINEERING 2 LEC", units: 2, status: "Enrolled" },
          { code: "SE102B", title: "SOFTWARE ENGINEERING 2 LAB", units: 1, status: "Enrolled" },
          { code: "COSC117C", title: "THESIS 1 / SOFTWARE DESIGN AND DEV.", units: 3, status: "Enrolled" },
          { code: "OS101A", title: "OPERATING SYSTEM LEC", units: 2, status: "Enrolled" },
          { code: "HCI101A", title: "HUMAN COMPUTER INTERACTION", units: 3, status: "Enrolled" },
          { code: "GV101A", title: "CSE 3 GRAPHICS AND VISUAL COMPUTATION", units: 2, status: "Enrolled" },
          { code: "CORE108", title: "FILIPINO", units: 3, status: "Enrolled" },
        ]
      },
      {
        term: "2nd Trimester",
        subjects: [
          { code: "NC101A", title: "NETWORK AND COMMUNICATIONS", units: 2, status: "Pending", prereq: "SE102A, OS101A" },
          { code: "COSC122C", title: "THESIS 2", units: 3, status: "Pending", prereq: "COSC117C" },
          { code: "IAS101A", title: "INFORMATION ASSURANCE AND SECURITY", units: 2, status: "Pending", prereq: "SE102A" },
          { code: "FEL005C", title: "PRESENTATION SKILLS IN I.T.", units: 3, status: "Pending", prereq: "None" },
          { code: "SE103A", title: "SOFTWARE ENGINEERING 3", units: 2, status: "Pending", prereq: "SE102A" },
        ]
      }
    ]
  }
];

function GradeBadge({ status, grade }: { status: string, grade?: string }) {
  if (status === "Taken") {
    const isPassing = parseFloat(grade || "0") <= 3.0 && parseFloat(grade || "0") > 0;
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold border ${isPassing ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border-red-200'}`}>
        {grade}
      </span>
    );
  }
  if (status === "Enrolled") return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">ENROLLED</span>;
  if (status === "In Progress") return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">IN PROG</span>;
  return <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-bold text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">PENDING</span>;
}

export default function AcademicLedgerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "student") router.push("/");
    else setRole(storedRole);
  }, [router]);

  if (!role) return null;

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
            {NAV_MENUS.student.map((item, idx) => {
              const isActive = pathname === item.href;
              return (
                <Link key={idx} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-zinc-100 text-black dark:bg-white/[.08] dark:text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[.05]"}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Academic Ledger</h1>
          <p className="mt-1 text-sm md:text-base text-zinc-500">Track your academic progress, grades, and curriculum completion.</p>
        </header>

        <div className="flex flex-col gap-8">
          {CURRICULUM.map((yearBlock, yIdx) => (
            <div key={yIdx} className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-white/[.08] dark:bg-zinc-950">
              <div className="bg-zinc-100/50 px-5 py-3 border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-white/[.08]">
                <h2 className="text-lg font-bold">{yearBlock.year}</h2>
              </div>
              
              <div className="divide-y divide-zinc-200 dark:divide-white/[.08]">
                {yearBlock.terms.map((termBlock, tIdx) => (
                  <div key={tIdx} className="p-5">
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">{termBlock.term}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800/50">
                            <th className="pb-2 font-medium">Code</th>
                            <th className="pb-2 font-medium">Description</th>
                            <th className="pb-2 font-medium text-center">Units</th>
                            <th className="pb-2 font-medium text-right">Status / Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                          {termBlock.subjects.map((sub, sIdx) => (
                            <tr key={sIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                              <td className="py-3 font-semibold pr-4">{sub.code}</td>
                              <td className="py-3 pr-4">
                                <p className="text-zinc-900 dark:text-zinc-100">{sub.title}</p>
                                {sub.prereq && <p className="text-[10px] text-zinc-500 mt-0.5">Prereq: {sub.prereq}</p>}
                              </td>
                              <td className="py-3 text-center">{sub.units}</td>
                              <td className="py-3 text-right">
                                <GradeBadge status={sub.status} grade={sub.grade} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}