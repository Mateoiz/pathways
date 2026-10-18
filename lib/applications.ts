// lib/applications.ts
// Shared by the public application form (/apply) and the registrar review page (/applications).

import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { db, createAuthUserWithoutLoggingOut } from "@/lib/firebase";

/* ───────────── constants (edit these to match school policy) ───────────── */

export const PROGRAMS = [
  { id: "bs-computer-science", label: "BS Computer Science" },
  { id: "bs-accountancy", label: "BS Accountancy" },
  { id: "bsba-marketing-management", label: "BSBA Marketing Management" },
  { id: "doctor-of-veterinary-medicine", label: "Doctor of Veterinary Medicine" },
];

export const YEAR_LEVELS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "6th Year",
];

export type ApplicationType = "freshman" | "transferee";
export type ApplicationStatus = "pending" | "needs_info" | "approved" | "rejected";

export const TYPE_LABEL: Record<ApplicationType, string> = {
  freshman: "Incoming freshman",
  transferee: "Transferee",
};

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pending review",
  needs_info: "Needs info",
  approved: "Approved",
  rejected: "Rejected",
};

// Documents the registrar must receive before an application can be approved.
export const REQUIRED_DOCS: Record<ApplicationType, { key: string; label: string }[]> = {
  freshman: [
    { key: "psa", label: "PSA birth certificate" },
    { key: "form138", label: "Form 138 (report card)" },
    { key: "goodMoral", label: "Certificate of good moral character" },
  ],
  transferee: [
    { key: "psa", label: "PSA birth certificate" },
    { key: "tor", label: "Transcript of records" },
    { key: "honorableDismissal", label: "Honorable dismissal" },
    { key: "goodMoral", label: "Certificate of good moral character" },
  ],
};

// Same keys your dashboard's CLEARANCE_GATES uses
export const CLEARANCE_KEYS = [
  "library",
  "accounting",
  "clinic",
  "disciplinary",
  "registrar",
  "guidance",
  "laboratory",
  "studentAffairs",
];

// Student numbers look like 2026-00-000001 (YYYY-NN-NNNNNN). Change the middle part if "NN" means something.
const STUDENT_NO_MIDDLE = "00";
const SCHOOL_EMAIL_DOMAIN = "dlsau.edu.ph";

/* ───────────── types ───────────── */

export interface ApplicantData {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string; // YYYY-MM-DD
  sex: string;
  citizenship: string;
  email: string;
  mobile: string;
  addressLine: string;
  city: string;
  province: string;
  zip: string;
  guardianName: string;
  guardianRelationship: string;
  guardianMobile: string;
  previousSchool: string;
  previousTrack: string; // SHS strand for freshmen, course taken for transferees
  yearGraduated: string;
  programId: string;
  consent: boolean;
}

export interface ApplicationDoc {
  id: string;
  reference: string;
  status: ApplicationStatus;
  type: ApplicationType;
  applicant: ApplicantData;
  documents: Record<string, boolean>;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp | null;
  studentNumber?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/* ───────────── helpers ───────────── */

export function fullName(a: ApplicantData): string {
  const mid = a.middleName ? ` ${a.middleName.charAt(0).toUpperCase()}.` : "";
  const suf = a.suffix ? `, ${a.suffix}` : "";
  return `${a.firstName}${mid} ${a.lastName}${suf}`;
}

export function programLabel(id: string): string {
  return PROGRAMS.find((p) => p.id === id)?.label ?? id;
}

export function missingDocs(app: Pick<ApplicationDoc, "type" | "documents">) {
  return REQUIRED_DOCS[app.type].filter((d) => !app.documents?.[d.key]);
}

/** e.g. APP-2026-K7M2QX. Skips look-alike characters (0/O, 1/I). */
export function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `APP-${new Date().getFullYear()}-${code}`;
}

export function formatStudentNumber(year: number, seq: number): string {
  return `${year}-${STUDENT_NO_MIDDLE}-${String(seq).padStart(6, "0")}`;
}

/**
 * Looks at the students that already exist for this year and returns the highest sequence number
 * (2026-00-000005 -> 5), or 0 if there are none. Student documents are keyed by student number, and the
 * numbers are zero-padded, so sorting by document ID sorts by sequence.
 */
