"use client";

// app/dev/seed-curricula/page.tsx
// Dev-only page. Visit /dev/seed-curricula once, click the button, then delete this file.

import { useState } from "react";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

type TermEntry = { year: string; term: string; block: boolean; codes: string[] };

const CS_TERMS: TermEntry[] = [
  // ───── 1st Year ─────
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true,
    codes: ["CORE107", "CORE106", "PEED101", "CC101A", "CC101B", "CC102A", "CC102B", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["LSVI101", "CORE109", "PEED102", "CC103A", "CC103B", "NSTP102A", "CORE105"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE101", "COEF362A", "PEED103", "SDF104A", "SDF104B", "CC104A", "CC104B", "DS101A"],
  },

  // ───── 2nd Year ─────
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["COEE402A", "PEED104", "AL101A", "CC105A", "CC105B", "LSVI102", "DS102A"],
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

  // ───── 3rd Year ─────
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

const BSA_TERMS: TermEntry[] = [
  // ───── 1st Year ─────
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true, // Fixed block (23 units)
    codes: ["CORE101", "CORE102", "NSTP101A", "PEED101", "LSVI101", "BACC102A", "BACC122A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE103", "CORE104", "CORE105", "CORE106", "LSVI102", "NSTP102A", "PEED102", "BACC112A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE107", "CORE114", "LSVI103", "COMP101A", "COMP101B", "ECON201A", "PEED103", "BACC121A", "BACC132A"],
  },

  // ───── 2nd Year ─────
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["CORE110", "CORE202", "PEED104", "ECON202A", "PREL101A", "ACCT211A", "BLAW211A", "BACC131A"],
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

  // ───── 3rd Year ─────
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

  // ───── 4th Year ─────
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

const BSA_SUBJECTS_CATALOG = [
  // 1st Year - 1st Trimester
  { code: "CORE101", title: "READINGS IN PHILIPPINE HISTORY", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "CORE102", title: "ART APPRECIATION", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "NSTP101A", title: "NATIONAL SERVICE TRAINING PROGRAM 1", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "PEED101", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 1", units: 2, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "LSVI101", title: "THE SPIRIT OF FAITH", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "BACC102A", title: "FINANCIAL ACCOUNTING AND REPORTING", units: 6, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: false },
  { code: "BACC122A", title: "CONCEPTUAL FRAMEWORK AND ACCOUNTING STANDARDS", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: false },

  // 1st Year - 2nd Trimester
  { code: "CORE103", title: "CONTEMPORARY WORLD", units: 3, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "CORE104", title: "PURPOSIVE COMMUNICATION", units: 3, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "CORE105", title: "SCIENCE, TECHNOLOGY AND SOCIETY", units: 3, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "CORE106", title: "MATHEMATICS IN THE MODERN WORLD", units: 3, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "LSVI102", title: "THE SPIRIT OF COMMUNION", units: 3, prereq: "LSVI101", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "NSTP102A", title: "NATIONAL SERVICE TRAINING PROGRAM 2", units: 3, prereq: "NSTP101A", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "PEED102", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 2", units: 2, prereq: "PEED101", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "BACC112A", title: "INTERMEDIATE ACCOUNTING 1", units: 3, prereq: "BACC102A", year: "1st Year", term: "2nd Trimester", isGenEd: false },

  // 1st Year - 3rd Trimester
  { code: "CORE107", title: "UNDERSTANDING THE SELF", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "CORE114", title: "LIVING IN THE I.T. ERA", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "LSVI103", title: "THE SPIRIT OF SERVICE", units: 3, prereq: "LSVI102", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "COMP101A", title: "I.T. APPLICATION TOOLS IN BUSINESS LEC", units: 2, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "COMP101B", title: "I.T. APPLICATION TOOLS IN BUSINESS LAB", units: 1, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "ECON201A", title: "MANAGERIAL ECONOMICS", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "PEED103", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 3", units: 2, prereq: "PEED102", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "BACC121A", title: "INTERMEDIATE ACCOUNTING 2", units: 3, prereq: "BACC112A", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "BACC132A", title: "COST ACCOUNTING AND CONTROL", units: 3, prereq: "BACC112A", year: "1st Year", term: "3rd Trimester", isGenEd: false },

  // 2nd Year - 1st Trimester (with schedules from your active enrollment data)
  { code: "CORE110", title: "ETHICS", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: true, room: "RM502", days: "Thu", time: "08:00 AM - 12:00 PM" },
  { code: "CORE202", title: "THE ENTREPRENEURIAL MIND", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: true, room: "RM508", days: "Sat", time: "07:30 AM - 11:30 AM" },
  { code: "PEED104", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 4", units: 2, prereq: "PEED103", year: "2nd Year", term: "1st Trimester", isGenEd: true, room: "GYM-01", days: "Mon", time: "08:50 AM - 11:30 AM" },
  { code: "ECON202A", title: "ECONOMIC DEVELOPMENT", units: 3, prereq: "ECON201A", year: "2nd Year", term: "1st Trimester", isGenEd: false, room: "RM706", days: "Tue", time: "11:00 AM - 03:00 PM" },
  { code: "PREL101A", title: "PROFESSIONAL ELECTIVES (Valuation Concepts and Methods)", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: false, room: "RM502", days: "Mon", time: "12:30 PM - 04:30 PM" },
  { code: "ACCT211A", title: "MANAGEMENT SCIENCE", units: 3, prereq: "BACC132A", year: "2nd Year", term: "1st Trimester", isGenEd: false, room: "RM510", days: "Sat", time: "12:30 PM - 04:30 PM" },
  { code: "BLAW211A", title: "LAW ON OBLIGATIONS AND CONTRACTS", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: false, room: "RM502", days: "Tue", time: "03:30 PM - 07:30 PM" },
  { code: "BACC131A", title: "INTERMEDIATE ACCOUNTING 3", units: 3, prereq: "BACC121A", year: "2nd Year", term: "1st Trimester", isGenEd: false, room: "RM610", days: "Thu", time: "12:30 PM - 04:30 PM" },

  // 2nd Year - 2nd Trimester
  { code: "GEEL101A", title: "GENERAL ELECTIVES (Business Logic)", units: 3, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: true },
  { code: "BMEC101A", title: "STRATEGIC MANAGEMENT", units: 3, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "COMP102A", title: "STATISTICAL ANALYSIS WITH SOFTWARE APPLICATION LEC", units: 2, prereq: "COMP101A, COMP101B", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "COMP102B", title: "STATISTICAL ANALYSIS WITH SOFTWARE APPLICATION LAB", units: 1, prereq: "COMP101A, COMP101B", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT221A", title: "ACCOUNTING FOR SPECIAL TRANSACTION", units: 6, prereq: "BACC131A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT232A", title: "FINANCIAL MANAGEMENT", units: 3, prereq: "ACCT211A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BLAW221A", title: "BUSINESS LAWS AND REGULATIONS (Law on Sales and Credit)", units: 3, prereq: "BLAW211A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BTAX211A", title: "INCOME TAXATION", units: 3, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: false },

  // 2nd Year - 3rd Trimester
  { code: "BMEC102A", title: "OPERATIONS MANAGEMENT (TQM)", units: 3, prereq: "BMEC101A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PREL102A", title: "PROFESSIONAL ELECTIVES (Updates in Financial Reporting Standards)", units: 3, prereq: "None", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT231A", title: "AUDITING AND ASSURANCE PRINCIPLES", units: 3, prereq: "ACCT221A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT312A", title: "GOVERNANCE, BUSINESS ETHICS, RISK MANAGEMENT AND INTERNAL CONTROL", units: 3, prereq: "ACCT221A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT314A", title: "FINANCIAL MARKETS", units: 3, prereq: "ACCT232A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT334A", title: "STRATEGIC COST MANAGEMENT", units: 3, prereq: "ACCT232A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "BLAW231A", title: "BUSINESS LAW AND REGULATIONS (Negotiable Instruments)", units: 3, prereq: "BLAW221A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "BTAX221A", title: "BUSINESS TAXATION", units: 3, prereq: "BTAX211A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },

  // 3rd Year - 1st Trimester
  { code: "RZAL101A", title: "LIFE AND WORKS OF RIZAL", units: 3, prereq: "None", year: "3rd Year", term: "1st Trimester", isGenEd: true },
  { code: "PREL103A", title: "PROFESSIONAL ELECTIVES (Operations Auditing)", units: 3, prereq: "None", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "PREL104A", title: "PROFESSIONAL ELECTIVES (Teaching Accounting)", units: 3, prereq: "None", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT311A", title: "ACCOUNTING FOR BUSINESS COMBINATIONS", units: 3, prereq: "ACCT221A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT322A", title: "ACCOUNTING FOR GOVERNMENT AND NON-PROFIT ORGANIZATIONS", units: 3, prereq: "ACCT221A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT323A", title: "AUDITING AND ASSURANCE: CONCEPTS AND APPLICATIONS 1", units: 3, prereq: "ACCT231A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT234A", title: "ACCOUNTING INFORMATION SYSTEM LEC", units: 2, prereq: "BACC131A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT234B", title: "ACCOUNTING INFORMATION SYSTEM LAB", units: 1, prereq: "BACC131A", year: "3rd Year", term: "1st Trimester", isGenEd: false },

  // 3rd Year - 2nd Trimester
  { code: "ACCT331A", title: "ACCOUNTING RESEARCH METHODS (Thesis 1)", units: 3, prereq: "BACC131A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT324A", title: "AUDITING AND ASSURANCE: CONCEPTS AND APPLICATIONS 2", units: 3, prereq: "ACCT323A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT332A", title: "AUDITING AND ASSURANCE: SPECIALIZED INDUSTRIES", units: 3, prereq: "ACCT323A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT333A", title: "AUDITING IN A CIS ENVIRONMENT LEC", units: 2, prereq: "ACCT234A, ACCT234B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT333B", title: "AUDITING IN A CIS ENVIRONMENT LAB", units: 1, prereq: "ACCT234A, ACCT234B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT233A", title: "STRATEGIC BUSINESS ANALYSIS", units: 3, prereq: "ACCT334A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT325A", title: "INTERNATIONAL BUSINESS AND TRADE", units: 3, prereq: "ACCT314A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BLAW331A", title: "REGULATORY FRAMEWORK AND LEGAL ISSUES IN BUSINESS", units: 3, prereq: "BLAW221A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },

  // 3rd Year - 3rd Trimester
  { code: "ACCT335A", title: "ACCOUNTING INTERNSHIP (600 HOURS)", units: 6, prereq: "ACCT231A", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT336A", title: "ACCOUNTANCY RESEARCH (Thesis 2)", units: 3, prereq: "ACCT331A", year: "3rd Year", term: "3rd Trimester", isGenEd: false },

  // 4th Year - 1st Trimester
  { code: "AREV421A", title: "INTEGRATED REVIEW 1 FAR", units: 3, prereq: "BACC131A", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "AREV422A", title: "INTEGRATED REVIEW 2 MAS", units: 3, prereq: "ACCT325A", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "AREV423A", title: "INTEGRATED REVIEW 3 RFBT", units: 3, prereq: "BLAW331A", year: "4th Year", term: "1st Trimester", isGenEd: false },

  // 4th Year - 2nd Trimester
  { code: "AREV424A", title: "INTEGRATED REVIEW 4 AFAR", units: 3, prereq: "ACCT311A", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "AREV425A", title: "INTEGRATED REVIEW 5 BTAX", units: 3, prereq: "BTAX221A", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "AREV426A", title: "INTEGRATED REVIEW 6 AUDITING", units: 3, prereq: "ACCT324A", year: "4th Year", term: "2nd Trimester", isGenEd: false },
];

const CURRICULA = [
  { id: "bs-computer-science", program: "BS Computer Science", terms: CS_TERMS },
  { id: "bs-accountancy", program: "BS Accountancy", terms: BSA_TERMS },
];

export default function SeedCurriculaPage() {
  const [status, setStatus] = useState("");

  if (process.env.NODE_ENV !== "development") return null;

  async function seed() {
    setStatus("Writing curricula and BSA catalog...");
    try {
      // 1. Seed Curricula Definitions
      for (const c of CURRICULA) {
        await setDoc(doc(db, "curricula", c.id), { program: c.program, terms: c.terms });
      }

      // 2. Seed BSA Subjects into live catalog
      for (let i = 0; i < BSA_SUBJECTS_CATALOG.length; i += 450) {
        const batch = writeBatch(db);
        const chunk = BSA_SUBJECTS_CATALOG.slice(i, i + 450);
        chunk.forEach((subj) => {
          batch.set(
            doc(db, "subjects", subj.code),
            {
              slots: 40,
              max: 40,
              room: "TBA",
              days: "",
              time: "",
              ...subj,
            },
            { merge: true }
          );
        });
        await batch.commit();
      }

      setStatus(`Done! Wrote ${CURRICULA.length} curricula and ${BSA_SUBJECTS_CATALOG.length} BSA catalog subjects.`);
    } catch (e) {
      console.error(e);
      setStatus("Failed. Check the console.");
    }
  }

  return (
    <div className="mx-auto max-w-xl p-10 font-sans">
      <h1 className="text-xl font-bold text-emerald-950">Seed Curricula & Catalog</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Writes <strong>BS Computer Science</strong> and <strong>BS Accountancy</strong> to the <code>curricula</code> collection, and provisions all {BSA_SUBJECTS_CATALOG.length} accountancy subjects with schedule times into <code>subjects</code>.
      </p>
      <button
        onClick={seed}
        className="mt-4 border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
      >
        Seed now
      </button>
      {status && <p className="mt-3 text-sm font-bold text-emerald-800">{status}</p>}
    </div>
  );
}