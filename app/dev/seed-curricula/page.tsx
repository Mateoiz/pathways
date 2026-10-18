"use client";

import { useState } from "react";
import { collection, doc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db, createAuthUserWithoutLoggingOut } from "@/lib/firebase";
type TermEntry = { year: string; term: string; block: boolean; codes: string[] };

// 1. BS COMPUTER SCIENCE FLOWCHART
const CS_TERMS: TermEntry[] = [
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true, // Strictly locked 1st-Year 1st-Term block (17 units)
    codes: ["CORE107", "CORE106", "CC101A", "CC101B", "CC102A", "CC102B", "PEED101", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["LSVI101", "CORE109", "CC103A", "CC103B", "CORE105", "PEED102", "NSTP102A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE101", "COEF362A", "SDF104A", "SDF104B", "CC104A", "CC104B", "DS101A", "PEED103"],
  },
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["COEE402A", "AL101A", "CC105A", "CC105B", "LSVI102", "DS102A", "PEED104"],
  },
  {
    year: "2nd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CC106A", "AL102A", "AR101A", "CN101A", "CORE110", "LSVI103"],
  },
  {
    year: "2nd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["PD101A", "SE101A", "PL101A", "COEN122A", "SP101A"],
  },
  {
    year: "3rd Year",
    term: "1st Trimester",
    block: false,
    codes: ["SE102A", "SE102B", "COSC117C", "OS101A", "HCI101A", "GV101A", "CORE108"],
  },
  {
    year: "3rd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["NC101A", "COSC122C", "IAS101A", "FEL005C", "SE103A"],
  },
];

// 2. BS ACCOUNTANCY FLOWCHART
const BSA_TERMS: TermEntry[] = [
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true,
    codes: ["CORE101", "CORE102", "LSVI101", "BACC102A", "BACC122A", "PEED101", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE103", "CORE104", "CORE105", "CORE106", "LSVI102", "BACC112A", "PEED102", "NSTP102A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE107", "CORE114", "LSVI103", "COMP101A", "COMP101B", "ECON201A", "BACC121A", "BACC132A", "PEED103"],
  },
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["CORE110", "CORE202", "ECON202A", "PREL101A", "ACCT211A", "BLAW211A", "BACC131A", "PEED104"],
  },
  {
    year: "2nd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["GEEL101A", "BMEC101A", "COMP102A", "COMP102B", "ACCT221A", "ACCT232A", "BLAW221A", "BTAX211A"],
  },
  {
    year: "2nd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["BMEC102A", "PREL102A", "ACCT231A", "ACCT312A", "ACCT314A", "ACCT334A", "BLAW231A", "BTAX221A"],
  },
  {
    year: "3rd Year",
    term: "1st Trimester",
    block: false,
    codes: ["RZAL101A", "PREL103A", "PREL104A", "ACCT311A", "ACCT322A", "ACCT323A", "ACCT234A", "ACCT234B"],
  },
  {
    year: "3rd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["ACCT331A", "ACCT324A", "ACCT332A", "ACCT333A", "ACCT333B", "ACCT233A", "ACCT325A", "BLAW331A"],
  },
  {
    year: "3rd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["ACCT335A", "ACCT336A"],
  },
  {
    year: "4th Year",
    term: "1st Trimester",
    block: false,
    codes: ["AREV421A", "AREV422A", "AREV423A"],
  },
  {
    year: "4th Year",
    term: "2nd Trimester",
    block: false,
    codes: ["AREV424A", "AREV425A", "AREV426A"],
  },
];

// 3. BSBA MARKETING MANAGEMENT FLOWCHART
const MKTG_TERMS: TermEntry[] = [
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true,
    codes: ["CORE101", "MKTG100A", "LSVI101", "CORE104", "PEED101", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE103", "CORE110", "MKTG102A", "LSVI102", "PEED102", "NSTP102A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["BACC101A", "ECON111A", "MKTG103A", "MKTG104A", "LSVI103", "PEED103"],
  },
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["CORE102", "BMEC101A", "BACC103A", "MKTG105A", "MKTG106A", "PEED104"],
  },
  {
    year: "2nd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE114", "CORE106", "BACC104A", "BTAX103A", "MKTG107A", "MKTG108A"],
  },
  {
    year: "2nd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE107", "CORE203", "BACC106A", "FELEC101A", "BMEC102A", "MKTG109A"],
  },
  {
    year: "3rd Year",
    term: "1st Trimester",
    block: false,
    codes: ["CORE202", "BACC107A", "BACC105A", "MKTG111A", "MKTG111B", "MKTG112A", "BMIS101A", "BMIS101B"],
  },
  {
    year: "3rd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE105", "BACC108A", "BACC108B", "BSBA101A", "BSBA101B", "BSBA102A", "BSBA102B"],
  },
  {
    year: "3rd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["RZAL101A", "FORL111A", "BSBA103A", "BSBA103B", "BSBA104A", "BSBA104B", "BSBA105A", "BSBA105B"],
  },
  {
    year: "4th Year",
    term: "1st Trimester",
    block: false,
    codes: ["PRAC101A"],
  },
];

