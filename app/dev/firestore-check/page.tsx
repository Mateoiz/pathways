"use client";

// app/dev/firestore-check/page.tsx
// Dev-only. Shows which Firebase project/database the app is really talking to, then tests a read and a write
// on the `applications` collection. Delete this file when you're done.

import { useState } from "react";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Step = { label: string; ok: boolean; detail: string };

export default function FirestoreCheckPage() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  const opts = db.app.options as { projectId?: string; authDomain?: string };
  // private field, but it's the only way to see which database id is in use
  const databaseId = (db as unknown as { _databaseId?: { database?: string } })._databaseId?.database ?? "(unknown)";

  async function run() {
    setRunning(true);
    const out: Step[] = [];
    const push = (label: string, ok: boolean, detail: string) => out.push({ label, ok, detail });

    // 1. read
    try {
      const snap = await getDocs(collection(db, "applications"));
      push("Read applications", true, `${snap.size} document(s) found`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      push("Read applications", false, `${err.code ?? "error"}: ${err.message ?? ""}`);
    }

    // 2. write a test application (it will show up in /applications as "Diagnostic Test")
    try {
      const ref = await addDoc(collection(db, "applications"), {
        reference: "DIAG-TEST",
        status: "pending",
        type: "freshman",
        applicant: {
          firstName: "Diagnostic",
          middleName: "",
          lastName: "Test",
          suffix: "",
          birthDate: "2000-01-01",
          sex: "Female",
          citizenship: "Filipino",
          email: "diagnostic@example.com",
          mobile: "09170000000",
          addressLine: "Test address",
          city: "Malabon",
          province: "Metro Manila",
          zip: "",
          guardianName: "Test Guardian",
          guardianRelationship: "Parent",
          guardianMobile: "09170000000",
          previousSchool: "Test School",
          previousTrack: "STEM",
          yearGraduated: "2026",
          programId: "bs-accountancy",
          consent: true,
        },
        documents: {},
        reviewNote: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      push("Write test application", true, `Created applications/${ref.id}`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      push("Write test application", false, `${err.code ?? "error"}: ${err.message ?? ""}`);
    }

    setSteps(out);
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-xl p-10 font-sans">
      <h1 className="text-xl font-bold text-emerald-950">Firestore connection check</h1>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border border-zinc-200 bg-white p-4 text-sm">
        <dt className="font-bold text-zinc-600">Project ID</dt>
        <dd className="font-mono">{opts.projectId ?? "(missing)"}</dd>
        <dt className="font-bold text-zinc-600">Database</dt>
        <dd className="font-mono">{databaseId}</dd>
        <dt className="font-bold text-zinc-600">Auth domain</dt>
        <dd className="font-mono">{opts.authDomain ?? "(missing)"}</dd>
      </dl>
      <p className="mt-2 text-xs text-zinc-600">
        Compare the Project ID and database with the ones open in your Firebase console.
      </p>

      <button
        onClick={run}
        disabled={running}
        className="mt-4 border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {running ? "Testing..." : "Run test"}
      </button>

      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((s) => (
          <li
            key={s.label}
            className={`border border-l-4 px-4 py-3 text-sm ${
              s.ok ? "border-emerald-200 border-l-emerald-700 bg-emerald-50/50" : "border-red-200 border-l-red-600 bg-red-50/50"
            }`}
          >
            <p className="font-bold">
              {s.ok ? "Passed" : "Failed"}: {s.label}
            </p>
            <p className="mt-0.5 break-words font-mono text-xs text-zinc-700">{s.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}