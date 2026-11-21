"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import { getAcademicConfig } from "@/lib/academicConfig";

type CourseStatus = "Completed" | "Enrolled" | "Added" | "Remaining";
type StatusFilter = "All" | CourseStatus;

interface LedgerCourse {
  code: string;
  title: string;
  units: number;
  prereq: string;
  year: string;
  term: string;
  status: CourseStatus;
  grade?: string | number | null;
  section?: string;
  termTaken?: string;
  prereqMet: boolean;
}

const PROGRAM_ID_FALLBACK: Record<string, string> = {
  "BS Computer Science": "bs-computer-science",
  "BS Accountancy": "bs-accountancy",
  "BSBA Marketing Management": "bsba-marketing-management",
  "Doctor of Veterinary Medicine": "doctor-of-veterinary-medicine",
};

export default function AcademicLedgerPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Student & Academic Metadata
  const [studentData, setStudentData] = useState<any | null>(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState("2026-2027");
  const [activeTerm, setActiveTerm] = useState("1st Trimester");

  // Raw Firestore Maps
  const [curriculum, setCurriculum] = useState<any | null>(null);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, any>>({});
  const [enlistmentsMap, setEnlistmentsMap] = useState<Record<string, any>>({});

  // UI Filters (Zero Native Selects)
  const [selectedYear, setSelectedYear] = useState<string>("All Years");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Verify Student Session
  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "student") {
      router.push("/");
      return;
    }
    setRole(storedRole);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const storedId = localStorage.getItem("mock_user_id");
      if (storedId) {
        setUserId(storedId);
      } else if (user?.email) {
        setUserId(user.email.split("@")[0]);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Load Student Profile, Active Config, Program Flowchart, Catalog & Enlistments
  useEffect(() => {
    async function fetchLedgerData() {
      if (!userId) return;
      setIsLoading(true);

      try {
        const [config, studentSnap, subjectsSnap, enlistSnap] = await Promise.all([
          getAcademicConfig(),
          getDoc(doc(db, "students", userId)),
          getDocs(collection(db, "subjects")),
          getDocs(query(collection(db, "enlistments"), where("userId", "==", userId))),
        ]);

        setActiveSchoolYear(config.schoolYear);
        setActiveTerm(config.currentTerm);

        // Catalog Lookup Map
        const subMap: Record<string, any> = {};
        subjectsSnap.docs.forEach((d) => {
          const data = d.data();
          const code = data.code || d.id;
          subMap[code] = { id: d.id, code, ...data };
        });
        setSubjectsMap(subMap);

        // Student Enlistments Map
        const enlMap: Record<string, any> = {};
        enlistSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.code) {
            enlMap[data.code] = data;
          }
        });
        setEnlistmentsMap(enlMap);

        // Student Profile & Program Curriculum
        let programName = "BS Computer Science";
        let programId = "bs-computer-science";

        if (studentSnap.exists()) {
          const st = studentSnap.data();
          setStudentData(st);
          programName = st.program || st.academic?.program || "BS Computer Science";
          programId =
            st.programId ||
            PROGRAM_ID_FALLBACK[programName] ||
            "bs-computer-science";
        }

        // Fetch Curriculum by ID first, fallback to program label query
        const currDoc = await getDoc(doc(db, "curricula", programId));
        if (currDoc.exists()) {
          setCurriculum(currDoc.data());
        } else {
          const currQuery = await getDocs(
            query(collection(db, "curricula"), where("program", "==", programName))
          );
          if (!currQuery.empty) {
            setCurriculum(currQuery.docs[0].data());
          }
        }
      } catch (error) {
        console.error("Failed to load academic ledger data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLedgerData();
  }, [userId]);

  // 3. Build Term-by-Term Curriculum Checklist with Live Statuses
  const { termBlocks, allLedgerCourses, availableYears } = useMemo(() => {
    const terms: { year: string; term: string; block: boolean; codes: string[] }[] =
      curriculum?.terms || [];

    // Grades recorded on student profile (e.g., studentData.grades = { CORE101: { grade: "1.5", term: "SY2025-2026-1", section: "BSCS1A" } })
    const studentGrades: Record<string, any> = studentData?.grades || {};

    // First pass: identify all completed course codes for prerequisite checking
    const completedCodes = new Set<string>();
    Object.entries(studentGrades).forEach(([code, gVal]) => {
      const g = typeof gVal === "object" ? gVal?.grade : gVal;
      if (g && g !== "5.0" && g !== "F" && g !== "INC" && g !== "DRP") {
        completedCodes.add(code);
      }
    });
    Object.entries(enlistmentsMap).forEach(([code, enl]) => {
      if (enl.status === "Completed" || (enl.grade && enl.grade !== "5.0")) {
        completedCodes.add(code);
      }
    });

    const yearsSet = new Set<string>();
    const flatCourses: LedgerCourse[] = [];

    const blocks = terms.map((t) => {
      yearsSet.add(t.year);

      const courses: LedgerCourse[] = (t.codes || []).map((code) => {
        const catalogSub = subjectsMap[code] || {};
        const enl = enlistmentsMap[code];
        const gradeEntry = studentGrades[code];

        const units = Number(catalogSub.units ?? enl?.units ?? 3);
        const title =
          catalogSub.title || enl?.title || "Course Title Not in Catalog";
        const prereq = catalogSub.prereq || "None";

        // Determine Course Status
        let status: CourseStatus = "Remaining";
        let grade: string | number | null = null;
        let section = "";
        let termTaken = "";

        if (gradeEntry !== undefined) {
          status = "Completed";
          grade =
            typeof gradeEntry === "object" ? gradeEntry.grade : gradeEntry;
          section =
            (typeof gradeEntry === "object" && gradeEntry.section) ||
            studentData?.section ||
            "";
          termTaken =
            (typeof gradeEntry === "object" && gradeEntry.term) || "";
        } else if (enl) {
          if (enl.status === "Completed" || enl.grade) {
            status = "Completed";
            grade = enl.grade ?? "Passed";
          } else if (enl.status === "Enrolled" || enl.source === "block") {
            status = "Enrolled";
          } else {
            status = "Added";
          }
          section =
            enl.section ||
            studentData?.section ||
            studentData?.academic?.section ||
            "";
          termTaken =
            enl.schoolYear && enl.enrolledTerm
              ? `${enl.schoolYear} • ${enl.enrolledTerm}`
              : enl.enrolledTerm || activeTerm;
        }

        // Check if prerequisites are satisfied
        const prereqList =
          !prereq || prereq === "None"
            ? []
            : prereq
                .split(",")
                .map((p: string) => p.replace(/\(.*?\)/g, "").trim())
                .filter(Boolean);

        const prereqMet =
          prereqList.length === 0 ||
          prereqList.every((reqCode: string) => completedCodes.has(reqCode));

        const item: LedgerCourse = {
          code,
          title,
          units,
          prereq,
          year: t.year,
          term: t.term,
          status,
          grade,
          section,
          termTaken,
          prereqMet,
        };

        flatCourses.push(item);
        return item;
      });

      return {
        year: t.year,
        term: t.term,
        block: t.block,
        courses,
      };
    });

    return {
      termBlocks: blocks,
      allLedgerCourses: flatCourses,
      availableYears: ["All Years", ...Array.from(yearsSet)],
    };
  }, [curriculum, subjectsMap, enlistmentsMap, studentData, activeTerm]);

  // 4. Calculate Academic Progress & Running GWA
  const stats = useMemo(() => {
    const totalUnits = allLedgerCourses.reduce((s, c) => s + c.units, 0);
    const completedCourses = allLedgerCourses.filter(
      (c) => c.status === "Completed"
    );
    const enrolledCourses = allLedgerCourses.filter(
      (c) => c.status === "Enrolled"
    );
    const addedCourses = allLedgerCourses.filter((c) => c.status === "Added");

    const earnedUnits = completedCourses.reduce((s, c) => s + c.units, 0);
    const enrolledUnits = enrolledCourses.reduce((s, c) => s + c.units, 0);
    const remainingUnits = Math.max(0, totalUnits - earnedUnits - enrolledUnits);
    const progressPct =
      totalUnits > 0 ? Math.round((earnedUnits / totalUnits) * 100) : 0;

    // Weighted GWA calculation for numeric grades
    let weightedSum = 0;
    let gradedUnits = 0;
    completedCourses.forEach((c) => {
      const num = parseFloat(String(c.grade ?? ""));
      if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
        weightedSum += num * c.units;
        gradedUnits += c.units;
      }
    });
    const gwa = gradedUnits > 0 ? (weightedSum / gradedUnits).toFixed(2) : "—";

    return {
      totalCourses: allLedgerCourses.length,
      totalUnits,
      completedCount: completedCourses.length,
      earnedUnits,
      enrolledCount: enrolledCourses.length,
      enrolledUnits,
      addedCount: addedCourses.length,
      remainingUnits,
      progressPct,
      gwa,
    };
  }, [allLedgerCourses]);

  // 5. Filter Term Blocks for Display
  const visibleTermBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return termBlocks
      .filter((tb) => selectedYear === "All Years" || tb.year === selectedYear)
      .map((tb) => {
        const filteredCourses = tb.courses.filter((c) => {
          const matchesStatus =
            statusFilter === "All" || c.status === statusFilter;
          const matchesSearch =
            !q ||
            c.code.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.prereq.toLowerCase().includes(q);
          return matchesStatus && matchesSearch;
        });

        return { ...tb, courses: filteredCourses };
      })
      .filter((tb) => tb.courses.length > 0);
  }, [termBlocks, selectedYear, statusFilter, searchQuery]);

  if (!role || isLoading) {
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
          Loading academic records...
        </div>
      </div>
    );
  }

  const studentName = studentData
    ? `${studentData.firstName || studentData.personal?.firstName || ""} ${
        studentData.lastName || studentData.personal?.lastName || ""
      }`.trim()
    : localStorage.getItem("mock_user_name") || "Student";

  const programTitle =
    studentData?.program ||
    studentData?.academic?.program ||
    curriculum?.program ||
    "BS Computer Science";

  const studentYearLevel =
    studentData?.yearLevel || studentData?.academic?.yearLevel || "1st Year";

  const studentSection =
    studentData?.section || studentData?.academic?.section || "—";

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      <Navbar />

      <main className="flex-1 overflow-y-auto">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="mx-auto w-full max-w-6xl p-4 sm:p-8 lg:p-10">
          {/* Header Banner */}
          <header className="mb-6 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  <span>{programTitle}</span>
                  <span>•</span>
                  <span>{studentYearLevel}</span>
                  <span>•</span>
                  <span className="font-mono">{studentSection}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">
                  Curriculum &amp; Academic Records
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Official flowchart checklist for{" "}
                  <span className="font-semibold text-zinc-700">
                    {studentName}
                  </span>{" "}
                  ({userId}) — {activeSchoolYear} • {activeTerm}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/schedule"
                  className="border border-emerald-800 bg-white px-4 py-2.5 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-50"
                >
                  View Timetable
                </Link>
                <Link
                  href="/catalog"
                  className="border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-800"
                >
                  Go to Subject Enlistment →
                </Link>
              </div>
            </div>
          </header>

          {/* Summary Analytics Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-4 shadow-xs">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-800" />
              <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Units Earned
              </p>
              <p className="mt-2 pl-1 font-mono text-2xl font-bold text-emerald-950">
                {stats.earnedUnits}{" "}
                <span className="text-xs font-medium text-zinc-400">
                  / {stats.totalUnits} u
                </span>
              </p>
              <p className="mt-1 pl-1 text-xs font-medium text-emerald-800">
                {stats.completedCount} of {stats.totalCourses} courses completed (
                {stats.progressPct}%)
              </p>
            </div>

            <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-4 shadow-xs">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600" />
              <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Currently Enrolled
              </p>
              <p className="mt-2 pl-1 font-mono text-2xl font-bold text-emerald-950">
                {stats.enrolledUnits}{" "}
                <span className="text-xs font-medium text-zinc-400">units</span>
              </p>
              <p className="mt-1 pl-1 text-xs font-medium text-zinc-600">
                {stats.enrolledCount} active course
                {stats.enrolledCount === 1 ? "" : "s"} this term
              </p>
            </div>

            <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-4 shadow-xs">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
              <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Remaining Load
              </p>
              <p className="mt-2 pl-1 font-mono text-2xl font-bold text-emerald-950">
                {stats.remainingUnits}{" "}
                <span className="text-xs font-medium text-zinc-400">units</span>
              </p>
              <p className="mt-1 pl-1 text-xs font-medium text-zinc-600">
                To complete degree flowchart
              </p>
            </div>

            <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-4 shadow-xs">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-950" />
              <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Cumulative GWA
              </p>
              <p className="mt-2 pl-1 font-mono text-2xl font-bold text-emerald-950">
                {stats.gwa}
              </p>
              <p className="mt-1 pl-1 text-xs font-medium text-zinc-500">
                {stats.gwa === "—"
                  ? "Grades posted at end of term"
                  : "Official weighted average"}
              </p>
            </div>
          </div>

          {/* Non-Native Filter Controls */}
          <section className="mb-6 border border-emerald-900/15 bg-white p-4 shadow-xs space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Year Level Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {availableYears.map((yr) => {
                  const active = selectedYear === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className={`border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                        active
                          ? "border-emerald-900 bg-emerald-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-emerald-50"
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>

              {/* Status Filter Segmented Bar */}
              <div className="inline-flex flex-wrap border border-zinc-300 bg-white">
                {(
                  ["All", "Enrolled", "Completed", "Added", "Remaining"] as const
                ).map((st) => {
                  const active = statusFilter === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                        active
                          ? "bg-emerald-900 text-white"
                          : "text-zinc-600 hover:bg-emerald-50"
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="h-3 w-1 bg-emerald-700" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search course code, title, or prerequisite..."
                className="w-full border border-zinc-300 bg-zinc-50/50 pl-6 pr-3 py-2 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-800 focus:bg-white focus:outline-none"
              />
            </div>
          </section>

          {/* Term-by-Term Curriculum Tables */}
          {visibleTermBlocks.length === 0 ? (
            <div className="border border-emerald-900/15 bg-white px-6 py-16 text-center shadow-xs">
              <div className="mx-auto mb-3 h-3 w-12 bg-emerald-800/20" />
              <p className="text-sm font-semibold text-zinc-700">
                No curriculum courses match your current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedYear("All Years");
                  setStatusFilter("All");
                  setSearchQuery("");
                }}
                className="mt-3 text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {visibleTermBlocks.map((tb) => {
                const termUnits = tb.courses.reduce((s, c) => s + c.units, 0);
                const isCurrentStudentTerm =
                  tb.year === studentYearLevel && tb.term === activeTerm;

                return (
                  <section
                    key={`${tb.year}-${tb.term}`}
                    className={`border bg-white shadow-xs ${
                      isCurrentStudentTerm
                        ? "border-emerald-700 ring-1 ring-emerald-700/20"
                        : "border-emerald-900/15"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-emerald-950/[0.02] px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-5 w-1.5 ${
                            isCurrentStudentTerm
                              ? "bg-emerald-600"
                              : "bg-emerald-900"
                          }`}
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-bold uppercase tracking-tight text-emerald-950">
                              {tb.year} — {tb.term}
                            </h2>
                            {isCurrentStudentTerm && (
                              <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                                Current Term
                              </span>
                            )}
                            {tb.block && (
                              <span className="border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                                Fixed Block Term
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-950">
                        {termUnits} Units
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-emerald-900/10 bg-zinc-50/70 text-[11px] uppercase tracking-wider text-zinc-500">
                          <tr>
                            <th className="px-6 py-3 font-bold">Code</th>
                            <th className="px-6 py-3 font-bold">Course Title</th>
                            <th className="px-6 py-3 font-bold">Units</th>
                            <th className="px-6 py-3 font-bold">Prerequisite</th>
                            <th className="px-6 py-3 font-bold">Term / Section</th>
                            <th className="px-6 py-3 font-bold text-right">
                              Status / Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {tb.courses.map((course) => (
                            <tr
                              key={course.code}
                              className="transition-colors hover:bg-emerald-50/30"
                            >
                              <td className="px-6 py-3.5">
                                <span className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-950">
                                  <span className="h-2 w-1 bg-emerald-700" />
                                  {course.code}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 font-semibold text-zinc-900 whitespace-normal min-w-[240px]">
                                {course.title}
                              </td>
                              <td className="px-6 py-3.5 font-mono text-xs font-bold text-zinc-700">
                                {course.units}.0
                              </td>
                              <td className="px-6 py-3.5 text-xs">
                                {course.prereq === "None" ? (
                                  <span className="text-zinc-400">None</span>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-semibold text-zinc-700">
                                      {course.prereq}
                                    </span>
                                    {course.status === "Remaining" &&
                                      !course.prereqMet && (
                                        <span
                                          title="Complete prerequisite first"
                                          className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800"
                                        >
                                          Locked
                                        </span>
                                      )}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3.5 font-mono text-xs text-zinc-600">
                                {course.status === "Remaining" ? (
                                  <span className="text-zinc-400">—</span>
                                ) : (
                                  <div>
                                    <span className="font-bold text-zinc-800">
                                      {course.section || studentSection}
                                    </span>
                                    {course.termTaken && (
                                      <span className="block text-[10px] text-zinc-500">
                                        {course.termTaken}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                {course.status === "Completed" && (
                                  <span className="inline-flex items-center gap-1.5 border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-900">
                                    <span className="h-1.5 w-1.5 bg-emerald-700" />
                                    Grade: {course.grade}
                                  </span>
                                )}
                                {course.status === "Enrolled" && (
                                  <span className="inline-flex items-center gap-1.5 bg-emerald-900 px-2.5 py-1 text-xs font-bold text-white">
                                    <span className="h-1.5 w-1.5 bg-emerald-400" />
                                    Enrolled
                                  </span>
                                )}
                                {course.status === "Added" && (
                                  <span className="inline-flex items-center gap-1.5 border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-900">
                                    <span className="h-1.5 w-1.5 bg-sky-600" />
                                    Added (Unconfirmed)
                                  </span>
                                )}
                                {course.status === "Remaining" && (
                                  <span className="inline-flex items-center gap-1.5 border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-500">
                                    Not Taken
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}