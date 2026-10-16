"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import RecommendedPanel from "@/components/catalog/RecommendedPanel";
import SubjectCard from "@/components/catalog/SubjectCard";
import EnlistmentBar from "@/components/catalog/EnlistmentBar";
import { getAcademicConfig } from "@/lib/academicConfig";

const ITEMS_PER_PAGE = 10;

const SELECTED_TAB = "My Subjects";
const CATEGORIES = [
  "All Subjects",
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "General Education",
  SELECTED_TAB,
];
const TERMS = ["1st Trimester", "2nd Trimester", "3rd Trimester"];
const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

type Toast = { type: "success" | "error"; text: string };

export default function SubjectCatalogPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [rawSubjects, setRawSubjects] = useState<any[]>([]);
  const [enlistedSubjects, setEnlistedSubjects] = useState<any[]>([]);
  const [enlistmentCounts, setEnlistmentCounts] = useState<Record<string, number>>({});
  const [enlistmentsLoaded, setEnlistmentsLoaded] = useState(false);

  // Dynamic Academic Config
  const [currentTerm, setCurrentTerm] = useState("1st Trimester");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [enrollmentOpen, setEnrollmentOpen] = useState(true);
  const [maxUnitsPerTerm, setMaxUnitsPerTerm] = useState(21);
  const [isBlockEnrolledFlag, setIsBlockEnrolledFlag] = useState<boolean | null>(null);
  const [hasPendingClearance, setHasPendingClearance] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Subjects");
  const [filterTerm, setFilterTerm] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [trayOpen, setTrayOpen] = useState(false);

  // Student + curriculum
  const [studentProgram, setStudentProgram] = useState<string | null>(null);
  const [studentYear, setStudentYear] = useState<string | null>(null);
  const [studentLoaded, setStudentLoaded] = useState(false);
  const [curriculum, setCurriculum] = useState<any | null>(null);
  const [curriculumLoaded, setCurriculumLoaded] = useState(false);

  // Recommended set controls
  const [recYear, setRecYear] = useState("1st Year");
  const [recTerm, setRecTerm] = useState("1st Trimester");
  const [recOpen, setRecOpen] = useState(true);
  const [isAddingSet, setIsAddingSet] = useState(false);

  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const autoEnrolled = useRef(false);

  function showToast(type: Toast["type"], text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  // Dynamically compute live slots for every subject based on real enlistments in Firestore
  const subjects = useMemo(() => {
    return rawSubjects.map((sub) => {
      const maxSlots = sub.max ?? 40;
      const taken = enlistmentCounts[sub.code] ?? 0;
      const liveSlots = Math.max(0, maxSlots - taken);
      return {
        ...sub,
        max: maxSlots,
        slots: liveSlots,
      };
    });
  }, [rawSubjects, enlistmentCounts]);

  // Sync the live enlistment counts back into the `subjects` collection in Firestore (dev tool)
  async function syncSubjectSlotsWithEnlistments() {
    try {
      const batch = writeBatch(db);
      subjects.forEach((sub) => {
        const docId = sub.id || sub.code;
        batch.update(doc(db, "subjects", docId), { slots: sub.slots });
      });
      await batch.commit();
      showToast("success", "Synced all subject slots with live enlistments.");
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to sync slots. Check console.");
    }
  }

  // ───────────── Derived tracking data ─────────────
  const enlistedCodes = useMemo(
    () => new Set(enlistedSubjects.map((s) => s.code)),
    [enlistedSubjects]
  );
  const currentUnits = enlistedSubjects.reduce((total, sub) => total + sub.units, 0);
  const unitPercentage = Math.min((currentUnits / maxUnitsPerTerm) * 100, 100);
  const unitsLeft = Math.max(maxUnitsPerTerm - currentUnits, 0);

  const enlistedByTerm = useMemo(() => {
    const groups: Record<string, any[]> = {};
    enlistedSubjects.forEach((s) => {
      const key = s.term || "Other";
      (groups[key] ||= []).push(s);
    });
    return groups;
  }, [enlistedSubjects]);

  // ───────────── Curriculum resolution ─────────────
  const termEntry = (year: string, term: string) =>
    curriculum?.terms?.find((t: any) => t.year === year && t.term === term);

  const resolveCodes = (codes: string[] = []) =>
    codes.map((c) => subjects.find((s) => s.code === c)).filter(Boolean) as any[];

  const hasCurriculum = !!curriculum;
  const recommended = resolveCodes(termEntry(recYear, recTerm)?.codes);

  const blockEntry = studentYear ? termEntry(studentYear, currentTerm) : undefined;
  const locked = isBlockEnrolledFlag !== false && !!blockEntry?.block;
  const blockSubjects = locked ? resolveCodes(blockEntry.codes) : [];

  const recToAdd = recommended.filter((s) => !enlistedCodes.has(s.code) && s.slots > 0);
  const recUnitsToAdd = recToAdd.reduce((t, s) => t + s.units, 0);
  const recTotalUnits = recommended.reduce((t, s) => t + s.units, 0);
  const recOverBy = Math.max(currentUnits + recUnitsToAdd - maxUnitsPerTerm, 0);

  // 1. Verify role & get consistent student identifier
  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "student") {
      router.push("/");
      return;
    }
    setRole(storedRole);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const storedId = localStorage.getItem("mock_user_id");
      setUserId(storedId || (user ? user.uid : "mock-student-id-123"));
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch catalog
  useEffect(() => {
    async function fetchCatalog() {
      setIsLoadingCatalog(true);
      try {
        const catalogQuery = query(collection(db, "subjects"), orderBy("year", "asc"));
        const snapshot = await getDocs(catalogQuery);
        setRawSubjects(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Failed to fetch catalog:", error);
      } finally {
        setIsLoadingCatalog(false);
      }
    }
    fetchCatalog();
  }, []);

  // 3. Real-time listener on `enlistments`: calculates live slot counts AND this student's subjects
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onSnapshot(
      collection(db, "enlistments"),
      (snapshot) => {
        const countsBySubjectUser = new Map<string, Set<string>>();
        const mySubjectsByCode = new Map<string, any>();

        snapshot.docs.forEach((d) => {
          const data = d.data();
          const code = data.code;
          const uid = data.userId;
          if (!code) return;

          if (!countsBySubjectUser.has(code)) {
            countsBySubjectUser.set(code, new Set());
          }
          countsBySubjectUser.get(code)!.add(uid || d.id);

          if (uid === userId) {
            mySubjectsByCode.set(code, data);
          }
        });

        const liveCounts: Record<string, number> = {};
        countsBySubjectUser.forEach((studentSet, code) => {
          liveCounts[code] = studentSet.size;
        });

        setEnlistmentCounts(liveCounts);
        setEnlistedSubjects(Array.from(mySubjectsByCode.values()));
        setEnlistmentsLoaded(true);
      },
      (error) => {
        console.error("Error listening to enlistments:", error);
        setEnlistmentsLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // 4. Load student's program, year level, clearances, and global academic config
  useEffect(() => {
    async function fetchStudent() {
      const studentNo = localStorage.getItem("mock_user_id");
      try {
        const config = await getAcademicConfig();
        setCurrentTerm(config.currentTerm);
        setSchoolYear(config.schoolYear);
        setEnrollmentOpen(config.enrollmentOpen);
        setRecTerm(config.currentTerm);

        if (!studentNo) {
          setStudentLoaded(true);
          return;
        }

        const snap = await getDoc(doc(db, "students", studentNo));
        if (snap.exists()) {
          const d = snap.data();
          const year = d.yearLevel || d.academic?.yearLevel || "1st Year";
          setStudentProgram(d.program || d.academic?.program || null);
          setStudentYear(year);
          setRecYear(year);
          setMaxUnitsPerTerm(d.maxUnits ?? d.academic?.maxUnits ?? config.maxUnitsDefault);
          setIsBlockEnrolledFlag(d.blockEnrolled ?? null);

          const clearances = d.clearances || {};
          const anyPending = Object.values(clearances).some((v) => v !== "cleared");
          setHasPendingClearance(anyPending);
        }
      } catch (error) {
        console.error("Failed to load student record or config:", error);
      } finally {
        setStudentLoaded(true);
      }
    }
    fetchStudent();
  }, []);

  // 5. Load curriculum for the student's program
  useEffect(() => {
    if (!studentLoaded) return;
    if (!studentProgram) {
      setCurriculumLoaded(true);
      return;
    }
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "curricula"), where("program", "==", studentProgram))
        );
        setCurriculum(snap.empty ? null : snap.docs[0].data());
      } catch (e) {
        console.error("Failed to load curriculum:", e);
      } finally {
        setCurriculumLoaded(true);
      }
    })();
  }, [studentLoaded, studentProgram]);

  // 6. Block term: auto-enroll student once & update Firestore slots
  useEffect(() => {
    if (!locked || !userId || !enlistmentsLoaded || isLoadingCatalog || autoEnrolled.current) return;
    autoEnrolled.current = true;
    setActiveCategory(SELECTED_TAB);

    const missing = blockSubjects.filter((b) => !enlistedCodes.has(b.code));
    if (missing.length === 0) return;

    (async () => {
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();

        missing.forEach((m) => {
          const { id: docId, ...rest } = m;
          const nextSlots = Math.max(0, m.slots - 1);
          batch.set(doc(db, "enlistments", `${userId}_${m.code}`), {
            ...rest,
            slots: nextSlots,
            userId,
            term: currentTerm,
            enlistedAt: now,
            source: "block",
            status: "Enrolled",
          });
          batch.update(doc(db, "subjects", docId || m.code), {
            slots: nextSlots,
          });
        });

        await batch.commit();
      } catch (error) {
        console.error(error);
        autoEnrolled.current = false;
        showToast("error", "Couldn't load your block subjects.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, userId, enlistmentsLoaded, isLoadingCatalog, currentTerm]);

  // Add one subject
  async function handleEnlist(subject: any) {
    if (locked || !userId || enlistedCodes.has(subject.code)) return;

    if (!enrollmentOpen) {
      showToast("error", "Enrollment is currently closed for this term.");
      return;
    }

    if (hasPendingClearance) {
      showToast("error", "You have pending clearances. Settle them first before enlisting.");
      return;
    }

    if (subject.slots <= 0) {
      showToast("error", `${subject.code} has no available slots left.`);
      return;
    }

    if (currentUnits + subject.units > maxUnitsPerTerm) {
      showToast("error", `Can't add ${subject.code}. It goes over your ${maxUnitsPerTerm}-unit limit.`);
      return;
    }

    const nextSlots = Math.max(0, subject.slots - 1);
    const { id: subjectDocId, ...rest } = subject;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "enlistments", `${userId}_${subject.code}`), {
        ...rest,
        slots: nextSlots,
        userId,
        term: currentTerm,
        enlistedAt: new Date().toISOString(),
      });
      batch.update(doc(db, "subjects", subjectDocId || subject.code), {
        slots: nextSlots,
      });

      await batch.commit();
      showToast("success", `${subject.code} added (${nextSlots}/${subject.max} slots left).`);
    } catch (error) {
      console.error(error);
      showToast("error", "Couldn't add the subject. Please try again.");
    }
  }

  // Drop one subject
  async function handleDrop(subject: any) {
    if (locked || !userId) return;

    const catalogMatch = subjects.find((s) => s.code === subject.code);
    const subjectDocId = catalogMatch?.id || subject.code;
    const maxSlots = catalogMatch?.max ?? subject.max ?? 40;
    const currentSlots = catalogMatch?.slots ?? subject.slots ?? 0;
    const nextSlots = Math.min(maxSlots, currentSlots + 1);

    try {
      const q = query(
        collection(db, "enlistments"),
        where("userId", "==", userId),
        where("code", "==", subject.code)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((d) => batch.delete(d.ref));
      batch.update(doc(db, "subjects", subjectDocId), {
        slots: nextSlots,
      });

      await batch.commit();
      showToast("success", `${subject.code} dropped (${nextSlots}/${maxSlots} slots left).`);
    } catch (error) {
      console.error(error);
      showToast("error", "Couldn't drop the subject. Please try again.");
    }
  }

  // Add the whole recommended set at once
  async function handleEnlistSet() {
    if (locked || !userId || recToAdd.length === 0) return;

    if (!enrollmentOpen) {
      showToast("error", "Enrollment is currently closed for this term.");
      return;
    }

    if (hasPendingClearance) {
      showToast("error", "You have pending clearances. Settle them first before enlisting.");
      return;
    }

    if (recOverBy > 0) {
      showToast("error", `This set is ${recUnitsToAdd} units. You only have ${unitsLeft} left.`);
      return;
    }

    const closedCount = recommended.filter((s) => s.slots <= 0).length;
    setIsAddingSet(true);

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      recToAdd.forEach((s) => {
        const { id: subjectDocId, ...rest } = s;
        const nextSlots = Math.max(0, s.slots - 1);
        batch.set(doc(db, "enlistments", `${userId}_${s.code}`), {
          ...rest,
          slots: nextSlots,
          userId,
          term: currentTerm,
          enlistedAt: now,
        });
        batch.update(doc(db, "subjects", subjectDocId || s.code), {
          slots: nextSlots,
        });
      });

      await batch.commit();
      showToast(
        "success",
        closedCount
          ? `${recToAdd.length} subjects added. ${closedCount} closed, skipped.`
          : `${recToAdd.length} subjects added.`
      );
    } catch (error) {
      console.error(error);
      showToast("error", "Couldn't add the set. Please try again.");
    } finally {
      setIsAddingSet(false);
    }
  }

  // Drop everything
  async function handleClearEnlistments() {
    if (locked || !userId || enlistedSubjects.length === 0) return;
    if (!confirm("Drop all your subjects? This clears your current list.")) return;

    const droppedCodes = enlistedSubjects.map((s) => s.code);
    setTrayOpen(false);

    try {
      const q = query(collection(db, "enlistments"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((d) => batch.delete(d.ref));
      droppedCodes.forEach((code) => {
        const catalogMatch = subjects.find((s) => s.code === code);
        const subjectDocId = catalogMatch?.id || code;
        const maxSlots = catalogMatch?.max ?? 40;
        const currentSlots = catalogMatch?.slots ?? 0;
        batch.update(doc(db, "subjects", subjectDocId), {
          slots: Math.min(maxSlots, currentSlots + 1),
        });
      });

      await batch.commit();
      showToast("success", "All subjects dropped and slots restored.");
    } catch (error) {
      console.error(error);
      showToast("error", "Couldn't clear your subjects.");
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery, filterTerm]);

  const filteredSubjects = subjects.filter((sub) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = sub.code.toLowerCase().includes(q) || sub.title.toLowerCase().includes(q);
    const matchesTerm = filterTerm === "All" || sub.term === filterTerm;

    let matchesCategory = true;
    if (activeCategory === SELECTED_TAB) {
      matchesCategory = enlistedCodes.has(sub.code);
    } else if (activeCategory === "General Education") {
      matchesCategory = sub.isGenEd === true;
    } else if (activeCategory !== "All Subjects") {
      matchesCategory = sub.year === activeCategory && !sub.isGenEd;
    }
    return matchesSearch && matchesTerm && matchesCategory;
  });

  const totalPages = Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSubjects = filteredSubjects.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (!role || !userId || isLoadingCatalog || !studentLoaded || !curriculumLoaded)
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-emerald-900 text-sm font-semibold">
          <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
          <svg className="animate-spin h-5 w-5 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading subjects...
        </div>
      </div>
    );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans relative pb-28 md:pb-0">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-28 md:bottom-24 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`flex items-center border bg-white shadow-xl ${
              toast.type === "error" ? "border-red-200 text-red-900" : "border-emerald-200 text-emerald-950"
            }`}
          >
            <div className={`w-2 self-stretch ${toast.type === "error" ? "bg-red-600" : "bg-emerald-700"}`} />
            <div className="px-4 py-3 text-sm font-semibold">{toast.text}</div>
          </div>
        </div>
      )}

      {/* Tray + Sticky Bar */}
      <EnlistmentBar
        enlistedSubjects={enlistedSubjects}
        enlistedByTerm={enlistedByTerm}
        terms={TERMS}
        currentUnits={currentUnits}
        maxUnits={maxUnitsPerTerm}
        unitsLeft={unitsLeft}
        unitPercentage={unitPercentage}
        trayOpen={trayOpen}
        setTrayOpen={setTrayOpen}
        locked={locked}
        onDrop={handleDrop}
        onClearAll={handleClearEnlistments}
      />

      {/* Reusable Student Sidebar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto mb-20">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="mx-auto w-full max-w-6xl p-4 sm:p-8 lg:p-10">
          <header className="mb-6 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                  <span>{schoolYear}</span>
                  <span>•</span>
                  <span>{currentTerm}</span>
                  <span>•</span>
                  <span className={enrollmentOpen ? "text-emerald-700" : "text-red-700"}>
                    {enrollmentOpen ? "Enrollment Open" : "Enrollment Closed"}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">Subjects</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  {locked
                    ? "These are your subjects for this term."
                    : "Browse subjects and add them to your list for this term."}
                </p>
              </div>

              {process.env.NODE_ENV === "development" && (
                <div className="flex items-center gap-2 pt-2 sm:pt-0">
                  <button
                    onClick={syncSubjectSlotsWithEnlistments}
                    className="border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    Sync slots with live enlistments
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Clearance Alert Banner */}
          {hasPendingClearance && !locked && (
            <div className="mb-6 border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/60 px-5 py-4 shadow-xs">
              <p className="text-sm font-bold text-amber-950">Clearance Pending</p>
              <p className="mt-1 text-sm text-amber-900">
                You currently have one or more uncleared department clearances. Subject selection will be unlocked once all clearance gates are cleared.
              </p>
            </div>
          )}

          {/* Block-term banner */}
          {locked && (
            <div className="mb-6 border border-emerald-200 border-l-4 border-l-emerald-700 bg-white px-5 py-4 shadow-xs">
              <p className="text-sm font-bold text-emerald-950">Your first-term subjects are set for you</p>
              <p className="mt-1 text-sm text-zinc-600">
                You&apos;re enrolled in a fixed set of subjects this term. Subject selection opens next term.
              </p>
            </div>
          )}

          {/* Recommended subjects (flexible terms only) */}
          {hasCurriculum && !locked && (
            <RecommendedPanel
              studentProgram={studentProgram}
              recYear={recYear}
              setRecYear={setRecYear}
              recTerm={recTerm}
              setRecTerm={setRecTerm}
              recOpen={recOpen}
              setRecOpen={setRecOpen}
              recommended={recommended}
              enlistedCodes={enlistedCodes}
              recTotalUnits={recTotalUnits}
              recOverBy={recOverBy}
              recToAdd={recToAdd}
              recUnitsToAdd={recUnitsToAdd}
              isAddingSet={isAddingSet}
              onEnlistSet={handleEnlistSet}
              yearOptions={YEAR_OPTIONS}
              terms={TERMS}
            />
          )}

          {/* Category Tabs */}
          <div className="mb-5 flex overflow-x-auto no-scrollbar border-b border-zinc-300">
            <div className="flex gap-6 min-w-max">
              {CATEGORIES.map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`flex items-center gap-2 pb-3 text-sm font-bold transition-colors border-b-4 whitespace-nowrap ${
                      isActive
                        ? "border-emerald-700 text-emerald-950"
                        : "border-transparent text-zinc-500 hover:text-emerald-900"
                    }`}
                  >
                    {category}
                    {category === SELECTED_TAB && (
                      <span className="bg-emerald-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {enlistedSubjects.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Term Filter */}
          <div className="mb-5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="h-3 w-1 bg-emerald-700" />
              </div>
              <input
                type="text"
                placeholder="Search by code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-zinc-300 bg-white pl-6 pr-3 py-2.5 text-sm font-medium placeholder:text-zinc-400 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
              />
            </div>
            <select
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            >
              <option value="All">All Terms</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Subject List */}
          {filteredSubjects.length === 0 ? (
            <div className="border border-emerald-900/15 bg-white px-6 py-20 text-center shadow-xs">
              <div className="mx-auto mb-3 h-3 w-12 bg-emerald-800/20" />
              <p className="text-sm font-semibold text-zinc-700">
                {activeCategory === SELECTED_TAB ? "You haven't added any subjects yet." : "No subjects found."}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("All Subjects");
                  setFilterTerm("All");
                }}
                className="mt-3 text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
              >
                {activeCategory === SELECTED_TAB ? "Browse all subjects" : "Clear filters"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedSubjects.map((subject) => (
                <SubjectCard
                  key={subject.code}
                  subject={subject}
                  isAdded={enlistedCodes.has(subject.code)}
                  locked={locked}
                  willExceedLimit={currentUnits + subject.units > maxUnitsPerTerm}
                  onEnlist={handleEnlist}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-zinc-300 pt-5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-white"
              >
                ← Previous
              </button>
              <span className="text-sm font-bold text-zinc-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-white"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}