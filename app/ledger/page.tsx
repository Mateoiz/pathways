"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

const NAV_MENUS = {
  student: [
    { label: "Overview", href: "/dashboard" },
    { label: "Subjects", href: "/catalog" },
    { label: "Schedule", href: "/schedule" },
    { label: "Academic Records", href: "/ledger" },
  ],
};

const YEAR_ORDER = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const TERM_ORDER = ["1st Trimester", "2nd Trimester", "3rd Trimester"];

type Status = "Taken" | "Enrolled" | "Added" | "In Progress" | "Pending";

type Row = {
  code: string;
  title: string;
  units: number;
  status: Status;
  grade?: string;
  prereq?: string;
  missing?: boolean; // code isn't in the subjects catalog
};

type TermBlock = { term: string; rows: Row[] };
type YearBlock = { year: string; terms: TermBlock[] };

// Lower is better; 3.0 and below counts as passed (same rule as before)
const gradeNumber = (g?: string) => {
  const n = parseFloat(g || "");
  return isNaN(n) ? null : n;
};
const isPassing = (g?: string) => {
  const n = gradeNumber(g);
  return n !== null && n > 0 && n <= 3.0;
};

function GradeBadge({ status, grade }: { status: Status; grade?: string }) {
  const base = "inline-flex items-center border px-2 py-1 text-xs font-bold";
  if (status === "Taken") {
    return (
      <span
        className={`${base} ${
          isPassing(grade)
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-red-300 bg-red-50 text-red-800"
        }`}
      >
        {grade}
      </span>
    );
  }
  if (status === "Enrolled")
    return <span className={`${base} border-emerald-900 bg-emerald-900 text-white`}>ENROLLED</span>;
  if (status === "Added")
    return <span className={`${base} border-sky-300 bg-sky-50 text-sky-900`}>ADDED</span>;
  if (status === "In Progress")
    return <span className={`${base} border-amber-300 bg-amber-50 text-amber-900`}>IN PROGRESS</span>;
  return <span className={`${base} border-zinc-200 bg-zinc-100 text-zinc-500`}>PENDING</span>;
}

function weightedGwa(rows: Row[]): number | null {
  const graded = rows.filter((r) => r.status === "Taken" && gradeNumber(r.grade) !== null);
  const units = graded.reduce((t, r) => t + r.units, 0);
  if (units === 0) return null;
  return graded.reduce((t, r) => t + r.units * gradeNumber(r.grade)!, 0) / units;
}