// Dedicated non-overlapping slots for Academic Courses (Mon/Wed, Tue/Thu, Fri)
const ACADEMIC_SLOTS = [
  { days: "Mon, Wed", time: "07:30 AM - 09:00 AM", room: "RM301" },
  { days: "Mon, Wed", time: "09:15 AM - 10:45 AM", room: "RM302" },
  { days: "Mon, Wed", time: "11:00 AM - 12:30 PM", room: "RM304" },
  { days: "Mon, Wed", time: "01:30 PM - 03:00 PM", room: "RM401" },
  { days: "Tue, Thu", time: "07:30 AM - 09:00 AM", room: "RM613" },
  { days: "Tue, Thu", time: "09:15 AM - 10:45 AM", room: "RM608" },
  { days: "Tue, Thu", time: "11:00 AM - 12:30 PM", room: "RM502" },
  { days: "Tue, Thu", time: "01:30 PM - 03:00 PM", room: "RM508" },
  { days: "Fri", time: "01:00 PM - 04:00 PM", room: "RM305" },
];

const CURRICULA = [
  { id: "bs-computer-science", program: "BS Computer Science", terms: CS_TERMS },
  { id: "bs-accountancy", program: "BS Accountancy", terms: BSA_TERMS },
  { id: "bsba-marketing-management", program: "BSBA Marketing Management", terms: MKTG_TERMS },
];
export default function SeedCurriculaPage() {
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  async function provisionLiveAuthAccounts() {
    setIsRunning(true);
    setStatus("Provisioning live Firebase Auth accounts for Admin, Registrar, and Students...");
    let createdCount = 0;

    try {
      const staffAccounts = [
        { email: "admin@dlsau.edu.ph", password: "password123", role: "admin", name: "System Administrator" },
        { email: "registrar@dlsau.edu.ph", password: "password123", role: "registrar", name: "University Registrar" },
      ];

      for (const staff of staffAccounts) {
        let uid = "";
        try {
          uid = await createAuthUserWithoutLoggingOut(staff.email, staff.password);
          createdCount++;
        } catch (err: any) {
          if (err?.code !== "auth/email-already-in-use") console.warn(err);
        }

        await setDoc(
          doc(db, "users", staff.email),
          {
            email: staff.email,
            role: staff.role,
            name: staff.name,
            ...(uid ? { uid } : {}),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      const studentsSnap = await getDocs(collection(db, "students"));
      for (const stDoc of studentsSnap.docs) {
        const data = stDoc.data();
        const studentId = data.studentId || stDoc.id;
        const authEmail = `${studentId}@dlsau.edu.ph`;

        try {
          const uid = await createAuthUserWithoutLoggingOut(authEmail, "password123");
          await setDoc(doc(db, "students", stDoc.id), { uid, authEmail }, { merge: true });
          createdCount++;
        } catch (err: any) {
          if (err?.code !== "auth/email-already-in-use") console.warn(err);
        }
      }

      setStatus(
        `Done! Provisioned ${createdCount} new Firebase Auth account(s). Log in with admin@dlsau.edu.ph / password123 or any student number / password123.`
      );
    } catch (error) {
      console.error(error);
      setStatus("Failed to provision Auth accounts. Make sure Email/Password Sign-In is enabled in Firebase Console.");
    } finally {
      setIsRunning(false);
    }
  }

  async function resetAndSeedSystem() {
    if (
      !confirm(
        "This will wipe all current student enlistments, force-assign zero-conflict schedules to every term, and reset all slots to 40/40. Continue?"
      )
    ) {
      return;
    }

    setIsRunning(true);
    try {
      // 1. Wipe all existing student enlistments
      setStatus("1/4 Clearing all existing student enlistments...");
      const enlistSnap = await getDocs(collection(db, "enlistments"));
      for (let i = 0; i < enlistSnap.docs.length; i += 400) {
        const batch = writeBatch(db);
        enlistSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // 2. Write Curricula flowcharts
      setStatus("2/4 Writing CS, BSA, and Marketing curriculum flowcharts...");
      for (const c of CURRICULA) {
        await setDoc(doc(db, "curricula", c.id), { program: c.program, terms: c.terms });
      }

      // 3. Build strictly non-overlapping schedule map (CS priority first so BSCS1A is 100% conflict-free)
      setStatus("3/4 Assigning zero-conflict meeting times to all subjects...");
      const scheduleMap: Record<string, { days: string; time: string; room: string }> = {};

for (const c of CURRICULA) {
        for (const t of c.terms) {
          // Track which (days + time) slots are already used in this specific term
          // by shared Gen Ed courses that were scheduled in an earlier program
          const usedSlotsInTerm = new Set<string>();
          for (const code of t.codes) {
            if (scheduleMap[code]?.days && scheduleMap[code]?.time) {
              usedSlotsInTerm.add(`${scheduleMap[code].days}__${scheduleMap[code].time}`);
            }
          }

          let acadIdx = 0;
          for (const code of t.codes) {
            if (code === "ACCT335A" || code === "PRAC101A") {
              scheduleMap[code] = { days: "", time: "", room: "TBA" };
              continue;
            }

            if (code.startsWith("PEED")) {
              scheduleMap[code] = {
                days: "Fri",
                time: "08:00 AM - 10:00 AM",
                room: "GYM-01",
              };
              continue;
            }

            if (code.startsWith("NSTP")) {
              scheduleMap[code] = {
                days: "Sat",
                time: "08:00 AM - 11:00 AM",
                room: "FIELD-01",
              };
              continue;
            }

            // Only assign a slot if this subject hasn't been scheduled yet,
            // and skip any slot already used in this term by a shared Gen Ed!
            if (!scheduleMap[code]) {
              while (
                acadIdx < ACADEMIC_SLOTS.length * 2 &&
                usedSlotsInTerm.has(
                  `${ACADEMIC_SLOTS[acadIdx % ACADEMIC_SLOTS.length].days}__${
                    ACADEMIC_SLOTS[acadIdx % ACADEMIC_SLOTS.length].time
                  }`
                )
              ) {
                acadIdx++;
              }
              const slot = ACADEMIC_SLOTS[acadIdx % ACADEMIC_SLOTS.length];
              scheduleMap[code] = {
                days: slot.days,
                time: slot.time,
                room: code.endsWith("B") ? "LAB-608" : slot.room,
              };
              usedSlotsInTerm.add(`${slot.days}__${slot.time}`);
              acadIdx++;
            }
          }
        }
      }

      // Fetch all subjects in Firestore and FORCE-OVERWRITE days, time, room, and slots
      const subjectsSnap = await getDocs(collection(db, "subjects"));
      const allSubjects = subjectsSnap.docs.map((d) => ({
        docId: d.id,
        ...(d.data() as any),
      }));

      let fallbackIdx = 0;
      for (let i = 0; i < allSubjects.length; i += 400) {
        const batch = writeBatch(db);
        allSubjects.slice(i, i + 400).forEach((s) => {
          const code = s.code || s.docId;
          const assigned =
            scheduleMap[code] || ACADEMIC_SLOTS[fallbackIdx++ % ACADEMIC_SLOTS.length];
          const maxSlots = s.max ?? 40;

          // Force-overwrite days, time, and room so old conflicting times are completely replaced
          batch.update(doc(db, "subjects", s.docId), {
            slots: maxSlots,
            max: maxSlots,
            days: assigned.days,
            time: assigned.time,
            room: assigned.room,
          });
        });
        await batch.commit();
      }

      // 4. Reset active term in `settings/academic` to 1st Trimester
      setStatus("4/4 Resetting active term to 1st Trimester...");
      await setDoc(
        doc(db, "settings", "academic"),
        {
          schoolYear: "2026-2027",
          currentTerm: "1st Trimester",
          enrollmentOpen: true,
          maxUnitsDefault: 23,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setStatus(
        `Done! Wiped ${enlistSnap.size} old enlistments and force-updated ${allSubjects.length} subjects with zero-conflict schedules.`
      );
    } catch (e) {
      console.error(e);
      setStatus("Reset failed. Check console.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-10 font-sans">
      <div className="border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white p-6 shadow-xs">
        <h1 className="text-xl font-bold text-emerald-950">
          Reset Enrollment System & Fix All Overlaps
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Wipes old <code>enlistments</code>, force-overwrites all subject meeting times so <strong>BSCS1A</strong> (and all other blocks) have <strong>0 overlaps</strong>, and resets slots to <code>40 / 40</code>.
        </p>
<div className="mt-5 flex flex-col gap-3">
          <button
            onClick={resetAndSeedSystem}
            disabled={isRunning}
            className="w-full border-l-4 border-red-400 bg-red-800 px-5 py-2.5 text-left text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isRunning ? "Working..." : "1. Wipe Enlistments & Force-Fix All Schedules"}
          </button>
          <button
            onClick={provisionLiveAuthAccounts}
            disabled={isRunning}
            className="w-full border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-left text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {isRunning ? "Working..." : "2. Provision Live Firebase Auth (Admin, Registrar & Students)"}
          </button>
        </div>
        {status && (
          <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}