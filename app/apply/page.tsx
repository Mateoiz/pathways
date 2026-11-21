"use client";

// app/apply/page.tsx (public: no sign-in needed)

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  PROGRAMS,
  REQUIRED_DOCS,
  TYPE_LABEL,
  generateReference,
  type ApplicationType,
} from "@/lib/applications";

/* ───────── types & constants ───────── */

interface Form {
  // I. Program
  type: ApplicationType;
  programId: string;
  secondProgramId: string;
  entryTerm: string;
  heardFrom: string;
  // II. Personal
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string;
  placeOfBirth: string;
  sex: string;
  civilStatus: string;
  citizenship: string;
  specialNeeds: string;
  // III. Contact & Address
  email: string;
  mobile: string;
  addressLine: string;
  city: string;
  province: string;
  zip: string;
  // IV. Parent / Guardian
  guardianName: string;
  guardianRelationship: string;
  guardianMobile: string;
  guardianEmail: string;
  guardianOccupation: string;
  // V. Educational Background
  previousSchool: string;
  previousSchoolType: string;
  previousSchoolCity: string;
  previousTrack: string;
  yearGraduated: string;
  lrn: string;
  generalAverage: string;
  // VI. Declaration
  consent: boolean;
}

type StrKey = Exclude<keyof Form, "consent" | "type">;

const EMPTY: Form = {
  type: "freshman",
  programId: "",
  secondProgramId: "",
  entryTerm: "",
  heardFrom: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  birthDate: "",
  placeOfBirth: "",
  sex: "",
  civilStatus: "",
  citizenship: "Filipino",
  specialNeeds: "",
  email: "",
  mobile: "",
  addressLine: "",
  city: "",
  province: "",
  zip: "",
  guardianName: "",
  guardianRelationship: "",
  guardianMobile: "",
  guardianEmail: "",
  guardianOccupation: "",
  previousSchool: "",
  previousSchoolType: "",
  previousSchoolCity: "",
  previousTrack: "",
  yearGraduated: "",
  lrn: "",
  generalAverage: "",
  consent: false,
};

const DRAFT_KEY = "pathways-apply-draft-v3";
const TICKET_KEY = "pathways-apply-ticket-v1";
const DEFAULT_STUDENT_PASSWORD = "password123";