async function highestExistingSequence(year: number): Promise<number> {
  const prefix = `${year}-${STUDENT_NO_MIDDLE}-`;
  const snap = await getDocs(
    query(
      collection(db, "students"),
      where(documentId(), ">=", `${prefix}000000`),
      where(documentId(), "<=", `${prefix}999999`),
      orderBy(documentId(), "desc"),
      limit(1)
    )
  );
  if (snap.empty) return 0;
  const seq = parseInt(snap.docs[0].id.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : 0;
}

/* ───────────── approval: application -> student profile ───────────── */

/**
 * Approves an application and creates the student profile in one transaction:
 *   1. picks the next number: one more than the highest existing student for the year (or the counter, if higher)
 *   2. creates students/<studentNumber> pre-filled from the application
 *   3. marks the application approved and stores the student number on it
 * If anything fails, nothing is written.
 *
 * NOTE: this does not create the Firebase Auth login. The login page signs in with
 * <studentNumber>@dlsau.edu.ph, so ITSD (or a server route) must create that account.
 */
export async function approveApplication(
  appId: string,
  opts: { yearLevel: string; reviewer: string }
): Promise<{ studentNumber: string; schoolEmail: string }> {
  const appRef = doc(db, "applications", appId);
  const year = new Date().getFullYear();
  // Checked outside the transaction (Firestore transactions can't run queries). The transaction below
  // still guards against two registrars approving at the same moment.
  const existingMax = await highestExistingSequence(year);

  return runTransaction(db, async (tx) => {
    // ---- reads first ----
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) throw new Error("Application not found.");
    const app = appSnap.data() as Omit<ApplicationDoc, "id">;
    if (app.status === "approved") throw new Error("This application was already approved.");

    const a = app.applicant;
    const program = PROGRAMS.find((p) => p.id === a.programId);
    if (!program) throw new Error("This application has an unknown program.");

    const counterRef = doc(db, "counters", `student-${year}`);
    const counterSnap = await tx.get(counterRef);
    const counterLast = counterSnap.exists() ? Number(counterSnap.data().last) || 0 : 0;

    // Next number = one more than whichever is higher: the counter, or the highest student already in Firestore.
    let seq = Math.max(counterLast, existingMax) + 1;

    // Skip past any number that's already taken (gaps, or someone who was just created), up to 25 tries.
    let studentNumber = formatStudentNumber(year, seq);
    let studentRef = doc(db, "students", studentNumber);
    for (let tries = 0; ; tries++) {
      studentNumber = formatStudentNumber(year, seq);
      studentRef = doc(db, "students", studentNumber);
      const taken = await tx.get(studentRef);
      if (!taken.exists()) break;
      if (tries >= 25) {
        throw new Error("Couldn't find a free student number. Please check the students collection.");
      }
      seq += 1;
    }

// ---- writes ----
    const sanitize = (str: string) =>
      (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "");
    const firstGiven = sanitize((a.firstName || "").trim().split(/\s+/)[0] || "");
    const lastClean = sanitize(a.lastName || "");
    const schoolEmail =
      firstGiven && lastClean
        ? `${firstGiven}.${lastClean}@${SCHOOL_EMAIL_DOMAIN}`
        : `${studentNumber}@${SCHOOL_EMAIL_DOMAIN}`;

const prefixMap: Record<string, string> = {
      "BS Computer Science": "BSCS",
      "BS Accountancy": "BACC",
      "BSBA Marketing Management": "MKTG",
      "Doctor of Veterinary Medicine": "VETM",
    };
    const secPrefix = prefixMap[program.label] || "SEC";
    const yearDigit = opts.yearLevel.charAt(0) || "1";
    const defaultSection = `${secPrefix}${yearDigit}A`;
    const isFreshmanBlock = app.type === "freshman" && opts.yearLevel === "1st Year";
    const nowIso = new Date().toISOString();

    tx.set(counterRef, { last: seq }, { merge: true });

    tx.set(studentRef, {
      studentId: studentNumber,
      studentNumber,
      authEmail: `${studentNumber}@${SCHOOL_EMAIL_DOMAIN}`,
      role: "student",
      firstName: a.firstName,
      middleName: a.middleName,
      lastName: a.lastName,
      suffix: a.suffix,
      email: schoolEmail,
      personalEmail: a.email,
      mobile: a.mobile,
      birthDate: a.birthDate,
      sex: a.sex,
      citizenship: a.citizenship,
      program: program.label,
      programId: program.id,
      yearLevel: opts.yearLevel,
      section: defaultSection,
      enrollmentStatus: app.type === "transferee" ? "Transferee" : "Regular",
      maxUnits: 23,
      blockEnrolled: isFreshmanBlock,
      // Full nested structure for the 10-section Student Information Sheet
      personal: {
        studentId: studentNumber,
        lrn: "",
        firstName: a.firstName || "",
        middleName: a.middleName || "",
        lastName: a.lastName || "",
        suffix: a.suffix || "",
        dateOfBirth: a.birthDate || "",
        placeOfBirth: "",
        sex: a.sex || "",
        civilStatus: "Single",
        citizenship: a.citizenship || "Filipino",
        religion: "",
      },
      contact: {
        email: schoolEmail,
        personalEmail: a.email || "",
        mobileNumber: a.mobile || "",
      },
      address: {
        street: a.addressLine || "",
        barangay: "",
        city: a.city || "",
        province: a.province || "",
        zipCode: a.zip || "",
        line: a.addressLine || "",
        zip: a.zip || "",
      },
      family: {
        fatherName: a.guardianRelationship === "Father" ? a.guardianName : "",
        fatherOccupation: "",
        fatherContact: a.guardianRelationship === "Father" ? a.guardianMobile : "",
        motherName: a.guardianRelationship === "Mother" ? a.guardianName : "",
        motherMaidenName: "",
        motherOccupation: "",
        motherContact: a.guardianRelationship === "Mother" ? a.guardianMobile : "",
        guardianName: a.guardianName || "",
        guardianRelationship: a.guardianRelationship || "Mother",
        guardianContact: a.guardianMobile || "",
      },
      guardian: {
        name: a.guardianName || "",
        relationship: a.guardianRelationship || "",
        mobile: a.guardianMobile || "",
      },
      emergency: {
        contactName: a.guardianName || "",
        relationship: a.guardianRelationship || "Mother",
        contactNumber: a.guardianMobile || "",
      },
      academic: {
        program: program.label,
        major: "",
        yearLevel: opts.yearLevel,
        section: defaultSection,
        enrollmentStatus: app.type === "transferee" ? "Transferee" : "Regular",
        admissionType: app.type === "transferee" ? "Transferee" : "Freshman",
        schoolYearAdmitted: `${year}-${year + 1}`,
        semesterAdmitted: "1st Trimester",
        scholarship: "None",
        maxUnits: "23",
        blockEnrolled: isFreshmanBlock ? "Yes" : "No",
      },
      previousSchool: {
        shsName: a.previousSchool || "",
        shsStrand: a.previousTrack || "STEM",
        yearGraduated: a.yearGraduated || `${year}`,
        gwa: "",
        lastCollegeAttended: app.type === "transferee" ? a.previousSchool || "" : "",
        name: a.previousSchool || "",
        track: a.previousTrack || "",
      },
      health: {
        bloodType: "Unknown",
        allergies: "",
        medicalNotes: "",
        pwd: "No",
      },
      clearances: Object.fromEntries(CLEARANCE_KEYS.map((k) => [k, "pending"])),
      requirements: {
        psaBirthCertificate: !!app.documents?.psa,
        form138: !!app.documents?.form138,
        goodMoral: !!app.documents?.goodMoral,
        medicalCertificate: false,
        idPictures: false,
        transcriptOfRecords: !!app.documents?.tor,
        honorableDismissal: !!app.documents?.honorableDismissal,
      },
      applicationId: appId,
      applicationRef: app.reference,
      admittedBy: opts.reviewer,
      admittedAt: serverTimestamp(),
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    tx.update(appRef, {
      status: "approved",
      studentNumber,
      yearLevelAssigned: opts.yearLevel,
      reviewedBy: opts.reviewer,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { studentNumber, schoolEmail };
  }).then(async (res) => {
    // Automatically provision the live Firebase Auth account (<studentNumber>@dlsau.edu.ph / password123)
    try {
      await createAuthUserWithoutLoggingOut(
        `${res.studentNumber}@${SCHOOL_EMAIL_DOMAIN}`,
        "password123"
      );
    } catch (err: any) {
      if (err?.code !== "auth/email-already-in-use") {
        console.warn("Could not auto-provision Firebase Auth user:", err);
      }
    }
    return res;
  });
}