export default function AcademicLedgerPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [program, setProgram] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<any | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [enlistments, setEnlistments] = useState<any[]>([]);

  const [baseLoaded, setBaseLoaded] = useState(false);
  const [enlistLoaded, setEnlistLoaded] = useState(false);

  // 1. Verify role and resolve the user id (same rule as the catalog and schedule pages)
  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "student") {
      router.push("/");
      return;
    }
    setRole(storedRole);
    setName(localStorage.getItem("mock_user_name"));

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : localStorage.getItem("mock_user_id") || "mock-student-id-123");
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Student record, curriculum, subject catalog and grades
  useEffect(() => {
    if (!role) return;
    const studentNo = localStorage.getItem("mock_user_id");

    (async () => {
      try {
        const [subjectsSnap, studentSnap] = await Promise.all([
          getDocs(collection(db, "subjects")),
          studentNo ? getDoc(doc(db, "students", studentNo)) : Promise.resolve(null),
        ]);
        setSubjects(subjectsSnap.docs.map((d) => d.data()));

        const prog = studentSnap && studentSnap.exists()
          ? studentSnap.data().program || studentSnap.data().academic?.program || null
          : null;
        setProgram(prog);

        if (prog) {
          const cSnap = await getDocs(query(collection(db, "curricula"), where("program", "==", prog)));
          setCurriculum(cSnap.empty ? null : cSnap.docs[0].data());
        }

        if (studentNo) {
          const gSnap = await getDocs(query(collection(db, "grades"), where("studentNo", "==", studentNo)));
          setGrades(gSnap.docs.map((d) => d.data()));
        }
      } catch (error) {
        console.error("Failed to load ledger data:", error);
      } finally {
        setBaseLoaded(true);
      }
    })();
  }, [role]);

  // 3. Current enlistments (so enrolled subjects show up)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "enlistments"), where("userId", "==", userId)));
        setEnlistments(snap.docs.map((d) => d.data()));
      } catch (error) {
        console.error("Failed to load enlistments:", error);
      } finally {
        setEnlistLoaded(true);
      }
    })();
  }, [userId]);

  // ───────────── Build the ledger from Firestore data ─────────────
  const years: YearBlock[] = useMemo(() => {
    if (!curriculum?.terms) return [];

    const subjectByCode = new Map(subjects.map((s) => [s.code, s]));
    const gradeByCode = new Map(grades.map((g) => [g.code, g]));
    const enlistByCode = new Map(enlistments.map((e) => [e.code, e]));

    const buildRow = (code: string): Row => {
      const s = subjectByCode.get(code);
      const base = {
        code,
        title: s?.title ?? "Not in subject catalog",
        units: s?.units ?? 0,
        missing: !s,
      };
      const g = gradeByCode.get(code);
      const e = enlistByCode.get(code);

      if (g) {
        const inProgress = g.status === "In Progress" || String(g.grade).toUpperCase() === "IP";
        if (inProgress) return { ...base, status: "In Progress", grade: "IP" };
        return { ...base, status: "Taken", grade: String(g.grade) };
      }
      if (e) {
        const enrolled = e.status === "Enrolled" || e.source === "block";
        return { ...base, status: enrolled ? "Enrolled" : "Added" };
      }
      return {
        ...base,
        status: "Pending",
        prereq: s?.prereq && s.prereq !== "None" ? s.prereq : undefined,
      };
    };

    const byYear = new Map<string, TermBlock[]>();
    [...curriculum.terms]
      .sort(
        (a: any, b: any) =>
          YEAR_ORDER.indexOf(a.year) - YEAR_ORDER.indexOf(b.year) ||
          TERM_ORDER.indexOf(a.term) - TERM_ORDER.indexOf(b.term)
      )
      .forEach((t: any) => {
        const block: TermBlock = { term: t.term, rows: (t.codes ?? []).map(buildRow) };
        byYear.set(t.year, [...(byYear.get(t.year) ?? []), block]);
      });

    return Array.from(byYear.entries()).map(([year, terms]) => ({ year, terms }));
  }, [curriculum, subjects, grades, enlistments]);

  const allRows = years.flatMap((y) => y.terms.flatMap((t) => t.rows));
  const totalUnits = allRows.reduce((t, r) => t + r.units, 0);
  const earnedUnits = allRows.filter((r) => r.status === "Taken" && isPassing(r.grade)).reduce((t, r) => t + r.units, 0);
  const enrolledUnits = allRows.filter((r) => r.status === "Enrolled" || r.status === "In Progress").reduce((t, r) => t + r.units, 0);
  const gwa = weightedGwa(allRows);

  function handleLogout() {
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    localStorage.removeItem("mock_user_id");
    auth.signOut();
    router.push("/");
  }

  if (!role || !baseLoaded || !enlistLoaded)
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-emerald-900 text-sm font-semibold">
          <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
          <svg className="animate-spin h-5 w-5 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading records...
        </div>
      </div>
    );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-emerald-900/15 bg-white">
        <div className="flex flex-col h-full p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-8 pb-4 border-b border-emerald-900/10">
            <div className="flex items-center gap-3">
              <Image src="/logo/dlsau.png" alt="DLSAU logo" width={40} height={40} className="h-10 w-10 object-contain" priority />
              <div>
                <span className="block font-bold tracking-tight text-emerald-950 leading-none">PATHWAYS</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">DLSAU Portal</span>
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
            Student
          </div>

          <nav className="flex flex-row md:flex-col flex-1 gap-1.5 overflow-x-auto no-scrollbar pb-2 md:pb-0">
            {NAV_MENUS.student.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative shrink-0 px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    isActive ? "bg-emerald-900 text-white shadow-xs" : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-950"
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:block border-t border-emerald-900/10 pt-5 mt-6">
            <div className="mb-4 border-l-2 border-emerald-700 pl-3">
              <p className="text-sm font-bold text-zinc-900 truncate">{name}</p>
              <p className="text-xs font-medium capitalize text-emerald-800">{role}</p>
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

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="mx-auto w-full max-w-6xl p-4 sm:p-8 lg:p-10">
          <header className="mb-6 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">Academic Records</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {program ? `${program} · ` : ""}Your grades and progress through the curriculum.
            </p>
          </header>

          {years.length === 0 ? (
            <div className="border border-emerald-900/15 bg-white px-6 py-16 text-center shadow-xs">
              <div className="mx-auto mb-3 h-3 w-12 bg-emerald-800/20" />
              <p className="text-sm font-semibold text-zinc-700">
                {program ? "No curriculum has been set up for your program yet." : "We couldn't find your student record."}
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Units Earned", value: `${earnedUnits} / ${totalUnits}`, accent: "bg-emerald-800" },
                  { label: "Current Load", value: `${enrolledUnits} units`, accent: "bg-emerald-600" },
                  { label: "Subjects Passed", value: allRows.filter((r) => r.status === "Taken" && isPassing(r.grade)).length, accent: "bg-sky-600" },
                  { label: "GWA", value: gwa === null ? "—" : gwa.toFixed(2), accent: "bg-emerald-950" },
                ].map((c) => (
                  <div key={c.label} className="relative overflow-hidden border border-emerald-900/10 bg-white p-4 shadow-xs">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${c.accent}`} />
                    <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{c.label}</p>
                    <p className="mt-2 pl-1 font-mono text-2xl font-bold text-emerald-950">{c.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-6">
                {years.map((yearBlock) => {
                  const yearRows = yearBlock.terms.flatMap((t) => t.rows);
                  const yearUnits = yearRows.reduce((t, r) => t + r.units, 0);
                  return (
                    <section key={yearBlock.year} className="border border-emerald-900/15 bg-white shadow-xs">
                      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-5 w-1.5 bg-emerald-800" />
                          <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">{yearBlock.year}</h2>
                        </div>
                        <span className="font-mono text-xs font-bold text-zinc-500">{yearUnits} units</span>
                      </div>

                      <div className="divide-y divide-zinc-200">
                        {yearBlock.terms.map((termBlock) => {
                          const termUnits = termBlock.rows.reduce((t, r) => t + r.units, 0);
                          const termGwa = weightedGwa(termBlock.rows);
                          return (
                            <div key={termBlock.term} className="p-5">
                              <div className="mb-3 flex items-center justify-between bg-emerald-950/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                                <span>{termBlock.term}</span>
                                <span className="font-mono">
                                  {termUnits} units{termGwa !== null && ` · GWA ${termGwa.toFixed(2)}`}
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                  <thead>
                                    <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-400">
                                      <th className="pb-2 font-bold">Code</th>
                                      <th className="pb-2 font-bold">Description</th>
                                      <th className="pb-2 text-center font-bold">Units</th>
                                      <th className="pb-2 text-right font-bold">Status / Grade</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100">
                                    {termBlock.rows.map((r) => (
                                      <tr key={r.code} className="transition-colors hover:bg-emerald-50/40">
                                        <td className="py-3 pr-4 font-bold text-zinc-900">{r.code}</td>
                                        <td className="py-3 pr-4">
                                          <p className={r.missing ? "italic text-zinc-400" : "text-zinc-800"}>{r.title}</p>
                                          {r.prereq && (
                                            <p className="mt-0.5 text-[11px] text-zinc-500">
                                              Prerequisite: <span className="font-bold text-amber-700">{r.prereq}</span>
                                            </p>
                                          )}
                                        </td>
                                        <td className="py-3 text-center font-mono">{r.units}</td>
                                        <td className="py-3 text-right">
                                          <GradeBadge status={r.status} grade={r.grade} />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}