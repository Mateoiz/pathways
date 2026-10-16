"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, where, writeBatch, doc, increment } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import { DAY_FULL, Item, toItem } from "@/components/schedule/types";
import WeeklyTimetable from "@/components/schedule/WeeklyTimetable";
import DailyScheduleList, { StatusTag } from "@/components/schedule/DailyScheduleList";

// Block (pre-enrolled) subjects count as Enrolled even if an older doc has no status field
const isEnrolledDoc = (s: any) => s.status === "Enrolled" || s.source === "block";

type Toast = { type: "success" | "error"; text: string };

export default function SchedulePage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [enlistments, setEnlistments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"week" | "day">("week");
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(type: Toast["type"], text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  // 1. Verify role and get the user id
  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "student") {
      router.push("/");
      return;
    }
    setRole(storedRole);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : localStorage.getItem("mock_user_id") || "mock-student-id-123");
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Load the student's enlistments directly from Firestore
  useEffect(() => {
    async function fetchEnlistments() {
      if (!userId) return;
      try {
        const q = query(collection(db, "enlistments"), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        const byCode = new Map<string, any>();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          byCode.set(data.code, data);
        });
        setEnlistments(Array.from(byCode.values()));
      } catch (error) {
        console.error("Error loading enlistments:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEnlistments();
  }, [userId]);

  // 3. Drop an unconfirmed subject and restore +1 slot to subjects/{code}
  async function handleDrop(code: string) {
    if (!userId) return;
    const target = enlistments.find((s) => s.code === code);
    if (!target || isEnrolledDoc(target)) return; // enrolled / block subjects can't be dropped here

    const previous = enlistments;
    setEnlistments(enlistments.filter((s) => s.code !== code));
    try {
      const q = query(
        collection(db, "enlistments"),
        where("userId", "==", userId),
        where("code", "==", code)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((d) => batch.delete(d.ref));
      batch.update(doc(db, "subjects", code), {
        slots: increment(1),
      });
      await batch.commit();
      showToast("success", `${code} dropped (+1 slot restored).`);
    } catch (error) {
      console.error(error);
      setEnlistments(previous);
      showToast("error", "Couldn't drop the subject. Please try again.");
    }
  }

  // 4. Confirm pending enlistments into official Enrolled status
  async function handleConfirmEnrollment() {
    if (!userId) return;
    const pending = enlistments.filter((s) => !isEnrolledDoc(s));
    if (pending.length === 0) return;

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      pending.forEach((s) => {
        const ref = doc(db, "enlistments", `${userId}_${s.code}`);
        batch.set(ref, { status: "Enrolled", confirmedAt: now }, { merge: true });
      });
      await batch.commit();

      const pendingCodes = new Set(pending.map((s) => s.code));
      setEnlistments(
        enlistments.map((s) => (pendingCodes.has(s.code) ? { ...s, status: "Enrolled" } : s))
      );
      showToast("success", "Schedule and enrollment successfully confirmed!");
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to confirm enrollment. Please try again.");
    }
  }

  // ───────────── Derived data ─────────────
  const isBlockStudent = enlistments.some((s) => s.source === "block");

  const items: Item[] = useMemo(
    () => enlistments.map((s) => toItem(s, isEnrolledDoc(s) ? "Enrolled" : "Added")),
    [enlistments]
  );

  const scheduled = useMemo(() => items.filter((i) => i.scheduled), [items]);
  const unscheduled = useMemo(() => items.filter((i) => !i.scheduled), [items]);

  // Overlapping classes
  const conflicts = useMemo(() => {
    const out: { a: Item; b: Item; day: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const onDay = scheduled.filter((i) => i.days.includes(d));
      for (let x = 0; x < onDay.length; x++) {
        for (let y = x + 1; y < onDay.length; y++) {
          const a = onDay[x];
          const b = onDay[y];
          if (a.start! < b.end! && b.start! < a.end!) out.push({ a, b, day: d });
        }
      }
    }
    return out;
  }, [scheduled]);

  const conflictCodes = useMemo(
    () => new Set(conflicts.flatMap((c) => [c.a.code, c.b.code])),
    [conflicts]
  );

  const addedItems = items.filter((i) => i.status === "Added");
  const enrolledCount = items.filter((i) => i.status === "Enrolled").length;
  const addedUnits = addedItems.reduce((t, i) => t + (i.units ?? 0), 0);

  if (!role || isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-emerald-900 text-sm font-semibold">
          <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
          <svg className="animate-spin h-5 w-5 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading schedule...
        </div>
      </div>
    );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
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

      {/* Reusable Student Sidebar */}
      <Navbar />

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="mx-auto w-full max-w-6xl p-4 sm:p-8 lg:p-10">
          {/* Header */}
          <header className="mb-6 flex flex-col gap-4 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">My Schedule</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {isBlockStudent
                  ? "Your classes for the week."
                  : "Your classes for the week, plus subjects you've added."}
              </p>
            </div>
            {!isBlockStudent && (
              <Link
                href="/catalog"
                className="inline-flex shrink-0 items-center justify-center border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-800"
              >
                + Add Subjects
              </Link>
            )}
          </header>

          {/* Block-term banner */}
          {isBlockStudent && (
            <div className="mb-6 border border-emerald-200 border-l-4 border-l-emerald-700 bg-white px-5 py-4 shadow-xs">
              <p className="text-sm font-bold text-emerald-950">You&apos;re enrolled in your first-term subjects</p>
              <p className="mt-1 text-sm text-zinc-600">
                These were set for you, so there&apos;s nothing to confirm. Subject selection opens next term.
              </p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Total Subjects", value: items.length, accent: "bg-emerald-800" },
              { label: "Enrolled", value: enrolledCount, accent: "bg-emerald-600" },
              { label: "Added (Not Confirmed)", value: addedItems.length, sub: addedUnits ? `${addedUnits} units` : undefined, accent: "bg-sky-600" },
              { label: "Conflicts", value: conflicts.length, accent: conflicts.length ? "bg-red-600" : "bg-emerald-950" },
            ].map((c) => (
              <div key={c.label} className="relative overflow-hidden border border-emerald-900/10 bg-white p-4 shadow-xs">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${c.accent}`} />
                <p className="pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{c.label}</p>
                <p className={`mt-2 pl-1 font-mono text-2xl font-bold ${c.label === "Conflicts" && conflicts.length ? "text-red-700" : "text-emerald-950"}`}>
                  {c.value}
                  {c.sub && <span className="ml-2 text-xs font-medium text-zinc-500">{c.sub}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <div role="alert" className="mb-6 flex items-stretch border border-red-200 bg-white text-red-900 shadow-xs">
              <div className="w-2 shrink-0 bg-red-600" />
              <div className="px-4 py-3 text-sm">
                <p className="font-bold">Some classes overlap.</p>
                <ul className="mt-1 list-disc pl-5 text-xs font-medium">
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      {c.a.code} and {c.b.code} on {DAY_FULL[c.day]}
                    </li>
                  ))}
                </ul>
                {!isBlockStudent && <p className="mt-1 text-xs">Drop one of the added subjects to fix it.</p>}
              </div>
            </div>
          )}

          {/* View toggle + legend */}
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex border border-zinc-300 bg-white">
              {([
                ["week", "Weekly Grid"],
                ["day", "By Day"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  className={`px-4 py-2 text-xs font-bold transition-colors ${
                    view === key ? "bg-emerald-900 text-white" : "text-zinc-600 hover:bg-emerald-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-zinc-600">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-emerald-900" />Enrolled</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 border border-sky-600 bg-sky-100" />Added</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 border border-red-600 bg-red-100" />Overlap</span>
            </div>
          </div>

          {/* Schedule Views */}
          {view === "week" ? (
            <WeeklyTimetable scheduled={scheduled} conflictCodes={conflictCodes} />
          ) : (
            <DailyScheduleList scheduled={scheduled} conflictCodes={conflictCodes} onDrop={handleDrop} />
          )}

          {/* No meeting time yet */}
          {unscheduled.length > 0 && (
            <section className="mt-6 border border-emerald-900/15 bg-white shadow-xs">
              <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-3">
                <div className="h-5 w-1.5 bg-amber-500" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">No Meeting Time Yet</h2>
                  <p className="text-xs text-zinc-500">These subjects will appear in the schedule once a time is set.</p>
                </div>
              </div>
              <ul className="divide-y divide-zinc-100">
                {unscheduled.map((i) => (
                  <li key={i.code} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900">{i.code}</p>
                        <StatusTag status={i.status} />
                        {i.units != null && (
                          <span className="font-mono text-xs text-zinc-500">{i.units} units</span>
                        )}
                      </div>
                      <p className="truncate text-xs text-zinc-600">{i.title}</p>
                    </div>
                    {i.status === "Added" && (
                      <button
                        onClick={() => handleDrop(i.code)}
                        className="shrink-0 border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
                      >
                        Drop
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Finalize Enrollment */}
          {addedItems.length > 0 && (
            <div className="mt-6 flex flex-col gap-4 border border-sky-200 border-l-4 border-l-sky-600 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-sky-950">Ready to confirm your schedule?</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  You have {addedItems.length} added subject{addedItems.length > 1 ? "s" : ""}
                  {addedUnits ? ` (${addedUnits} units)` : ""} waiting for confirmation.
                  {conflicts.length > 0 && " Fix the overlapping classes first."}
                </p>
              </div>
              <button
                disabled={conflicts.length > 0}
                onClick={handleConfirmEnrollment}
                className="shrink-0 border-l-4 border-emerald-400 bg-emerald-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                Confirm Enrollment →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}