"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";
import {
  AcademicConfig,
  DEFAULT_ACADEMIC_CONFIG,
  getAcademicConfig,
} from "@/lib/academicConfig";

const PROGRAMS = [
  "BS Computer Science",
  "BS Information Technology",
  "BS Information Systems",
  "BSBA Marketing Management",
];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const ENROLLMENT_STATUSES = ["Regular", "Irregular", "Returnee", "Transferee"];
const TERMS: AcademicConfig["currentTerm"][] = [
  "1st Trimester",
  "2nd Trimester",
  "3rd Trimester",
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

const REQUIREMENTS = [
  { key: "psaBirthCertificate", label: "PSA Birth Certificate" },
  { key: "form138", label: "Form 138 / Report Card" },
  { key: "goodMoral", label: "Certificate of Good Moral Character" },
  { key: "medicalCertificate", label: "Medical Certificate" },
  { key: "idPictures", label: "2x2 ID Pictures" },
  { key: "transcriptOfRecords", label: "Transcript of Records (Transferees)" },
  { key: "honorableDismissal", label: "Honorable Dismissal (Transferees)" },
];

const STUDENTS_PER_PAGE = 15;

export default function AdminDashboardPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Global Academic Term Config
  const [academicConfig, setAcademicConfig] = useState<AcademicConfig>(
    DEFAULT_ACADEMIC_CONFIG
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [rolloverTerm, setRolloverTerm] =
    useState<AcademicConfig["currentTerm"]>("2nd Trimester");
  const [rolloverSchoolYear, setRolloverSchoolYear] = useState(
    DEFAULT_ACADEMIC_CONFIG.schoolYear
  );
  const [resetClearancesOnRollover, setResetClearancesOnRollover] = useState(true);
  const [unlockBlocksOnRollover, setUnlockBlocksOnRollover] = useState(true);
  const [promoteYearsOnRollover, setPromoteYearsOnRollover] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);

  // Directory Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProgram, setFilterProgram] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [filterClearance, setFilterClearance] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Modal States
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function showToast(type: "success" | "error", text: string) {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  }

  // 1. Verify Role & Session
  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "admin") {
      router.push("/");
      return;
    }
    setRole(storedRole);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && process.env.NODE_ENV !== "development") {
        console.warn("No Firebase session active.");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch All Students & Global Academic Config
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [config, studentsSnap] = await Promise.all([
          getAcademicConfig(),
          getDocs(query(collection(db, "students"), orderBy("createdAt", "desc"))),
        ]);

        setAcademicConfig(config);
        setRolloverSchoolYear(config.schoolYear);
        const nextTermIdx = (TERMS.indexOf(config.currentTerm) + 1) % TERMS.length;
        setRolloverTerm(TERMS[nextTermIdx]);

        const list = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStudents(list);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (role === "admin") {
      fetchDashboardData();
    }
  }, [role]);

  // Save changes to Global Academic Config (Term, SY, Open/Closed)
  async function handleUpdateAcademicConfig(patch: Partial<AcademicConfig>) {
    const nextConfig: AcademicConfig = {
      ...academicConfig,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setAcademicConfig(nextConfig);
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, "settings", "academic"), nextConfig, { merge: true });
      showToast(
        "success",
        `System updated: ${nextConfig.schoolYear} • ${nextConfig.currentTerm} (${
          nextConfig.enrollmentOpen ? "Enrollment Open" : "Enrollment Closed"
        })`
      );
    } catch (error) {
      console.error("Error updating academic config:", error);
      showToast("error", "Couldn't update term settings.");
    } finally {
      setIsSavingConfig(false);
    }
  }

  // Execute Term Rollover (Batch update students + update global term)
  async function handleTermRollover(e: React.FormEvent) {
    e.preventDefault();
    setIsRollingOver(true);

    try {
      const now = new Date().toISOString();
      const pendingClearances: Record<string, string> = {};
      CLEARANCE_GATES.forEach(({ key }) => (pendingClearances[key] = "pending"));

      const nextYearMap: Record<string, string> = {
        "1st Year": "2nd Year",
        "2nd Year": "3rd Year",
        "3rd Year": "4th Year",
        "4th Year": "4th Year",
        "5th Year": "5th Year",
      };

      // Update students in chunks of 450
      const updatedLocalStudents = [...students];
      for (let i = 0; i < students.length; i += 450) {
        const batch = writeBatch(db);
        const slice = students.slice(i, i + 450);

        slice.forEach((st, idx) => {
          const docId = st.id || st.studentId;
          const ref = doc(db, "students", docId);
          const patch: Record<string, any> = { updatedAt: now };

          if (resetClearancesOnRollover) {
            patch.clearances = pendingClearances;
          }
          if (unlockBlocksOnRollover) {
            patch.blockEnrolled = false;
          }
          if (promoteYearsOnRollover) {
            const currentYr = st.yearLevel || st.academic?.yearLevel || "1st Year";
            const promotedYr = nextYearMap[currentYr] || currentYr;
            patch.yearLevel = promotedYr;
            patch.academic = { ...(st.academic || {}), yearLevel: promotedYr };
          }

          batch.update(ref, patch);
          updatedLocalStudents[i + idx] = { ...st, ...patch };
        });

        await batch.commit();
      }

      const nextConfig: AcademicConfig = {
        ...academicConfig,
        schoolYear: rolloverSchoolYear.trim(),
        currentTerm: rolloverTerm,
        enrollmentOpen: true,
        updatedAt: now,
      };
      await setDoc(doc(db, "settings", "academic"), nextConfig, { merge: true });

      setStudents(updatedLocalStudents);
      setAcademicConfig(nextConfig);
      setRolloverOpen(false);
      showToast(
        "success",
        `Rolled over to ${nextConfig.schoolYear} (${nextConfig.currentTerm}).`
      );
    } catch (error) {
      console.error("Rollover failed:", error);
      showToast("error", "Term rollover failed. Please try again.");
    } finally {
      setIsRollingOver(false);
    }
  }

  // 3. Open Edit Modal with normalized default fields
  function openEditModal(student: any) {
    const defaultClearances: Record<string, string> = {};
    CLEARANCE_GATES.forEach(({ key }) => {
      defaultClearances[key] = student.clearances?.[key] || "pending";
    });

    const defaultRequirements: Record<string, boolean> = {};
    REQUIREMENTS.forEach(({ key }) => {
      defaultRequirements[key] = !!student.requirements?.[key];
    });

    setEditingStudent({
      ...student,
      firstName: student.firstName || student.personal?.firstName || "",
      lastName: student.lastName || student.personal?.lastName || "",
      email: student.email || student.contact?.email || "",
      program:
        student.program || student.academic?.program || "BS Computer Science",
      yearLevel: student.yearLevel || student.academic?.yearLevel || "1st Year",
      section: student.academic?.section || student.section || "",
      enrollmentStatus:
        student.enrollmentStatus || student.academic?.enrollmentStatus || "Regular",
      maxUnits:
        student.maxUnits ?? student.academic?.maxUnits ?? academicConfig.maxUnitsDefault,
      blockEnrolled:
        student.blockEnrolled !== undefined
          ? student.blockEnrolled
          : (student.yearLevel || "1st Year") === "1st Year" &&
            (student.enrollmentStatus || "Regular") === "Regular",
      clearances: defaultClearances,
      requirements: defaultRequirements,
    });
  }

  function handleClearanceToggle(gate: string) {
    if (!editingStudent) return;
    setEditingStudent((prev: any) => ({
      ...prev,
      clearances: {
        ...prev.clearances,
        [gate]: prev.clearances[gate] === "cleared" ? "pending" : "cleared",
      },
    }));
  }

  function handleRequirementToggle(reqKey: string) {
    if (!editingStudent) return;
    setEditingStudent((prev: any) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        [reqKey]: !prev.requirements[reqKey],
      },
    }));
  }

  // 4. Save Edited Student Profile to Firestore
  async function handleSaveStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;

    setIsSaving(true);
    try {
      const docId = editingStudent.id || editingStudent.studentId;
      const studentRef = doc(db, "students", docId);
      const now = new Date().toISOString();
      const parsedMaxUnits = Number(editingStudent.maxUnits) || 21;

      const updatedPayload = {
        firstName: editingStudent.firstName.trim(),
        lastName: editingStudent.lastName.trim(),
        email: editingStudent.email.trim().toLowerCase(),
        program: editingStudent.program,
        yearLevel: editingStudent.yearLevel,
        enrollmentStatus: editingStudent.enrollmentStatus,
        maxUnits: parsedMaxUnits,
        blockEnrolled: !!editingStudent.blockEnrolled,
        clearances: editingStudent.clearances,
        requirements: editingStudent.requirements,
        personal: {
          ...(editingStudent.personal || {}),
          firstName: editingStudent.firstName.trim(),
          lastName: editingStudent.lastName.trim(),
        },
        contact: {
          ...(editingStudent.contact || {}),
          email: editingStudent.email.trim().toLowerCase(),
        },
        academic: {
          ...(editingStudent.academic || {}),
          program: editingStudent.program,
          yearLevel: editingStudent.yearLevel,
          section: editingStudent.section.trim(),
          enrollmentStatus: editingStudent.enrollmentStatus,
          maxUnits: parsedMaxUnits,
          blockEnrolled: !!editingStudent.blockEnrolled,
        },
        updatedAt: now,
      };

      await updateDoc(studentRef, updatedPayload);

      setStudents((prev) =>
        prev.map((s) => (s.id === docId ? { ...s, ...updatedPayload } : s))
      );

      showToast(
        "success",
        `Saved changes for student no. ${editingStudent.studentId}.`
      );
      setEditingStudent(null);
    } catch (error) {
      console.error("Error updating student profile:", error);
      showToast("error", "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterProgram, filterYear, filterClearance]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase();
      const fullName = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
      const id = (s.studentId || "").toLowerCase();
      const prog = (s.program || "").toLowerCase();
      const sec = (s.academic?.section || s.section || "").toLowerCase();
      const matchesSearch =
        fullName.includes(q) || id.includes(q) || prog.includes(q) || sec.includes(q);

      const matchesProgram =
        filterProgram === "All" || s.program === filterProgram;
      const matchesYear = filterYear === "All" || s.yearLevel === filterYear;

      const cObj = s.clearances || {};
      const isCleared = CLEARANCE_GATES.every((g) => cObj[g.key] === "cleared");
      const matchesClearance =
        filterClearance === "All" ||
        (filterClearance === "Cleared" && isCleared) ||
        (filterClearance === "Pending" && !isCleared);

      return matchesSearch && matchesProgram && matchesYear && matchesClearance;
    });
  }, [students, searchQuery, filterProgram, filterYear, filterClearance]);

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE
  );

  const fullyClearedStudents = useMemo(() => {
    return students.filter((student) => {
      const c = student.clearances || {};
      return CLEARANCE_GATES.every((g) => c[g.key] === "cleared");
    }).length;
  }, [students]);

  if (!role || isLoading)
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
          Loading admin dashboard...
        </div>
      </div>
    );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`flex items-center border bg-white shadow-xl ${
              toastMessage.type === "error"
                ? "border-red-200 text-red-900"
                : "border-emerald-200 text-emerald-950"
            }`}
          >
            <div
              className={`w-2 self-stretch ${
                toastMessage.type === "error" ? "bg-red-600" : "bg-emerald-700"
              }`}
            />
            <div className="px-4 py-3 text-sm font-semibold">
              {toastMessage.text}
            </div>
          </div>
        </div>
      )}

      {/* Reusable Admin Navbar */}
      <AdminNavbar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto">
          {/* DLSAU Hero Banner */}
          <header className="relative mb-6 overflow-hidden border border-emerald-900/15 bg-emerald-900 text-white shadow-sm">
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-48 border-2 border-emerald-700/40 bg-emerald-800/30" />
            <div className="pointer-events-none absolute right-24 bottom-0 h-16 w-32 bg-emerald-800/50 border-t border-l border-emerald-600/30" />
            <div className="pointer-events-none absolute right-6 bottom-6 h-8 w-8 bg-emerald-500/20 border border-emerald-400/30" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="mt-1 hidden sm:block h-14 w-2 shrink-0 bg-white" />
                <div>
                  <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200 mb-2">
                    <span className="h-2 w-2 bg-emerald-400" />
                    De La Salle Araneta University • Admin
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                    Student Records & Clearance
                  </h1>
                  <p className="mt-1 text-sm text-emerald-100/80 max-w-xl">
                    Add student records, manage active trimester enrollment, check requirements, and update clearance status.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRolloverOpen(true)}
                  className="shrink-0 inline-flex items-center justify-center gap-2 border border-emerald-400/60 bg-emerald-950/70 px-4 py-3 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-800"
                >
                  Start New Term ↻
                </button>
                <Link
                  href="/admin/students/new"
                  className="shrink-0 inline-flex items-center justify-center gap-2.5 bg-white px-5 py-3 text-sm font-bold text-emerald-950 transition-all hover:bg-emerald-50 shadow-sm active:translate-y-px border-l-4 border-emerald-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4 text-emerald-800"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Add Student
                </Link>
              </div>
            </div>
          </header>

          {/* Global Academic Term & Enrollment Control Bar */}
          <section className="mb-8 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-6 w-2 bg-emerald-800" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">
                    Active Academic Term & Enrollment Period
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Controls which trimester is active in the Subject Catalog and whether students can enlist.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">
                    School Year
                  </label>
                  <input
                    type="text"
                    value={academicConfig.schoolYear}
                    onChange={(e) =>
                      setAcademicConfig({ ...academicConfig, schoolYear: e.target.value })
                    }
                    onBlur={() =>
                      handleUpdateAcademicConfig({ schoolYear: academicConfig.schoolYear })
                    }
                    className="w-28 border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold focus:border-emerald-800 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">
                    Active Term
                  </label>
                  <select
                    value={academicConfig.currentTerm}
                    disabled={isSavingConfig}
                    onChange={(e) =>
                      handleUpdateAcademicConfig({
                        currentTerm: e.target.value as AcademicConfig["currentTerm"],
                      })
                    }
                    className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-950 focus:border-emerald-800 focus:outline-none"
                  >
                    {TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isSavingConfig}
                  onClick={() =>
                    handleUpdateAcademicConfig({
                      enrollmentOpen: !academicConfig.enrollmentOpen,
                    })
                  }
                  className={`border-l-4 px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    academicConfig.enrollmentOpen
                      ? "border-emerald-400 bg-emerald-900 text-white hover:bg-emerald-800"
                      : "border-red-400 bg-red-800 text-white hover:bg-red-700"
                  }`}
                >
                  {academicConfig.enrollmentOpen
                    ? "Enrollment: Open (Click to Close)"
                    : "Enrollment: Closed (Click to Open)"}
                </button>
              </div>
            </div>
          </section>

          {/* Top Analytics Row */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-8">
            <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-6 shadow-xs">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-800" />
              <div className="absolute right-4 top-4 h-6 w-10 bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
                <span className="h-2 w-4 bg-emerald-700" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Total Students
              </h3>
              <p className="mt-3 text-3xl font-bold text-emerald-950 font-mono">
                {students.length}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-800">
                <span className="inline-block h-2 w-2 bg-emerald-600" />
                Records on file
              </div>
            </div>

            <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-6 shadow-xs">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600" />
              <div className="absolute right-4 top-4 h-6 w-10 bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
                <span className="h-2 w-4 bg-emerald-500" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Fully Cleared Students
              </h3>
              <p className="mt-3 text-3xl font-bold text-emerald-950 font-mono">
                {fullyClearedStudents}{" "}
                <span className="text-lg font-normal text-zinc-400">
                  / {students.length}
                </span>
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-600">
                <span className="inline-block h-2 w-2 bg-emerald-500" />
                Eligible for {academicConfig.currentTerm} enrollment
              </div>
            </div>

            <div className="relative overflow-hidden border border-emerald-900/10 bg-white p-6 shadow-xs">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-950" />
              <div
                className={`absolute right-4 top-4 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white ${
                  academicConfig.enrollmentOpen ? "bg-emerald-900" : "bg-red-700"
                }`}
              >
                {academicConfig.enrollmentOpen ? "OPEN" : "CLOSED"}
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                {academicConfig.schoolYear} • {academicConfig.currentTerm}
              </h3>
              <p
                className={`mt-3 text-3xl font-bold ${
                  academicConfig.enrollmentOpen ? "text-emerald-800" : "text-red-700"
                }`}
              >
                {academicConfig.enrollmentOpen ? "Open" : "Closed"}
              </p>
              <div className="mt-3 h-2 w-full bg-emerald-50 border border-emerald-100">
                <div
                  className={`h-full ${
                    academicConfig.enrollmentOpen ? "bg-emerald-700" : "bg-red-600"
                  }`}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          {/* Student Directory Section */}
          <section className="border border-emerald-900/15 bg-white shadow-xs">
            <div className="border-b border-zinc-200 bg-white px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-6 w-2 bg-emerald-800" />
                <div>
                  <h2 className="text-base font-bold text-zinc-900 uppercase tracking-tight">
                    Student List ({filteredStudents.length})
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Click &ldquo;Edit&rdquo; to update a student&apos;s details, term unit cap, clearance, or requirements.
                  </p>
                </div>
              </div>

              {/* Search & Multi-Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="h-3 w-1 bg-emerald-700" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search no., name, section..."
                    className="w-full border border-zinc-300 bg-zinc-50/50 pl-6 pr-3 py-2 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-800 focus:bg-white focus:outline-none"
                  />
                </div>

                <select
                  value={filterProgram}
                  onChange={(e) => setFilterProgram(e.target.value)}
                  className="border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold text-zinc-700 focus:border-emerald-800 focus:outline-none"
                >
                  <option value="All">All Programs</option>
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold text-zinc-700 focus:border-emerald-800 focus:outline-none"
                >
                  <option value="All">All Years</option>
                  {YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <select
                  value={filterClearance}
                  onChange={(e) => setFilterClearance(e.target.value)}
                  className="border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold text-zinc-700 focus:border-emerald-800 focus:outline-none"
                >
                  <option value="All">All Clearances</option>
                  <option value="Cleared">Fully Cleared</option>
                  <option value="Pending">Has Pending</option>
                </select>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 h-3 w-12 bg-emerald-800/20" />
                <p className="text-sm font-semibold text-zinc-700">No students found.</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Adjust your filters or click &ldquo;Add Student&rdquo; above to add a new record.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="border-b border-emerald-900/10 bg-emerald-950/[0.03] text-[11px] uppercase tracking-wider text-emerald-950">
                      <tr>
                        <th className="px-6 py-3.5 font-bold">Student No.</th>
                        <th className="px-6 py-3.5 font-bold">Name</th>
                        <th className="px-6 py-3.5 font-bold">Program / Section</th>
                        <th className="px-6 py-3.5 font-bold">Year Level</th>
                        <th className="px-6 py-3.5 font-bold">Clearance</th>
                        <th className="px-6 py-3.5 font-bold">Status</th>
                        <th className="px-6 py-3.5 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {paginatedStudents.map((student) => {
                        const clearancesObj = student.clearances || {};
                        const clearedCount = CLEARANCE_GATES.filter(
                          (g) => clearancesObj[g.key] === "cleared"
                        ).length;
                        const isAllCleared = clearedCount === CLEARANCE_GATES.length;
                        const sectionLabel =
                          student.academic?.section || student.section;
                        const isBlock = student.blockEnrolled;

                        return (
                          <tr
                            key={student.id}
                            className="group hover:bg-emerald-50/40 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="inline-flex items-center gap-2 font-mono text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-200 px-2.5 py-1">
                                <span className="h-2 w-1 bg-emerald-700" />
                                {student.studentId}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-zinc-900">
                                {student.firstName} {student.lastName}
                              </div>
                              <div className="text-xs text-zinc-500 font-mono">
                                {student.email || student.contact?.email || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-zinc-800">
                                {student.program}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {sectionLabel && (
                                  <span className="inline-block bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-600">
                                    {sectionLabel}
                                  </span>
                                )}
                                {isBlock && (
                                  <span className="inline-block border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                    Fixed Block
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-zinc-700 font-medium">
                              {student.yearLevel}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5 w-36">
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className={`font-bold ${
                                      isAllCleared
                                        ? "text-emerald-800"
                                        : "text-amber-700"
                                    }`}
                                  >
                                    {clearedCount} / {CLEARANCE_GATES.length} Cleared
                                  </span>
                                </div>
                                <div className="grid grid-cols-8 gap-0.5">
                                  {CLEARANCE_GATES.map((g) => (
                                    <div
                                      key={g.key}
                                      title={`${g.label}: ${
                                        clearancesObj[g.key] || "pending"
                                      }`}
                                      className={`h-1.5 ${
                                        clearancesObj[g.key] === "cleared"
                                          ? "bg-emerald-600"
                                          : "bg-zinc-200"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-bold ${
                                  student.enrollmentStatus === "Regular"
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                    : "border-amber-300 bg-amber-50 text-amber-900"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 ${
                                    student.enrollmentStatus === "Regular"
                                      ? "bg-emerald-700"
                                      : "bg-amber-600"
                                  }`}
                                />
                                {student.enrollmentStatus || "Regular"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => openEditModal(student)}
                                className="inline-flex items-center gap-2 border border-emerald-800 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-900 transition-all hover:bg-emerald-800 hover:text-white"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-emerald-50 disabled:opacity-40"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs font-bold text-zinc-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-emerald-50 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* Start New Term / Rollover Modal */}
      {rolloverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-xs">
          <div className="flex w-full max-w-lg flex-col overflow-hidden border-2 border-emerald-900 bg-white shadow-2xl">
            <div className="h-2 w-full bg-emerald-800 flex">
              <div className="h-full w-24 bg-emerald-500" />
            </div>
            <div className="flex items-center justify-between border-b border-zinc-200 bg-emerald-900 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="h-7 w-1.5 bg-emerald-400" />
                <div>
                  <h2 className="text-base font-bold tracking-tight">
                    Start New Term (Trimester Rollover)
                  </h2>
                  <p className="text-xs text-emerald-200">
                    Prepare all {students.length} student records for the next enrollment period.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRolloverOpen(false)}
                className="border border-emerald-700 bg-emerald-800/60 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleTermRollover} className="p-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Target School Year
                  </label>
                  <input
                    required
                    value={rolloverSchoolYear}
                    onChange={(e) => setRolloverSchoolYear(e.target.value)}
                    placeholder="2026-2027"
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Target Trimester
                  </label>
                  <select
                    value={rolloverTerm}
                    onChange={(e) =>
                      setRolloverTerm(
                        e.target.value as AcademicConfig["currentTerm"]
                      )
                    }
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm font-bold focus:border-emerald-800 focus:outline-none"
                  >
                    {TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 border border-emerald-900/15 bg-emerald-50/40 p-4">
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetClearancesOnRollover}
                    onChange={(e) => setResetClearancesOnRollover(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-emerald-800"
                  />
                  <div>
                    <span className="font-bold text-zinc-900 block">
                      Reset all student clearances to Pending
                    </span>
                    <span className="text-xs text-zinc-600">
                      Requires students to re-clear offices before enrolling in the new term.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 text-sm cursor-pointer pt-2 border-t border-emerald-900/10">
                  <input
                    type="checkbox"
                    checked={unlockBlocksOnRollover}
                    onChange={(e) => setUnlockBlocksOnRollover(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-emerald-800"
                  />
                  <div>
                    <span className="font-bold text-zinc-900 block">
                      Unlock 1st-term fixed block students
                    </span>
                    <span className="text-xs text-zinc-600">
                      Allows freshmen who were on a fixed block in the 1st Trimester to choose their own subjects now.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 text-sm cursor-pointer pt-2 border-t border-emerald-900/10">
                  <input
                    type="checkbox"
                    checked={promoteYearsOnRollover}
                    onChange={(e) => setPromoteYearsOnRollover(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-emerald-800"
                  />
                  <div>
                    <span className="font-bold text-zinc-900 block">
                      Promote student Year Levels (+1 Year)
                    </span>
                    <span className="text-xs text-zinc-600">
                      Only check this when starting a new School Year (1st Trimester).
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setRolloverOpen(false)}
                  className="border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRollingOver}
                  className="border-l-4 border-emerald-400 bg-emerald-900 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {isRollingOver ? "Rolling Over..." : "Confirm & Start Term"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Profile Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border-2 border-emerald-900 bg-white shadow-2xl">
            <div className="h-2 w-full bg-emerald-800 flex">
              <div className="h-full w-24 bg-emerald-500" />
            </div>

            <div className="flex items-center justify-between border-b border-zinc-200 bg-emerald-900 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1.5 bg-emerald-400" />
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Edit Student Record
                  </h2>
                  <p className="text-xs font-mono text-emerald-200">
                    Student No.: {editingStudent.studentId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="border border-emerald-700 bg-emerald-800/60 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Close ✕
              </button>
            </div>

            <form
              onSubmit={handleSaveStudent}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {/* Basic Information */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-4 w-1.5 bg-emerald-800" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                    Student Information & Term Controls
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-emerald-50/30 border border-emerald-900/10 p-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      First Name
                    </label>
                    <input
                      required
                      value={editingStudent.firstName}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          firstName: e.target.value,
                        })
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Last Name
                    </label>
                    <input
                      required
                      value={editingStudent.lastName}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          lastName: e.target.value,
                        })
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-zinc-700">
                      School Email
                    </label>
                    <input
                      required
                      type="email"
                      value={editingStudent.email}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          email: e.target.value,
                        })
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Program
                    </label>
                    <select
                      value={editingStudent.program}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          program: e.target.value,
                        })
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none"
                    >
                      {PROGRAMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Year Level
                    </label>
                    <select
                      value={editingStudent.yearLevel}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          yearLevel: e.target.value,
                        })
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none"
                    >
                      {YEAR_LEVELS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Section
                    </label>
                    <input
                      value={editingStudent.section}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          section: e.target.value,
                        })
                      }
                      placeholder="e.g. BSCS1A"
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Enrollment Status
                    </label>
                    <select
                      value={editingStudent.enrollmentStatus}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          enrollmentStatus: e.target.value,
                        })
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none"
                    >
                      {ENROLLMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      Max Units Allowed (Overload Override)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={30}
                      value={editingStudent.maxUnits}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          maxUnits: Number(e.target.value),
                        })
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2.5 border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editingStudent.blockEnrolled}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            blockEnrolled: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-emerald-800"
                      />
                      Fixed Block Schedule (Lock Add/Drop)
                    </label>
                  </div>
                </div>
              </div>

              {/* Department Clearances Checkboxes */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1.5 bg-emerald-800" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Clearance Status ({academicConfig.currentTerm})
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const allCleared: Record<string, string> = {};
                        CLEARANCE_GATES.forEach(
                          ({ key }) => (allCleared[key] = "cleared")
                        );
                        setEditingStudent({
                          ...editingStudent,
                          clearances: allCleared,
                        });
                      }}
                      className="border border-emerald-700 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-800 hover:text-white transition-colors"
                    >
                      Mark All Cleared
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allPending: Record<string, string> = {};
                        CLEARANCE_GATES.forEach(
                          ({ key }) => (allPending[key] = "pending")
                        );
                        setEditingStudent({
                          ...editingStudent,
                          clearances: allPending,
                        });
                      }}
                      className="border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      Reset All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CLEARANCE_GATES.map(({ key, label }) => {
                    const isCleared =
                      editingStudent.clearances?.[key] === "cleared";
                    return (
                      <button
                        key={key}
                        type="button"
                        role="checkbox"
                        aria-checked={isCleared}
                        onClick={() => handleClearanceToggle(key)}
                        className={`relative flex items-center justify-between border px-3.5 py-2.5 text-left text-sm transition-all ${
                          isCleared
                            ? "border-emerald-700 bg-emerald-50/70 text-emerald-950"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-400"
                        }`}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${
                            isCleared ? "bg-emerald-700" : "bg-zinc-200"
                          }`}
                        />
                        <div className="flex items-center gap-2.5 pl-1">
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                              isCleared
                                ? "border-emerald-800 bg-emerald-800 text-white"
                                : "border-zinc-300 bg-white"
                            }`}
                          >
                            {isCleared && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-3 w-3"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="font-semibold">{label}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            isCleared
                              ? "bg-emerald-800 text-white"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isCleared ? "Cleared" : "Pending"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Admission Requirements Checkboxes */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-4 w-1.5 bg-emerald-800" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                    Submitted Requirements
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REQUIREMENTS.map(({ key, label }) => {
                    const received = !!editingStudent.requirements?.[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        role="checkbox"
                        aria-checked={received}
                        onClick={() => handleRequirementToggle(key)}
                        className={`relative flex items-center gap-2.5 border px-3.5 py-2.5 text-left text-sm transition-all ${
                          received
                            ? "border-emerald-700 bg-emerald-50/70 text-emerald-950"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-400"
                        }`}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${
                            received ? "bg-emerald-700" : "bg-zinc-200"
                          }`}
                        />
                        <span
                          className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center border ${
                            received
                              ? "border-emerald-800 bg-emerald-800 text-white"
                              : "border-zinc-300 bg-white"
                          }`}
                        >
                          {received && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-3 w-3"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="font-semibold truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="border-l-4 border-emerald-400 bg-emerald-900 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}