"use client";

// app/dev/timetable-preview/page.tsx
// Dev-only. Pick a year and term and see that term's schedule drawn as a weekly timetable.
// Reads the `subjects` collection you seeded. Delete this file when you're done.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import WeeklyTimetable, { type TimetableItem } from "@/components/WeeklyTimetable";
import { parseMeetings } from "@/lib/autoSchedule";

interface SubjectDoc {
  code: string;
  title?: string;
  units?: number;
  year?: string;
  term?: string;
  days?: string;
  time?: string;
}

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const TERMS = ["1st Trimester", "2nd Trimester", "3rd Trimester"];

export default function TimetablePreviewPage() {
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("1st Year");
  const [term, setTerm] = useState("1st Trimester");

  useEffect(() => {
    getDocs(collection(db, "subjects"))
      .then((snap) => setSubjects(snap.docs.map((d) => ({ code: d.id, ...(d.data() as Omit<SubjectDoc, "code">) }))))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const inTerm = useMemo(
    () => subjects.filter((s) => s.year === year && s.term === term).sort((a, b) => a.code.localeCompare(b.code)),
    [subjects, year, term]
  );

  const items: TimetableItem[] = inTerm
    .map((s) => ({ code: s.code, title: s.title, meetings: parseMeetings(s.days, s.time, s.code, s.title) }))
    .filter((i) => i.meetings.length > 0);

  const untimed = inTerm.filter((s) => !s.days || !s.time);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="mx-auto max-w-5xl p-6 font-sans sm:p-10">
      <h1 className="text-xl font-bold text-emerald-950">Timetable preview</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Shows the seeded schedule for one term, exactly as a student taking the whole term would see it.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="border border-zinc-300 bg-white px-3 py-2 text-sm"
          aria-label="Year level"
        >
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="border border-zinc-300 bg-white px-3 py-2 text-sm"
          aria-label="Trimester"
        >
          {TERMS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-600">Loading subjects...</p>
      ) : inTerm.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">
          No subjects found for this term. Did you run the seed page? (Only BS Accountancy has a catalog right now.)
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <WeeklyTimetable items={items} />
          {untimed.length > 0 && (
            <p className="border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
              No time set for: {untimed.map((s) => s.code).join(", ")}
            </p>
          )}
          <ul className="grid gap-1 text-sm text-zinc-700 sm:grid-cols-2">
            {inTerm.map((s) => (
              <li key={s.code}>
                <span className="font-bold">{s.code}</span> ({s.units}u) {s.days || "-"} {s.time || ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}