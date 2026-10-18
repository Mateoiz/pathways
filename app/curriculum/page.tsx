"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";
import { DAY_FULL, toItem } from "@/components/schedule/types";
import { rescheduleTerm } from "@/lib/autoSchedule";

const PROGRAMS = [
  { id: "bs-computer-science", label: "BS Computer Science" },
  { id: "bs-accountancy", label: "BS Accountancy" },
  { id: "bsba-marketing-management", label: "BSBA Marketing Management" },
  { id: "doctor-of-veterinary-medicine", label: "Doctor of Veterinary Medicine" },
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "6th Year"];
const TERMS = ["1st Trimester", "2nd Trimester", "3rd Trimester"];

const DAY_PRESETS = [
  "Mon, Wed",
  "Tue, Thu",
  "Fri",
  "Sat",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
];

export default function AdminCurriculumPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState(PROGRAMS[0].id);
  const [selectedYear, setSelectedYear] = useState("1st Year");
  const [selectedTerm, setSelectedTerm] = useState("1st Trimester");

  const [curriculaMap, setCurriculaMap] = useState<Record<string, any>>({});
  const [subjectsMap, setSubjectsMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Edit Subject Modal
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "admin") {
      router.push("/");
      return;
    }
    setRole(storedRole);
  }, [router]);

  useEffect(() => {
    async function loadData() {
      try {
        const [currSnap, subjSnap] = await Promise.all([
          getDocs(collection(db, "curricula")),
          getDocs(collection(db, "subjects")),
        ]);

        const cMap: Record<string, any> = {};
        currSnap.docs.forEach((d) => {
          cMap[d.id] = { id: d.id, ...d.data() };
        });
        setCurriculaMap(cMap);

        const sMap: Record<string, any> = {};
        subjSnap.docs.forEach((d) => {
          const data = d.data();
          const code = data.code || d.id;
          sMap[code] = { docId: d.id, code, ...data };
        });
        setSubjectsMap(sMap);
      } catch (error) {
        console.error("Failed to load curriculum data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    if (role === "admin") loadData();
  }, [role]);

  const activeCurriculum = curriculaMap[selectedProgramId];
  const activeTermEntry = useMemo(() => {
    return activeCurriculum?.terms?.find(
      (t: any) => t.year === selectedYear && t.term === selectedTerm
    );
  }, [activeCurriculum, selectedYear, selectedTerm]);

  const termSubjects = useMemo(() => {
    const codes: string[] = activeTermEntry?.codes || [];
    return codes.map(
      (code) =>
        subjectsMap[code] || {
          code,
          title: "Subject not found in catalog",
          units: 3,
          days: "",
          time: "",
          room: "TBA",
          slots: 40,
          max: 40,
        }
    );
  }, [activeTermEntry, subjectsMap]);

  // Detect any time overlaps inside this curriculum term
  const conflicts = useMemo(() => {
    const items = termSubjects
      .map((s) => toItem(s, "Enrolled"))
      .filter((i) => i.scheduled);
    const out: { a: string; b: string; day: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const onDay = items.filter((i) => i.days.includes(d));
      for (let x = 0; x < onDay.length; x++) {
        for (let y = x + 1; y < onDay.length; y++) {
          const a = onDay[x];
          const b = onDay[y];
          if (a.start! < b.end! && b.start! < a.end!) {
            out.push({ a: a.code, b: b.code, day: d });
          }
        }
      }
    }
    return out;
  }, [termSubjects]);

  const conflictCodes = useMemo(
    () => new Set(conflicts.flatMap((c) => [c.a, c.b])),
    [conflicts]
  );

  // Subjects in this term that exist in the catalog but have no time yet (internships excluded)
  const untimedCount = useMemo(
    () =>
      termSubjects.filter(
        (s) =>
          s.docId &&
          (!s.days || !s.time) &&
          !/INTERNSHIP|PRACTICUM|ON-THE-JOB|OJT/i.test(s.title || "")
      ).length,
    [termSubjects]
  );

  // Toggle whether this term is a Fixed Block or Flexible
  async function handleToggleTermBlock() {
    if (!activeCurriculum || !activeTermEntry) return;
    const nextBlock = !activeTermEntry.block;
    const updatedTerms = activeCurriculum.terms.map((t: any) =>
      t.year === selectedYear && t.term === selectedTerm
        ? { ...t, block: nextBlock }
        : t
    );

    setCurriculaMap((prev) => ({
      ...prev,
      [selectedProgramId]: { ...activeCurriculum, terms: updatedTerms },
    }));

    try {
      await setDoc(
        doc(db, "curricula", selectedProgramId),
        { program: activeCurriculum.program, terms: updatedTerms },
        { merge: true }
      );
      showToast(
        "success",
        `${selectedYear} • ${selectedTerm} set to ${
          nextBlock ? "Fixed Block" : "Flexible Selection"
        }.`
      );
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to update block setting.");
    }
  }

  // Fixes overlaps and fills missing times for the current term.
  //  - Only the later subject of each overlapping pair is moved (with its lecture/lab partner).
  //  - Subjects that already have a good time, and all rooms and capacities, stay as they are.
  //  - Durations come from units (80 min per unit), so a 3-unit subject gets a 4-hour block.
  //  - One batched write: either everything saves or nothing does.
  async function handleAutoResolveTermConflicts() {
    if (!activeTermEntry) return;

    // Skip codes that aren't in the catalog; there's no document to update for them
    const inCatalog = termSubjects.filter((s) => s.docId);
    if (inCatalog.length === 0) {
      showToast("error", "None of this term's subjects exist in the catalog yet.");
      return;
    }

    setIsSaving(true);
    try {
      const { subjects: next, changed, warnings } = rescheduleTerm(inCatalog, activeTermEntry);
      warnings.forEach((w) => console.warn(w));

      if (changed.length === 0) {
        showToast("error", warnings[0] ?? "Nothing to change. No free slot was found.");
        return;
      }

      const batch = writeBatch(db);
      const updatedLocal: Record<string, any> = { ...subjectsMap };
      for (const s of next) {
        if (!changed.includes(s.code)) continue;
        batch.update(doc(db, "subjects", (s as any).docId), { days: s.days, time: s.time });
        updatedLocal[s.code] = { ...subjectsMap[s.code], days: s.days, time: s.time };
      }
      await batch.commit();

      setSubjectsMap(updatedLocal);
      showToast(
        "success",
        `Updated ${changed.length} subject${changed.length === 1 ? "" : "s"} (${changed.join(", ")}).${
          warnings.length ? ` ${warnings.length} warning(s) in the console.` : ""
        }`
      );
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to auto-resolve conflicts. Nothing was changed.");
    } finally {
      setIsSaving(false);
    }
  }

  // Save edited subject schedule & capacity
  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSubject) return;
    setIsSaving(true);

    try {
      const docId = editingSubject.docId || editingSubject.code;
      const slotsRaw = editingSubject.slots;
      const payload = {
        title: editingSubject.title.trim(),
        units: Number(editingSubject.units) || 3,
        days: editingSubject.days.trim(),
        time: editingSubject.time.trim(),
        room: editingSubject.room.trim() || "TBA",
        slots: slotsRaw === "" || slotsRaw == null ? 40 : Number(slotsRaw),
        max: Number(editingSubject.max) || 40,
      };

      await updateDoc(doc(db, "subjects", docId), payload);

      setSubjectsMap((prev) => ({
        ...prev,
        [editingSubject.code]: { ...editingSubject, ...payload },
      }));
      showToast("success", `Updated schedule for ${editingSubject.code}.`);
      setEditingSubject(null);
    } catch (error) {
      console.error(error);
      showToast("error", "Couldn't save subject changes.");
    } finally {
      setIsSaving(false);
    }
  }

  const totalTermUnits = termSubjects.reduce(
    (sum, s) => sum + (Number(s.units) || 0),
    0
  );

  if (!role || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-emerald-900 text-sm font-semibold">
          <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
          Loading curriculum manager...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`flex items-center border bg-white shadow-xl ${
              toast.type === "error"
                ? "border-red-200 text-red-900"
                : "border-emerald-200 text-emerald-950"
            }`}
          >
            <div
              className={`w-2 self-stretch ${
                toast.type === "error" ? "bg-red-600" : "bg-emerald-700"
              }`}
            />
            <div className="px-4 py-3 text-sm font-semibold">{toast.text}</div>
          </div>
        </div>
      )}

      <AdminNavbar />

      <main className="flex-1 overflow-y-auto">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto">
          <header className="mb-6 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">
              Curriculum & Schedule Manager
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Inspect program flowcharts by trimester, toggle fixed-block locks, and edit class meeting times or room assignments.
            </p>
          </header>

          {/* Non-Native Segmented Selector Bar */}
          <section className="mb-6 border border-emerald-900/15 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Degree Program Flowchart
                </span>
                <div className="flex flex-wrap gap-2">
                  {PROGRAMS.map((p) => {
                    const active = selectedProgramId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProgramId(p.id)}
                        className={`border px-4 py-2 text-xs font-bold transition-all ${
                          active
                            ? "border-emerald-900 border-l-4 border-l-emerald-400 bg-emerald-900 text-white"
                            : "border-zinc-300 bg-white text-zinc-700 hover:bg-emerald-50"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTermEntry && (
                <div className="flex flex-col sm:items-end">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Enrollment Mode for {selectedYear} ({selectedTerm})
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleTermBlock}
                    className={`border-l-4 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                      activeTermEntry.block
                        ? "border-emerald-400 bg-emerald-900 text-white"
                        : "border-sky-500 bg-sky-50 text-sky-950 border border-sky-300"
                    }`}
                  >
                    {activeTermEntry.block
                      ? "🔒 Fixed Block (Auto-Enrolled)"
                      : "🔓 Flexible Selection (Open Add/Drop)"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase text-zinc-500 mr-1">
                  Year:
                </span>
                <div className="inline-flex border border-zinc-300 bg-white">
                  {YEARS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setSelectedYear(y)}
                      className={`px-3.5 py-1.5 text-xs font-bold transition-colors ${
                        selectedYear === y
                          ? "bg-emerald-900 text-white"
                          : "text-zinc-600 hover:bg-emerald-50"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase text-zinc-500 mr-1">
                  Trimester:
                </span>
                <div className="inline-flex border border-zinc-300 bg-white">
                  {TERMS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTerm(t)}
                      className={`px-3.5 py-1.5 text-xs font-bold transition-colors ${
                        selectedTerm === t
                          ? "bg-emerald-900 text-white"
                          : "text-zinc-600 hover:bg-emerald-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Overlap Warning Banner */}
          {conflicts.length > 0 && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-red-200 border-l-4 border-l-red-600 bg-white px-5 py-4 text-red-900 shadow-xs">
              <div className="text-sm">
                <p className="font-bold">
                  Schedule Conflict Detected in {selectedYear} • {selectedTerm}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs font-medium">
                  {conflicts.map((c, idx) => (
                    <li key={idx}>
                      <strong>{c.a}</strong> and <strong>{c.b}</strong> overlap on{" "}
                      {DAY_FULL[c.day]}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-600">
                  Auto-resolve moves only the later subject of each clash. Shared GE subjects
                  (like CORE101) are used by other programs too, so check their terms afterwards.
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleAutoResolveTermConflicts}
                className="shrink-0 border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {isSaving ? "Resolving..." : "Auto-Resolve Conflicts ⚡"}
              </button>
            </div>
          )}

          {/* Term Flowchart Table */}
          <section className="border border-emerald-900/15 bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1.5 bg-emerald-800" />
                <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">
                  {selectedYear} • {selectedTerm} Courses ({termSubjects.length})
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {untimedCount > 0 && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleAutoResolveTermConflicts}
                    className="border border-emerald-800 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-800 hover:text-white disabled:opacity-50"
                  >
                    {isSaving ? "Working..." : `Auto-fill ${untimedCount} missing time${untimedCount === 1 ? "" : "s"}`}
                  </button>
                )}
                <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-200 px-3 py-1">
                  Total: {totalTermUnits} Units
                </span>
              </div>
            </div>

            {termSubjects.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-zinc-500">
                No flowchart subjects defined for {selectedYear}, {selectedTerm}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="border-b border-emerald-900/10 bg-emerald-950/[0.03] text-[11px] uppercase tracking-wider text-emerald-950">
                    <tr>
                      <th className="px-6 py-3.5 font-bold">Code</th>
                      <th className="px-6 py-3.5 font-bold">Course Title</th>
                      <th className="px-6 py-3.5 font-bold">Units</th>
                      <th className="px-6 py-3.5 font-bold">Meeting Days & Time</th>
                      <th className="px-6 py-3.5 font-bold">Room</th>
                      <th className="px-6 py-3.5 font-bold">Available Slots</th>
                      <th className="px-6 py-3.5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {termSubjects.map((sub) => {
                      const hasConflict = conflictCodes.has(sub.code);
                      return (
                        <tr
                          key={sub.code}
                          className={
                            hasConflict
                              ? "bg-red-50/50"
                              : "hover:bg-emerald-50/40"
                          }
                        >
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-2 font-mono text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-200 px-2.5 py-1">
                              <span
                                className={`h-2 w-1 ${
                                  hasConflict ? "bg-red-600" : "bg-emerald-700"
                                }`}
                              />
                              {sub.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-zinc-900">
                            {sub.title}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-700">
                            {sub.units}u
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {sub.days && sub.time ? (
                              <span
                                className={
                                  hasConflict
                                    ? "font-bold text-red-700"
                                    : "font-semibold text-emerald-950"
                                }
                              >
                                {sub.days} • {sub.time}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold">
                                No time assigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-600">
                            {sub.room || "TBA"}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-900">
                            {sub.slots ?? 40} / {sub.max ?? 40}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setEditingSubject({ ...sub })}
                              className="border border-emerald-800 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-800 hover:text-white transition-colors"
                            >
                              Edit Schedule
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Edit Subject Schedule Modal */}
      {editingSubject && (
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
                    Edit Course Schedule & Capacity
                  </h2>
                  <p className="text-xs font-mono text-emerald-200">
                    {editingSubject.code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="border border-emerald-700 bg-emerald-800/60 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700">
                  Course Title
                </label>
                <input
                  required
                  value={editingSubject.title}
                  onChange={(e) =>
                    setEditingSubject({ ...editingSubject, title: e.target.value })
                  }
                  className="border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700">
                  Meeting Days (Click Preset or Type)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {DAY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setEditingSubject({ ...editingSubject, days: preset })
                      }
                      className={`border px-2.5 py-1 text-xs font-bold ${
                        editingSubject.days === preset
                          ? "border-emerald-900 bg-emerald-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-emerald-50"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  value={editingSubject.days}
                  onChange={(e) =>
                    setEditingSubject({ ...editingSubject, days: e.target.value })
                  }
                  placeholder="e.g. Mon, Wed"
                  className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Meeting Time
                  </label>
                  <input
                    value={editingSubject.time}
                    onChange={(e) =>
                      setEditingSubject({ ...editingSubject, time: e.target.value })
                    }
                    placeholder="07:30 AM - 09:00 AM"
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Room Assignment
                  </label>
                  <input
                    value={editingSubject.room}
                    onChange={(e) =>
                      setEditingSubject({ ...editingSubject, room: e.target.value })
                    }
                    placeholder="RM301 / LAB-608"
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Open Slots
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingSubject.slots}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        slots: e.target.value.replace(/[^0-9]/g, ""),
                      })
                    }
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Max Capacity
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingSubject.max}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        max: e.target.value.replace(/[^0-9]/g, ""),
                      })
                    }
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="border-l-4 border-emerald-400 bg-emerald-900 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}