function buildSchoolEmail(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const first = clean(firstName.trim().split(/\s+/)[0] || "");
  const last = clean(lastName);
  if (!first && !last) return "";
  return `${first}${first && last ? "." : ""}${last}@dlsau.edu.ph`;
}
const MIN_AGE = 15;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^(09\d{9}|\+639\d{9})$/;
const NAME_RE = /^[\p{L}][\p{L}\s.'’-]*$/u;

const ENTRY_TERMS = ["1st Trimester", "2nd Trimester", "3rd Trimester"];
const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated", "Annulled"];
const SCHOOL_TYPES = ["Public", "Private"];
const HEARD_FROM = [
  "Facebook / social media",
  "Friends or family",
  "School visit or career talk",
  "Alumni",
  "Website or search engine",
  "Other",
];

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
const phone = (s: string) => s.replace(/[\s-]/g, "");
const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

// Live input sanitizers (block random # and junk symbols while typing)
const onlyNameChars = (s: string) => s.replace(/[^\p{L}\s.'’-]/gu, "");
const onlyPlaceChars = (s: string) => s.replace(/[^\p{L}\s.,'-]/gu, "");
const onlySchoolChars = (s: string) => s.replace(/[^\p{L}0-9\s.,'&()-]/gu, "");
const onlyPhMobile = (s: string) => {
  const cleaned = s.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    return "+" + cleaned.slice(1).replace(/\D/g, "").slice(0, 12); // +639XXXXXXXXX (13 chars)
  }
  return cleaned.replace(/\D/g, "").slice(0, 11); // 09XXXXXXXXX (11 digits)
};

const PLACEHOLDER_WORDS = new Set([
  "test", "testing", "sample", "asdf", "qwerty", "zxcv", "none", "n/a", "na", "null", "xxx", "abc", "asdfgh",
]);
const FAKE_EMAIL_DOMAINS = new Set([
  "test.com", "example.com", "fake.com", "asdf.com", "sample.com", "none.com", "mailinator.com",
]);

function isGibberish(raw: string): boolean {
  const s = tidy(raw).toLowerCase();
  if (!s) return false;
  if (PLACEHOLDER_WORDS.has(s)) return true;
  if (/(.)\1{3,}/.test(s)) return true; // 4+ identical chars in a row (aaaa, ####, 1111)
  if (/asdf|qwerty|zxcv|hjkl|uiop/.test(s)) return true; // keyboard mash
  const letters = s.replace(/[^a-z]/g, "");
  if (letters.length >= 4 && !/[aeiouy]/.test(letters)) return true; // no vowels at all
  return false;
}

function isFakeDigitSequence(num: string): boolean {
  const d = num.replace(/\D/g, "");
  if (/(\d)\1{5,}/.test(d)) return true; // 6+ identical digits (e.g. 09000000000, 111111111111)
  if ("01234567890123456789".includes(d.slice(-8)) || "98765432109876543210".includes(d.slice(-8))) {
    return true; // sequential runs (e.g. 09123456789)
  }
  return false;
}

function isValidPhMobile(raw: string): boolean {
  const p = phone(raw);
  return MOBILE_RE.test(p) && !isFakeDigitSequence(p);
}

function isValidEmail(raw: string): boolean {
  const e = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return false;
  const [local, domain] = e.split("@");
  if (!local || !domain) return false;
  if (FAKE_EMAIL_DOMAINS.has(domain)) return false;
  if (/(.)\1{4,}/.test(local)) return false;
  return true;
}

function ageOn(birth: Date, ref = new Date()) {
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

/* ───────── validation ───────── */

function validateAll(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: keyof Form, msg: string) => {
    if (!String(f[k]).trim()) e[k] = msg;
  };
const name = (k: StrKey, requiredMsg: string, optional = false) => {
    const v = tidy(f[k]);
    if (!v) {
      if (!optional) e[k] = requiredMsg;
    } else if (!NAME_RE.test(v)) {
      e[k] = "Use letters only (hyphens, apostrophes, and periods are fine).";
    } else if (v.length < 2 || isGibberish(v)) {
      e[k] = "Please enter a valid real name.";
    }
  };

  const realText = (k: StrKey, requiredMsg: string, minLen = 3) => {
    const v = tidy(f[k]);
    if (!v) e[k] = requiredMsg;
    else if (v.length < minLen || !/[a-zA-Z]{2,}/.test(v) || isGibberish(v)) {
      e[k] = "Please enter a valid, complete value.";
    }
  };

  // I. Program
  req("programId", "Choose your first choice program.");
  if (!ENTRY_TERMS.includes(f.entryTerm)) e.entryTerm = "Choose your intended trimester.";
  if (f.secondProgramId && f.secondProgramId === f.programId) {
    e.secondProgramId = "Second choice must be different from your first choice.";
  }

// II. Personal
  name("lastName", "Last name is required.");
  name("firstName", "First name is required.");
  name("middleName", "", true);
  realText("placeOfBirth", "Place of birth is required.", 3);
  req("sex", "Select sex.");
  req("civilStatus", "Select civil status.");
  realText("citizenship", "Citizenship is required.", 3);

  const bd = new Date(f.birthDate);
  if (!f.birthDate || isNaN(bd.getTime())) e.birthDate = "Enter your date of birth.";
  else if (bd > new Date()) e.birthDate = "Date of birth can't be in the future.";
  else if (bd.getFullYear() < 1940) e.birthDate = "Check the year.";
  else if (ageOn(bd) < MIN_AGE) e.birthDate = `Applicants must be at least ${MIN_AGE} years old.`;
  if (f.specialNeeds.length > 300) e.specialNeeds = "Keep this under 300 characters.";

  // III. Contact & Address
  if (!isValidEmail(f.email)) e.email = "Enter a valid, active email address.";
  if (!isValidPhMobile(f.mobile)) e.mobile = "Enter a valid PH mobile number (e.g. 09171234567).";
  realText("addressLine", "House no. / street / barangay is required.", 5);
  realText("city", "City or municipality is required.", 3);
  realText("province", "Province is required.", 3);
  if (f.zip && (!/^\d{4}$/.test(f.zip) || f.zip === "0000")) e.zip = "Enter a valid 4-digit PH ZIP code.";

  // IV. Parent / Guardian
  name("guardianName", "Parent or guardian name is required.");
  realText("guardianRelationship", "Relationship is required.", 3);
  if (!isValidPhMobile(f.guardianMobile)) {
    e.guardianMobile = "Enter a valid PH mobile number (e.g. 09171234567).";
  }
  if (f.guardianEmail.trim() && !isValidEmail(f.guardianEmail)) {
    e.guardianEmail = "Enter a valid email address, or leave blank.";
  }

  // V. Educational Background
  realText("previousSchool", "School name is required.", 4);
  req("previousSchoolType", "Select school type.");
  realText("previousSchoolCity", "School city / municipality is required.", 3);
  realText("previousTrack", f.type === "freshman" ? "SHS strand / track is required." : "Previous course is required.", 2);
  const y = Number(f.yearGraduated);
  if (!/^\d{4}$/.test(f.yearGraduated) || y < 1980 || y > new Date().getFullYear()) {
    e.yearGraduated = "Enter a valid 4-digit year.";
  }
  if (f.lrn && (!/^\d{12}$/.test(f.lrn) || isFakeDigitSequence(f.lrn))) {
    e.lrn = "Enter a valid 12-digit LRN.";
  }
  if (f.generalAverage) {
    const g = Number(f.generalAverage);
    if (isNaN(g) || g < 60 || g > 100) e.generalAverage = "Enter a grade from 60 to 100.";
  }
  // VI. Consent
  if (!f.consent) e.consent = "You must certify and agree to the Data Privacy statement before submitting.";

  return e;
}

/* ───────── styles ───────── */

const inputCls = (err?: string) =>
  `w-full border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors ${
    err
      ? "border-red-500 focus:border-red-600 focus:ring-1 focus:ring-red-500"
      : "border-zinc-300 focus:border-emerald-800 focus:ring-1 focus:ring-emerald-800"
  }`;

/* ───────── page ───────── */

export default function ApplyPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
const [done, setDone] = useState<{ reference: string; type: ApplicationType } | null>(null);
  const [liveTicket, setLiveTicket] = useState<{
    status: string;
    studentNumber?: string;
    reviewNote?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null>(null);
  const [justApprovedNotice, setJustApprovedNotice] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const [lookupRef, setLookupRef] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!done?.reference) return;
    const unsub = onSnapshot(
      doc(db, "applications", done.reference),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const nextStatus = d.status || "pending";
        if (prevStatusRef.current === "pending" && nextStatus === "approved") {
          setJustApprovedNotice(true);
        }
        prevStatusRef.current = nextStatus;
        setLiveTicket({
          status: nextStatus,
          studentNumber: d.studentNumber || "",
          reviewNote: d.reviewNote || "",
          firstName: d.applicant?.firstName || "",
          lastName: d.applicant?.lastName || "",
          email: d.applicant?.email || "",
        });
      },
      (err) => console.error("Ticket status listener error:", err),
    );
    return () => unsub();
  }, [done?.reference]);

  async function handleLookupTicket(ev: React.FormEvent) {
    ev.preventDefault();
    const ref = lookupRef.trim().toUpperCase();
    if (!ref) return;
    setLookupError("");
    try {
      const snap = await getDoc(doc(db, "applications", ref));
      if (!snap.exists()) {
        setLookupError("No application found with that reference number.");
        return;
      }
      const d = snap.data();
      const ticket = { reference: ref, type: (d.type || "freshman") as ApplicationType };
      localStorage.setItem(TICKET_KEY, JSON.stringify(ticket));
      setDone(ticket);
    } catch {
      setLookupError("Unable to check status right now. Please try again.");
    }
  }
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);
  const submitLock = useRef(false);

  /* restore unfinished draft (session only) */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { form?: Partial<Form> };
        if (saved.form) {
          setForm({ ...EMPTY, ...saved.form, consent: false });
          setRestored(true);
        }
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current || done) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: { ...form, consent: false } }));
    } catch {
      /* ignore */
    }
  }, [form, done]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
    setSubmitError("");
  }

  function clearForm() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setForm(EMPTY);
    setErrors({});
    setSubmitError("");
    setRestored(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitLock.current) return;

    const e = validateAll(form);
    if (Object.keys(e).length) {
      setErrors(e);
      const first = Object.keys(e)[0];
      requestAnimationFrame(() => {
        const el = document.getElementById(first);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus({ preventScroll: true });
      });
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    const reference = generateReference();
    const nowIso = new Date().toISOString();

    try {
      await setDoc(doc(db, "applications", reference), {
        reference,
        status: "pending",
        type: form.type,
        schemaVersion: 2,
        applicant: {
          firstName: tidy(form.firstName),
          middleName: tidy(form.middleName),
          lastName: tidy(form.lastName),
          suffix: tidy(form.suffix),
          birthDate: form.birthDate,
          placeOfBirth: tidy(form.placeOfBirth),
          sex: form.sex,
          civilStatus: form.civilStatus,
          citizenship: tidy(form.citizenship),
          specialNeeds: tidy(form.specialNeeds),
          email: form.email.trim().toLowerCase(),
          mobile: phone(form.mobile),
          addressLine: tidy(form.addressLine),
          city: tidy(form.city),
          province: tidy(form.province),
          zip: form.zip,
          guardianName: tidy(form.guardianName),
          guardianRelationship: tidy(form.guardianRelationship),
          guardianMobile: phone(form.guardianMobile),
          guardianEmail: form.guardianEmail.trim().toLowerCase(),
          guardianOccupation: tidy(form.guardianOccupation),
          previousSchool: tidy(form.previousSchool),
          previousSchoolType: form.previousSchoolType,
          previousSchoolCity: tidy(form.previousSchoolCity),
          previousTrack: tidy(form.previousTrack),
          yearGraduated: form.yearGraduated,
          lrn: form.lrn,
          generalAverage: form.generalAverage,
          programId: form.programId,
          secondProgramId: form.secondProgramId,
          entryTerm: form.entryTerm,
          heardFrom: form.heardFrom,
          consent: true,
        },
        documents: {},
        reviewNote: "",
        consentAtIso: nowIso,
        submittedAtIso: nowIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setDone({ reference, type: form.type });
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      console.error("Failed to submit application to Firestore:", err);
      const reason =
        err?.code === "permission-denied"
          ? "The server rejected the submission (permission-denied)."
          : err?.code === "unavailable"
            ? "We couldn't reach the server. Check your connection and try again."
            : err?.message || "Please check your connection and try again.";
      setSubmitError(`We couldn't submit your application: ${reason}`);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  }

  async function copyReference() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const isFreshman = form.type === "freshman";
  const errorCount = Object.keys(errors).length;

  const describedBy = (id: string, hint?: string) =>
    errors[id] ? `${id}-error` : hint ? `${id}-hint` : undefined;

  function text(
    key: StrKey,
    label: string,
    o: {
      required?: boolean;
      hint?: string;
      type?: string;
      autoComplete?: string;
      inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
      placeholder?: string;
      maxLength?: number;
      transform?: (v: string) => string;
      className?: string;
    } = {},
  ) {
    return (
      <Field id={key} label={label} required={o.required} error={errors[key]} hint={o.hint} className={o.className}>
        <input
          id={key}
          type={o.type ?? "text"}
          inputMode={o.inputMode}
          autoCapitalize={o.type === "email" ? "none" : undefined}
          autoComplete={o.autoComplete}
          placeholder={o.placeholder}
          maxLength={o.maxLength}
value={form[key]}
          onChange={(e) => set(key, o.transform ? o.transform(e.target.value) : e.target.value)}
          onBlur={() => {
            const fieldErr = validateAll(form)[key];
            if (fieldErr) setErrors((prev) => ({ ...prev, [key]: fieldErr }));
          }}
          aria-invalid={!!errors[key]}
          aria-describedby={describedBy(key, o.hint)}
          className={inputCls(errors[key])}
        />
      </Field>
    );
  }

  function select(
    key: StrKey,
    label: string,
    options: { value: string; label: string }[],
    o: { required?: boolean; hint?: string; placeholder?: string; className?: string } = {},
  ) {
    return (
      <Field id={key} label={label} required={o.required} error={errors[key]} hint={o.hint} className={o.className}>
        <Select
          id={key}
          value={form[key]}
          onChange={(v) => set(key, v)}
          options={options}
          placeholder={o.placeholder}
          allowClear={!o.required}
          invalid={!!errors[key]}
          describedBy={describedBy(key, o.hint)}
        />
      </Field>
    );
  }

  const plain = (list: string[]) => list.map((v) => ({ value: v, label: v }));
  const programOptions = PROGRAMS.map((p) => ({ value: p.id, label: p.label }));

  /* ───────── success receipt ───────── */
/* ───────── success receipt & live status ticket ───────── */
  if (done) {
    const status = liveTicket?.status || "pending";
    const isApproved = status === "approved";
    const isRejected = status === "rejected";
    const studentNo = liveTicket?.studentNumber || "";
    const displayFirst = liveTicket?.firstName || tidy(form.firstName);
    const displayLast = liveTicket?.lastName || tidy(form.lastName);
    const displayEmail = liveTicket?.email || form.email.trim().toLowerCase();
    const schoolEmail = buildSchoolEmail(displayFirst, displayLast);
    const loginEmail = studentNo ? `${studentNo}@dlsau.edu.ph` : "";

    return (
      <Shell>
        <div className="border border-zinc-300 bg-white shadow-sm">
          <div className={`h-2 w-full ${isApproved ? "bg-emerald-600" : isRejected ? "bg-red-700" : "bg-emerald-900"}`} />
          <div className="p-6 sm:p-10" role="status">
            {justApprovedNotice && (
              <div className="mb-5 border border-emerald-400 border-l-4 border-l-emerald-700 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
                Notification: Your application has just been approved by the Registrar! Your student account credentials are now ready below.
              </div>
            )}

            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">
                  De La Salle Araneta University • Office of Admissions
                </p>
                <h2 className="mt-1 text-2xl font-bold text-zinc-900">
                  {isApproved ? "Application Approved" : isRejected ? "Application Update" : "Application Received"}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  {isApproved ? (
                    <>
                      Welcome to DLSAU, <span className="font-semibold text-zinc-900">{displayFirst} {displayLast}</span>!
                      Use your assigned Student ID and default password below to sign in and complete enrollment.
                    </>
                  ) : (
                    <>
                      Thank you, <span className="font-semibold text-zinc-900">{displayFirst} {displayLast}</span>.
                      This ticket updates automatically once the Registrar&apos;s Office reviews your application
                      {displayEmail ? ` (updates also sent to ${displayEmail})` : ""}.
                    </>
                  )}
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  isApproved
                    ? "bg-emerald-800 text-white"
                    : isRejected
                      ? "bg-red-700 text-white"
                      : "bg-amber-100 text-amber-900"
                }`}
              >
                {isApproved ? "Approved" : isRejected ? "Not Approved" : "Pending Review"}
              </span>
            </div>

            {isApproved && studentNo && (
              <div className="mt-6 border-2 border-emerald-800 bg-emerald-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Your Student Portal Credentials
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Save these details. You will be asked to change your default password on your first sign-in.
                </p>

                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="border border-emerald-900/15 bg-white px-4 py-3">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Student ID Number</dt>
                    <dd className="mt-1 font-mono text-lg font-bold text-emerald-950">{studentNo}</dd>
                  </div>
                  <div className="border border-emerald-900/15 bg-white px-4 py-3">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Default Password</dt>
                    <dd className="mt-1 font-mono text-lg font-bold text-emerald-950">{DEFAULT_STUDENT_PASSWORD}</dd>
                  </div>
                  <div className="border border-emerald-900/15 bg-white px-4 py-3">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Portal Login Email</dt>
                    <dd className="mt-1 break-all font-mono text-sm font-bold text-zinc-900">{loginEmail}</dd>
                  </div>
                  {schoolEmail && (
                    <div className="border border-emerald-900/15 bg-white px-4 py-3">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">DLSAU School Email</dt>
                      <dd className="mt-1 break-all font-mono text-sm font-bold text-zinc-900">{schoolEmail}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 print:hidden">
                  <Link
                    href="/"
                    className="inline-flex border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                  >
                    Sign In to Student Portal →
                  </Link>
                </div>
              </div>
            )}

            {isRejected && liveTicket?.reviewNote && (
              <div className="mt-6 border border-red-300 border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">
                <span className="font-bold">Registrar Note:</span> {liveTicket.reviewNote}
              </div>
            )}
<div className="mt-6 border border-emerald-900/20 border-l-4 border-l-emerald-800 bg-emerald-50/40 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                Application Tracking / Reference Number
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-2xl font-bold tracking-wider text-emerald-950">{done.reference}</p>
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={copyReference}
                    className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                  >
                    Print Slip
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/70 px-4 py-3 text-xs text-amber-950">
              <p className="font-bold uppercase tracking-wider text-amber-900">
                Important — Keep Your Tracking Number Safe
              </p>
              <p className="mt-1 leading-relaxed">
                Copy, print, or screenshot <span className="font-mono font-bold">{done.reference}</span>. You can enter
                this number anytime on the <span className="font-semibold">Sign In</span> page to track your admission
                progress and claim your <span className="font-semibold">Student ID, School Email, and Default Password</span> once approved.
              </p>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">Next Steps</h3>
                <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-zinc-700">
                  <li>Wait for the Registrar&apos;s Office to verify your submitted details.</li>
                  <li>Submit the required documents below together with your reference number.</li>
                  <li>Check your email for admission confirmation and enrollment instructions.</li>
                </ol>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                  Required Documents ({TYPE_LABEL[done.type]})
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-zinc-700">
                  {REQUIRED_DOCS[done.type].map((d) => (
                    <li key={d.key} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-emerald-800" />
                      {d.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-zinc-200 pt-5 print:hidden">
              <Link
                href="/"
                className="inline-flex bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* ───────── official paper-style admission form ───────── */
  return (
    <Shell>
      <div className="border border-zinc-300 bg-white shadow-sm">
        {/* Official University Form Masthead */}
        <div className="border-b-2 border-emerald-900 bg-white px-6 py-6 sm:px-10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Image
                src="/logo/dlsau.png"
                alt="DLSAU logo"
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 object-contain"
                priority
              />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-900">
                  De La Salle Araneta University
                </p>
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                  APPLICATION FOR ADMISSION
                </h1>
                <p className="text-xs text-zinc-500">
                  Office of Admissions and Registrar • Victoneta Avenue, Malabon City
                </p>
              </div>
            </div>
            <div className="border border-zinc-300 bg-zinc-50 px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Form No.</p>
              <p className="font-mono text-xs font-bold text-zinc-800">DLSAU-ADM-01</p>
            </div>
          </div>

          <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-600">
            <span className="font-bold text-zinc-800">Instructions:</span> Fill out all required fields marked with{" "}
            <span className="font-bold text-red-600">*</span> accurately as they appear on your official records (PSA
            Birth Certificate / Form 138). Leave optional fields blank if not applicable.
          </div>
        </div>

{/* Existing Ticket Lookup */}
        <form
          onSubmit={handleLookupTicket}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-3 sm:px-10"
        >
          <span className="text-xs font-semibold text-zinc-600">
            Already applied? Check your ticket &amp; credentials:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={lookupRef}
              onChange={(e) => {
                setLookupRef(e.target.value);
                setLookupError("");
              }}
              placeholder="APP-2026-XXXXXX"
              className="w-44 border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs uppercase text-zinc-900 focus:border-emerald-800 focus:outline-none"
            />
            <button
              type="submit"
              className="bg-emerald-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
            >
              Check Status
            </button>
          </div>
          {lookupError && (
            <p className="w-full text-xs font-medium text-red-600">{lookupError}</p>
          )}
        </form>

        <form noValidate onSubmit={handleSubmit} className="divide-y divide-zinc-200">
          {/* Draft / Error Banners */}
          {(restored || errorCount > 0 || submitError) && (
            <div className="space-y-3 bg-zinc-50 px-6 py-4 sm:px-10">
              {restored && (
                <div className="flex flex-wrap items-center justify-between gap-2 border border-emerald-900/20 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-950">
                  <span>We restored your unfinished form from this browser tab.</span>
                  <button type="button" onClick={clearForm} className="font-bold underline hover:no-underline">
                    Clear form
                  </button>
                </div>
              )}

              {errorCount > 0 && (
                <div role="alert" className="border border-red-300 border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-xs font-semibold text-red-900">
                  Please check the highlighted fields below ({errorCount} {errorCount === 1 ? "item" : "items"} need attention).
                </div>
              )}

              {submitError && (
                <div role="alert" className="border border-red-300 border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-xs font-semibold text-red-900">
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* I. PROGRAM & ENTRY TERM */}
          <FormSection number="I" title="Applicant Type & Program Preference">
            <div className="flex flex-col gap-5">
              <RadioRow
                legend="Applicant Classification"
                required
                value={form.type}
                onChange={(v) => set("type", v)}
                options={(Object.keys(TYPE_LABEL) as ApplicationType[]).map((t) => ({
                  value: t,
                  label: TYPE_LABEL[t],
                }))}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {select("programId", "First Choice Program", programOptions, {
                  required: true,
                  placeholder: "Select degree program",
                })}
                {select(
                  "secondProgramId",
                  "Second Choice Program",
                  programOptions.filter((p) => p.value !== form.programId),
                  {
                    placeholder: "None (optional)",
                    hint: "Considered if first choice is full.",
                  },
                )}
                {select("entryTerm", "Intended Trimester of Entry", plain(ENTRY_TERMS), {
                  required: true,
                  placeholder: "Select trimester",
                })}
                {select("heardFrom", "How did you learn about DLSAU?", plain(HEARD_FROM), {
                  placeholder: "Select (optional)",
                })}
              </div>
            </div>
          </FormSection>

          {/* II. PERSONAL INFORMATION */}
          <FormSection number="II" title="Personal Information">
            <div className="flex flex-col gap-4">
          {/* Standard PH Form Name Row */}
              <div className="grid gap-4 sm:grid-cols-12">
                {text("lastName", "Last Name (Surname)", {
                  required: true,
                  autoComplete: "family-name",
                  placeholder: "Dela Cruz",
                  transform: onlyNameChars,
                  className: "sm:col-span-4",
                })}
                {text("firstName", "First Name (Given Name)", {
                  required: true,
                  autoComplete: "given-name",
                  placeholder: "Juan",
                  transform: onlyNameChars,
                  className: "sm:col-span-4",
                })}
                {text("middleName", "Middle Name", {
                  autoComplete: "additional-name",
                  placeholder: "Santos",
                  transform: onlyNameChars,
                  className: "sm:col-span-3",
                })}
                {text("suffix", "Suffix", {
                  autoComplete: "honorific-suffix",
                  placeholder: "Jr.",
                  transform: onlyNameChars,
                  className: "sm:col-span-1",
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="birthDate" label="Date of Birth" required error={errors.birthDate}>
                  <DateField
                    id="birthDate"
                    value={form.birthDate}
                    onChange={(v) => set("birthDate", v)}
                    invalid={!!errors.birthDate}
                    describedBy={describedBy("birthDate")}
                  />
                </Field>
                {text("placeOfBirth", "Place of Birth", {
                  required: true,
                  placeholder: "City / Municipality, Province",
                  transform: onlyPlaceChars,
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {select("sex", "Sex", plain(["Female", "Male"]), { required: true })}
                {select("civilStatus", "Civil Status", plain(CIVIL_STATUS), { required: true })}
                {text("citizenship", "Citizenship", {
                  required: true,
                  transform: onlyPlaceChars,
                })}
              </div>

              <Field
                id="specialNeeds"
                label="Accessibility / Learning Support Needs (Optional)"
                error={errors.specialNeeds}
                hint={`Shared confidentially with the Registrar's Office only. (${form.specialNeeds.length}/300)`}
              >
                <textarea
                  id="specialNeeds"
                  rows={2}
                  maxLength={300}
                  placeholder="Leave blank if none"
                  value={form.specialNeeds}
                  onChange={(e) => set("specialNeeds", e.target.value)}
                  aria-invalid={!!errors.specialNeeds}
                  aria-describedby={describedBy("specialNeeds", "hint")}
                  className={inputCls(errors.specialNeeds)}
                />
              </Field>
            </div>
          </FormSection>

          {/* III. CONTACT & HOME ADDRESS */}
          <FormSection number="III" title="Contact Information & Home Address">
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {text("email", "Active Email Address", {
                  required: true,
                  type: "email",
                  inputMode: "email",
                  autoComplete: "email",
                  placeholder: "juan.delacruz@gmail.com",
                })}
{text("mobile", "Mobile Number", {
                  required: true,
                  type: "tel",
                  inputMode: "tel",
                  autoComplete: "tel",
                  placeholder: "09171234567",
                  maxLength: 13,
                  transform: onlyPhMobile,
                })}
              </div>

              {text("addressLine", "House No. / Street / Subdivision / Barangay", {
                required: true,
                autoComplete: "street-address",
                placeholder: "e.g. 123 Rizal St., Brgy. Potrero",
              })}

<div className="grid gap-4 sm:grid-cols-12">
                {text("city", "City / Municipality", {
                  required: true,
                  autoComplete: "address-level2",
                  placeholder: "Malabon City",
                  transform: onlyPlaceChars,
                  className: "sm:col-span-5",
                })}
                {text("province", "Province / Region", {
                  required: true,
                  autoComplete: "address-level1",
                  placeholder: "Metro Manila",
                  transform: onlyPlaceChars,
                  className: "sm:col-span-5",
                })}
                {text("zip", "ZIP Code", {
                  inputMode: "numeric",
                  autoComplete: "postal-code",
                  placeholder: "1475",
                  transform: (v) => digits(v, 4),
                  className: "sm:col-span-2",
                })}
              </div>
            </div>
          </FormSection>

          {/* IV. PARENT / GUARDIAN */}
          <FormSection number="IV" title="Parent / Legal Guardian Information">
            <div className="grid gap-4 sm:grid-cols-2">
              {text("guardianName", "Full Name of Parent / Guardian", {
                required: true,
                placeholder: "Maria Santos Dela Cruz",
                transform: onlyNameChars,
              })}
              {text("guardianRelationship", "Relationship to Applicant", {
                required: true,
                placeholder: "Mother, Father, Legal Guardian",
                transform: onlyNameChars,
              })}
{text("guardianMobile", "Mobile Number", {
                required: true,
                type: "tel",
                inputMode: "tel",
                placeholder: "09171234567",
                maxLength: 13,
                transform: onlyPhMobile,
              })}
              {text("guardianEmail", "Email Address", {
                type: "email",
                inputMode: "email",
                placeholder: "Optional",
              })}
              {text("guardianOccupation", "Occupation", {
                placeholder: "Optional",
                className: "sm:col-span-2",
              })}
            </div>
          </FormSection>

          {/* V. EDUCATIONAL BACKGROUND */}
          <FormSection number="V" title="Educational Background">
            <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-12">
                {text("previousSchool", isFreshman ? "Senior High School Attended" : "Last College / University Attended", {
                  required: true,
                  placeholder: "Full name of school",
                  transform: onlySchoolChars,
                  className: "sm:col-span-8",
                })}
                {select("previousSchoolType", "School Type", plain(SCHOOL_TYPES), {
                  required: true,
                  className: "sm:col-span-4",
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {text("previousSchoolCity", "School City / Municipality", {
                  required: true,
                  placeholder: "e.g. Malabon City",
                  transform: onlyPlaceChars,
                })}
                {text("previousTrack", isFreshman ? "SHS Strand / Track" : "Previous Degree / Course", {
                  required: true,
                  placeholder: isFreshman ? "e.g. STEM, ABM, HUMSS" : "e.g. BS Information Technology",
                  transform: onlySchoolChars,
                })}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {text("yearGraduated", isFreshman ? "Year Graduated" : "Last Year Attended", {
                  required: true,
                  inputMode: "numeric",
                  placeholder: String(new Date().getFullYear()),
                  transform: (v) => digits(v, 4),
                })}
                {text("generalAverage", isFreshman ? "General Average (%)" : "General Weighted Average", {
                  inputMode: "decimal",
                  placeholder: "e.g. 90.5",
                  transform: (v) => v.replace(/[^\d.]/g, "").slice(0, 6),
                })}
                {text("lrn", "Learner Reference No. (LRN)", {
                  inputMode: "numeric",
                  placeholder: "12-digit LRN",
                  transform: (v) => digits(v, 12),
                })}
              </div>
            </div>
          </FormSection>

          {/* VI. DECLARATION & CONSENT */}
          <FormSection number="VI" title="Applicant's Certification & Data Privacy Consent">
            <div className="border border-zinc-200 bg-zinc-50 p-4">
              <Checkbox
                id="consent"
                checked={form.consent}
                onChange={(v) => set("consent", v)}
                invalid={!!errors.consent}
                describedBy={errors.consent ? "consent-error" : undefined}
              >
                <span className="text-xs leading-relaxed text-zinc-700">
                  I hereby certify that all information provided in this application form is true, complete, and accurate
                  to the best of my knowledge. I understand that any false or misleading statement may result in the
                  disapproval of my application. I consent to{" "}
                  <span className="font-semibold text-zinc-900">De La Salle Araneta University</span> collecting and
                  processing my personal data for admission and enrollment purposes in accordance with the{" "}
                  <span className="font-semibold text-zinc-900">Data Privacy Act of 2012 (RA 10173)</span>.
                </span>
              </Checkbox>
              {errors.consent && (
                <p id="consent-error" className="mt-2 text-xs font-medium text-red-600">
                  {errors.consent}
                </p>
              )}
            </div>
          </FormSection>

          {/* FORM FOOTER ACTIONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 px-6 py-5 sm:px-10">
            <button
              type="button"
              onClick={clearForm}
              disabled={submitting}
              className="border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="border-l-4 border-emerald-400 bg-emerald-900 px-7 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting Application..." : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

/* ───────── layout primitives ───────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F3F5F4] font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1.5 bg-emerald-800" />
            <span className="text-sm font-bold tracking-tight text-emerald-950">PATHWAYS</span>
            <span className="text-xs text-zinc-400">/</span>
            <span className="text-xs font-semibold text-zinc-600">Online Admissions</span>
          </div>
          <Link href="/" className="text-xs font-bold text-emerald-900 hover:underline">
            Already enrolled? Sign in →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {children}
        <p className="mt-6 text-center text-xs text-zinc-500 print:hidden">
          De La Salle Araneta University • Office of Admissions and Registrar
        </p>
      </main>
    </div>
  );
}

function FormSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 py-6 sm:px-10">
      <div className="mb-4 flex items-center gap-2.5 border-b border-zinc-200 pb-2">
        <span className="bg-emerald-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{number}</span>
        <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-semibold text-zinc-700">
        {label}
        {required && <span className="ml-0.5 font-bold text-red-600">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[11px] text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[11px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* ───────── custom controls ───────── */

type Opt = { value: string; label: string };

function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Select",
  allowClear,
  invalid,
  describedBy,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder?: string;
  allowClear?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items: Opt[] = allowClear ? [{ value: "", label: placeholder }, ...options] : options;
  const selectedIdx = items.findIndex((o) => o.value === value);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    setActive(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
  }

  function choose(i: number) {
    onChange(items[i].value);
    setOpen(false);
    rootRef.current?.querySelector<HTMLElement>("button")?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const last = items.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(last, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`${inputCls(invalid ? "error" : undefined)} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected ? "" : "text-zinc-400"}`}>{selected ? selected.label : placeholder}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-zinc-300 bg-white py-1 shadow-lg"
        >
          {items.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value || "__none"}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                  i === active ? "bg-emerald-50 text-emerald-950" : "text-zinc-800"
                } ${isSelected ? "font-bold" : ""} ${o.value === "" ? "text-zinc-400" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && o.value !== "" && (
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-emerald-800">
                    <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const maxDay = (y: string, m: string) => (m ? new Date(Number(y) || 2024, Number(m), 0).getDate() : 31);

function DateField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [y = "", m = "", d = ""] = value ? value.split("-") : [];
  const thisYear = new Date().getFullYear();

  const months: Opt[] = MONTHS.map((n, i) => ({ value: String(i + 1).padStart(2, "0"), label: n }));
  const days: Opt[] = Array.from({ length: maxDay(y, m) }, (_, i) => ({
    value: String(i + 1).padStart(2, "0"),
    label: String(i + 1),
  }));
  const years: Opt[] = Array.from({ length: thisYear - 1940 + 1 }, (_, i) => {
    const v = String(thisYear - i);
    return { value: v, label: v };
  });

  function update(ny: string, nm: string, nd: string) {
    const max = maxDay(ny, nm);
    if (nd && Number(nd) > max) nd = String(max).padStart(2, "0");
    onChange(ny || nm || nd ? `${ny}-${nm}-${nd}` : "");
  }

  return (
    <div className="grid grid-cols-[3fr_2fr_2fr] gap-2">
      <Select id={id} value={m} onChange={(v) => update(y, v, d)} options={months} placeholder="Month" invalid={invalid} describedBy={describedBy} />
      <Select id={`${id}-day`} ariaLabel="Day of birth" value={d} onChange={(v) => update(y, m, v)} options={days} placeholder="Day" invalid={invalid} />
      <Select id={`${id}-year`} ariaLabel="Year of birth" value={y} onChange={(v) => update(v, m, d)} options={years} placeholder="Year" invalid={invalid} />
    </div>
  );
}

function RadioRow<T extends string>({
  legend,
  required,
  value,
  options,
  onChange,
}: {
  legend: string;
  required?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-700">
        {legend}
        {required && <span className="ml-0.5 font-bold text-red-600">*</span>}
      </span>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-3">
        {options.map((o) => {
          const sel = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onChange(o.value)}
              className={`flex items-center gap-2.5 border px-4 py-2 text-sm font-medium transition-colors ${
                sel
                  ? "border-emerald-800 bg-emerald-50 text-emerald-950 font-semibold"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-4 w-4 place-items-center rounded-full border-2 ${
                  sel ? "border-emerald-800" : "border-zinc-400"
                }`}
              >
                {sel && <span className="h-2 w-2 rounded-full bg-emerald-800" />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  invalid,
  describedBy,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  invalid?: boolean;
  describedBy?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border transition-colors ${
          checked
            ? "border-emerald-900 bg-emerald-900 text-white"
            : invalid
              ? "border-red-500 bg-white"
              : "border-zinc-400 bg-white hover:border-emerald-800"
        }`}
      >
        {checked && (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3 w-3">
            <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
        )}
      </button>
      <div id={`${id}-label`} className="cursor-pointer" onClick={() => onChange(!checked)}>
        {children}
      </div>
    </div>
  );
}