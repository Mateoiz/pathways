"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* eslint-disable @typescript-eslint/no-explicit-any */
type StudentDoc = Record<string, any>;

const REQUIREMENT_LABELS: Record<string, string> = {
  form138: "Form 138",
  goodMoral: "Good Moral Certificate",
  honorableDismissal: "Honorable Dismissal",
  idPictures: "ID Pictures",
  medicalCertificate: "Medical Certificate",
  psaBirthCertificate: "PSA Birth Certificate",
  transcriptOfRecords: "Transcript of Records",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-5 w-1.5 bg-emerald-800" />
      <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">{children}</h2>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-l-2 border-emerald-700/40 pl-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900 break-words">
        {value && String(value).trim() !== "" ? value : "—"}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-emerald-900/15 bg-white shadow-xs">
      <div className="border-b border-zinc-200 px-6 py-4">
        <SectionTitle>{title}</SectionTitle>
      </div>
      <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Reads the student's record from Firestore and displays it.
 * Assumes the document lives at `users/{userId}` — change COLLECTION if yours differs.
 */
const COLLECTIONS = ["users", "students"];

export default function StudentProfile({ userId }: { userId: string }) {
  const [data, setData] = useState<StudentDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let found: StudentDoc | null = null;
        const tried: string[] = [];

        for (const col of COLLECTIONS) {
          // 1) document ID matches
          const snap = await getDoc(doc(db, col, userId));
          tried.push(`${col}/${userId}`);
          if (snap.exists()) {
            found = snap.data();
            break;
          }
          // 2) a field inside the document matches
          for (const field of ["studentId", "personal.studentId", "uid"]) {
            const q = query(collection(db, col), where(field, "==", userId), limit(1));
            const res = await getDocs(q);
            tried.push(`${col} where ${field} == ${userId}`);
            if (!res.empty) {
              found = res.docs[0].data();
              break;
            }
          }
          if (found) break;
        }

        if (!active) return;
        if (found) setData(found);
        else {
          console.warn("StudentProfile: no document found. Tried:", tried);
          setError(`Profile not found for "${userId}". Check the browser console for what was tried.`);
        }
      } catch (e) {
        if (active) setError("Could not load profile.");
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading)
    return (
      <div className="flex items-center gap-3 border border-emerald-900/15 bg-white p-6 text-sm font-semibold text-emerald-900">
        <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
        Loading profile...
      </div>
    );

  if (error || !data)
    return (
      <div className="border border-red-300 border-l-4 border-l-red-600 bg-red-50 p-5 text-sm font-semibold text-red-900">
        {error ?? "No data."}
      </div>
    );

  const p = data.personal ?? {};
  const h = data.health ?? {};
  const prev = data.previousSchool ?? {};
  const reqs: Record<string, boolean> = data.requirements ?? {};

  const fullName = [p.firstName ?? data.firstName, p.middleName, p.lastName ?? data.lastName, p.suffix]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      {/* Identity header */}
      <section className="border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white p-6 shadow-xs">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Student Profile</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{fullName}</h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
          <span>
            <strong className="text-zinc-900">ID:</strong> <span className="font-mono">{data.studentId ?? p.studentId}</span>
          </span>
          <span>
            <strong className="text-zinc-900">Program:</strong> {data.program}
          </span>
          <span>
            <strong className="text-zinc-900">Year Level:</strong> {data.yearLevel}
          </span>
        </div>
      </section>

      <Card title="Personal Information">
        <Field label="First Name" value={p.firstName} />
        <Field label="Middle Name" value={p.middleName} />
        <Field label="Last Name" value={p.lastName} />
        <Field label="Suffix" value={p.suffix} />
        <Field label="Sex" value={p.sex} />
        <Field label="Date of Birth" value={formatDate(p.dateOfBirth)} />
        <Field label="Place of Birth" value={p.placeOfBirth} />
        <Field label="Civil Status" value={p.civilStatus} />
        <Field label="Citizenship" value={p.citizenship} />
        <Field label="Religion" value={p.religion} />
        <Field label="LRN" value={p.lrn} />
      </Card>

      <Card title="Parent / Guardian">
        <Field label="Guardian Name" value={data.guardianName} />
        <Field label="Relationship" value={data.guardianRelationship} />
        <Field label="Mother's Name" value={data.motherName} />
        <Field label="Mother's Maiden Name" value={data.motherMaidenName} />
        <Field label="Mother's Occupation" value={data.motherOccupation} />
        <Field label="Mother's Contact" value={data.motherContact} />
      </Card>

      <Card title="Health">
        <Field label="Blood Type" value={h.bloodType} />
        <Field label="Allergies" value={h.allergies} />
        <Field label="PWD" value={h.pwd} />
        <Field label="Medical Notes" value={h.medicalNotes} />
      </Card>

      <Card title="Previous School">
        <Field label="Senior High School" value={prev.shsName} />
        <Field label="Strand" value={prev.shsStrand} />
        <Field label="Year Graduated" value={prev.yearGraduated} />
        <Field label="GWA" value={prev.gwa} />
        <Field label="Last College Attended" value={prev.lastCollegeAttended} />
      </Card>

      <section className="border border-emerald-900/15 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <SectionTitle>Admission Requirements</SectionTitle>
          <span className="text-xs font-bold text-zinc-500">
            {Object.values(reqs).filter(Boolean).length} of {Object.keys(reqs).length} submitted
          </span>
        </div>
        <ul className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(reqs).map(([key, ok]) => (
            <li
              key={key}
              className={`flex items-center justify-between border border-l-4 px-4 py-3 text-sm font-semibold ${
                ok
                  ? "border-zinc-200 border-l-emerald-700 bg-white text-zinc-800"
                  : "border-amber-300 border-l-amber-500 bg-amber-50 text-amber-900"
              }`}
            >
              {REQUIREMENT_LABELS[key] ?? key}
              <span
                className={`border px-2 py-0.5 text-xs font-bold ${
                  ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-amber-300 bg-amber-100 text-amber-900"
                }`}
              >
                {ok ? "Submitted" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.updatedAt && (
        <p className="text-xs text-zinc-400">
          Last updated {new Date(data.updatedAt).toLocaleString("en-PH")}
        </p>
      )}
    </div>
  );
}