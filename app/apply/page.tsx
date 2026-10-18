"use client";

// app/apply/page.tsx  (public: no sign-in needed)

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  PROGRAMS,
  REQUIRED_DOCS,
  TYPE_LABEL,
  generateReference,
  programLabel,
  type ApplicationType,
} from "@/lib/applications";

interface Form {
  type: ApplicationType;
  programId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string;
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
  previousTrack: string;
  yearGraduated: string;
  consent: boolean;
}

const EMPTY: Form = {
  type: "freshman",
  programId: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  birthDate: "",
  sex: "",
  citizenship: "Filipino",
  email: "",
  mobile: "",
  addressLine: "",
  city: "",
  province: "",
  zip: "",
  guardianName: "",
  guardianRelationship: "",
  guardianMobile: "",
  previousSchool: "",
  previousTrack: "",
  yearGraduated: "",
  consent: false,
};

const STEPS = ["Program", "Personal", "Contact", "School", "Review"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^(09\d{9}|\+639\d{9})$/;
const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
const phone = (s: string) => s.replace(/[\s-]/g, "");

function validateStep(step: number, f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: keyof Form, msg: string) => {
    if (!String(f[k]).trim()) e[k] = msg;
  };

  if (step === 0) {
    req("programId", "Choose the program you're applying for.");
  }
  if (step === 1) {
    req("firstName", "First name is required.");
    req("lastName", "Last name is required.");
    req("sex", "Select one.");
    req("citizenship", "Citizenship is required.");
    const bd = new Date(f.birthDate);
    if (!f.birthDate || isNaN(bd.getTime())) e.birthDate = "Enter your date of birth.";
    else if (bd > new Date()) e.birthDate = "Date of birth can't be in the future.";
    else if (bd.getFullYear() < 1940) e.birthDate = "Check the year.";
  }
  if (step === 2) {
    if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address.";
    if (!MOBILE_RE.test(phone(f.mobile))) e.mobile = "Use a number like 09171234567.";
    req("addressLine", "Street / barangay is required.");
    req("city", "City or municipality is required.");
    req("province", "Province is required.");
    req("guardianName", "Parent or guardian name is required.");
    req("guardianRelationship", "Relationship is required.");
    if (!MOBILE_RE.test(phone(f.guardianMobile))) e.guardianMobile = "Use a number like 09171234567.";
  }
  if (step === 3) {
    req("previousSchool", "School name is required.");
    req("previousTrack", f.type === "freshman" ? "Strand or track is required." : "Course taken is required.");
    const y = Number(f.yearGraduated);
    if (!/^\d{4}$/.test(f.yearGraduated) || y < 1980 || y > new Date().getFullYear())
      e.yearGraduated = "Enter a 4-digit year.";
  }
  if (step === 4 && !f.consent) e.consent = "You need to agree before submitting.";
  return e;
}

const inputCls = (err?: string) =>
  `w-full border bg-zinc-50/50 px-3.5 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-all ${
    err
      ? "border-red-500 focus:border-red-600 focus:bg-white focus:ring-1 focus:ring-red-500"
      : "border-zinc-300 focus:border-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-800"
  }`;

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-zinc-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState<{ reference: string; type: ApplicationType } | null>(null);
  const [trap, setTrap] = useState(""); // honeypot: real people never see or fill this

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
    setSubmitError("");
  }

  function next() {
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    // Pretend success to bots, without writing anything
    if (trap) {
      setDone({ reference: generateReference(), type: form.type });
      return;
    }
    const e = validateStep(4, form);
    setErrors(e);
    if (Object.keys(e).length) return;

setSubmitting(true);
    setSubmitError("");
    const reference = generateReference();
    try {
      await setDoc(doc(db, "applications", reference), {
        reference,
        status: "pending",
        type: form.type,
        applicant: {
          firstName: tidy(form.firstName),
          middleName: tidy(form.middleName),
          lastName: tidy(form.lastName),
          suffix: tidy(form.suffix),
          birthDate: form.birthDate,
          sex: form.sex,
          citizenship: tidy(form.citizenship),
          email: form.email.trim().toLowerCase(),
          mobile: phone(form.mobile),
          addressLine: tidy(form.addressLine),
          city: tidy(form.city),
          province: tidy(form.province),
          zip: tidy(form.zip),
          guardianName: tidy(form.guardianName),
          guardianRelationship: tidy(form.guardianRelationship),
          guardianMobile: phone(form.guardianMobile),
          previousSchool: tidy(form.previousSchool),
          previousTrack: tidy(form.previousTrack),
          yearGraduated: form.yearGraduated,
          programId: form.programId,
          consent: true,
        },
        documents: {},
        reviewNote: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDone({ reference, type: form.type });
    } catch (err: any) {
      console.error("Failed to submit application to Firestore:", err);
      const reason =
        err?.code === "permission-denied"
          ? "Firestore Rules blocked the write (permission-denied). Update your Firestore Rules in Firebase Console to allow creating documents in `applications`."
          : err?.message || "Please check your connection and try again.";
      setSubmitError(`We couldn't submit your application: ${reason}`);
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  /* ───────── success screen ───────── */
  if (done) {
    return (
      <Shell>
        <div className="border border-emerald-900/15 bg-white shadow-xs">
          <div className="h-2 w-full bg-emerald-900 flex">
            <div className="h-full w-20 bg-emerald-600" />
            <div className="h-full w-8 bg-emerald-400" />
          </div>
          <div className="p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-8 w-2 bg-emerald-800" />
              <h2 className="text-xl font-bold text-zinc-900">Application received</h2>
            </div>
            <p className="text-sm text-zinc-700">
              Thank you. The Registrar&apos;s Office will review your application and contact you at the email address
              you provided. Keep your reference number.
            </p>
            <div className="mt-5 border border-emerald-900/15 border-l-4 border-l-emerald-700 bg-emerald-50/50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Reference number</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-emerald-950">{done.reference}</p>
            </div>

            <h3 className="mt-6 text-sm font-bold text-zinc-900">Documents to bring to the Registrar&apos;s Office</h3>
            <p className="mt-1 text-xs text-zinc-600">Your application can&apos;t be approved until these are received.</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-zinc-800">
              {REQUIRED_DOCS[done.type].map((d) => (
                <li key={d.key} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 bg-emerald-700" />
                  {d.label}
                </li>
              ))}
            </ul>

            <Link
              href="/"
              className="mt-7 inline-flex border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  /* ───────── form ───────── */
  return (
    <Shell>
      {/* progress */}
      <nav aria-label="Application progress" className="mb-5">
        <ol className="flex items-center gap-1.5">
          {STEPS.map((label, i) => {
            const state = i < step ? "done" : i === step ? "current" : "todo";
            return (
              <li key={label} className="flex flex-1 flex-col gap-1.5" aria-current={state === "current" ? "step" : undefined}>
                <div
                  className={`h-1.5 w-full ${
                    state === "done" ? "bg-emerald-700" : state === "current" ? "bg-emerald-400" : "bg-zinc-200"
                  }`}
                />
                <span
                  className={`hidden text-[11px] font-bold uppercase tracking-wider sm:block ${
                    state === "todo" ? "text-zinc-400" : "text-emerald-900"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-emerald-900 sm:hidden">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </nav>

      <div className="border border-emerald-900/15 bg-white shadow-xs">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-20 bg-emerald-600" />
          <div className="h-full w-8 bg-emerald-400" />
        </div>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) next();
            else submit();
          }}
          className="p-6 sm:p-8"
        >
          {/* hidden honeypot */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
            </label>
          </div>

          {submitError && (
            <div role="alert" className="mb-5 flex items-stretch border border-red-300 bg-red-50/50 text-red-900">
              <div className="w-2 shrink-0 bg-red-600" />
              <div className="px-4 py-3 text-sm font-semibold">{submitError}</div>
            </div>
          )}

          {/* STEP 0 */}
          {step === 0 && (
            <section className="flex flex-col gap-5">
              <StepTitle title="What are you applying for?" sub="Pick your applicant type and the program you want." />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">Applicant type</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(TYPE_LABEL) as ApplicationType[]).map((t) => (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-center gap-3 border border-l-4 px-4 py-3 text-sm font-semibold ${
                        form.type === t
                          ? "border-emerald-900 border-l-emerald-500 bg-emerald-50 text-emerald-950"
                          : "border-zinc-300 border-l-zinc-300 bg-white text-zinc-700 hover:bg-emerald-50/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={t}
                        checked={form.type === t}
                        onChange={() => set("type", t)}
                        className="accent-emerald-800"
                      />
                      {TYPE_LABEL[t]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field id="programId" label="Program" error={errors.programId}>
                <select
                  id="programId"
                  value={form.programId}
                  onChange={(e) => set("programId", e.target.value)}
                  aria-invalid={!!errors.programId}
                  aria-describedby={errors.programId ? "programId-error" : undefined}
                  className={inputCls(errors.programId)}
                >
                  <option value="">Select a program</option>
                  {PROGRAMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            </section>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <section className="flex flex-col gap-5">
              <StepTitle title="About you" sub="Enter your name exactly as it appears on your birth certificate." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="firstName" label="First name" error={errors.firstName}>
                  <input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? "firstName-error" : undefined} className={inputCls(errors.firstName)} />
                </Field>
                <Field id="middleName" label="Middle name" hint="Leave blank if none.">
                  <input id="middleName" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} autoComplete="additional-name" className={inputCls()} />
                </Field>
                <Field id="lastName" label="Last name" error={errors.lastName}>
                  <input id="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? "lastName-error" : undefined} className={inputCls(errors.lastName)} />
                </Field>
                <Field id="suffix" label="Suffix" hint="Jr., Sr., III, etc.">
                  <input id="suffix" value={form.suffix} onChange={(e) => set("suffix", e.target.value)} className={inputCls()} />
                </Field>
                <Field id="birthDate" label="Date of birth" error={errors.birthDate}>
                  <input id="birthDate" type="date" max={today} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} autoComplete="bday" aria-invalid={!!errors.birthDate} aria-describedby={errors.birthDate ? "birthDate-error" : undefined} className={inputCls(errors.birthDate)} />
                </Field>
                <Field id="sex" label="Sex" error={errors.sex}>
                  <select id="sex" value={form.sex} onChange={(e) => set("sex", e.target.value)} aria-invalid={!!errors.sex} aria-describedby={errors.sex ? "sex-error" : undefined} className={inputCls(errors.sex)}>
                    <option value="">Select</option>
                    <option>Female</option>
                    <option>Male</option>
                  </select>
                </Field>
                <Field id="citizenship" label="Citizenship" error={errors.citizenship}>
                  <input id="citizenship" value={form.citizenship} onChange={(e) => set("citizenship", e.target.value)} aria-invalid={!!errors.citizenship} aria-describedby={errors.citizenship ? "citizenship-error" : undefined} className={inputCls(errors.citizenship)} />
                </Field>
              </div>
            </section>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <section className="flex flex-col gap-5">
              <StepTitle title="Contact and guardian" sub="We'll use your email to reach you about your application." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="email" label="Email address" error={errors.email}>
                  <input id="email" type="email" inputMode="email" autoCapitalize="none" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} className={inputCls(errors.email)} />
                </Field>
                <Field id="mobile" label="Mobile number" error={errors.mobile}>
                  <input id="mobile" type="tel" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="09171234567" autoComplete="tel" aria-invalid={!!errors.mobile} aria-describedby={errors.mobile ? "mobile-error" : undefined} className={inputCls(errors.mobile)} />
                </Field>
              </div>
              <Field id="addressLine" label="Street / barangay" error={errors.addressLine}>
                <input id="addressLine" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} autoComplete="street-address" aria-invalid={!!errors.addressLine} aria-describedby={errors.addressLine ? "addressLine-error" : undefined} className={inputCls(errors.addressLine)} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field id="city" label="City / municipality" error={errors.city}>
                  <input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" aria-invalid={!!errors.city} aria-describedby={errors.city ? "city-error" : undefined} className={inputCls(errors.city)} />
                </Field>
                <Field id="province" label="Province" error={errors.province}>
                  <input id="province" value={form.province} onChange={(e) => set("province", e.target.value)} autoComplete="address-level1" aria-invalid={!!errors.province} aria-describedby={errors.province ? "province-error" : undefined} className={inputCls(errors.province)} />
                </Field>
                <Field id="zip" label="ZIP code">
                  <input id="zip" inputMode="numeric" value={form.zip} onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="postal-code" className={inputCls()} />
                </Field>
              </div>

              <div className="mt-1 border-t border-zinc-200 pt-5">
                <h3 className="mb-4 text-sm font-bold text-zinc-900">Parent or guardian</h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="guardianName" label="Full name" error={errors.guardianName}>
                    <input id="guardianName" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} aria-invalid={!!errors.guardianName} aria-describedby={errors.guardianName ? "guardianName-error" : undefined} className={inputCls(errors.guardianName)} />
                  </Field>
                  <Field id="guardianRelationship" label="Relationship" error={errors.guardianRelationship}>
                    <input id="guardianRelationship" value={form.guardianRelationship} onChange={(e) => set("guardianRelationship", e.target.value)} placeholder="Mother, Father, Aunt..." aria-invalid={!!errors.guardianRelationship} aria-describedby={errors.guardianRelationship ? "guardianRelationship-error" : undefined} className={inputCls(errors.guardianRelationship)} />
                  </Field>
                  <Field id="guardianMobile" label="Mobile number" error={errors.guardianMobile}>
                    <input id="guardianMobile" type="tel" inputMode="tel" value={form.guardianMobile} onChange={(e) => set("guardianMobile", e.target.value)} placeholder="09171234567" aria-invalid={!!errors.guardianMobile} aria-describedby={errors.guardianMobile ? "guardianMobile-error" : undefined} className={inputCls(errors.guardianMobile)} />
                  </Field>
                </div>
              </div>
            </section>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <section className="flex flex-col gap-5">
              <StepTitle
                title="Previous school"
                sub={form.type === "freshman" ? "Your senior high school." : "The last school you attended."}
              />
              <Field id="previousSchool" label="School name" error={errors.previousSchool}>
                <input id="previousSchool" value={form.previousSchool} onChange={(e) => set("previousSchool", e.target.value)} aria-invalid={!!errors.previousSchool} aria-describedby={errors.previousSchool ? "previousSchool-error" : undefined} className={inputCls(errors.previousSchool)} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="previousTrack"
                  label={form.type === "freshman" ? "Strand / track" : "Course taken"}
                  error={errors.previousTrack}
                  hint={form.type === "freshman" ? "e.g. STEM, ABM, HUMSS" : "e.g. BS Information Technology"}
                >
                  <input id="previousTrack" value={form.previousTrack} onChange={(e) => set("previousTrack", e.target.value)} aria-invalid={!!errors.previousTrack} aria-describedby={errors.previousTrack ? "previousTrack-error" : undefined} className={inputCls(errors.previousTrack)} />
                </Field>
                <Field
                  id="yearGraduated"
                  label={form.type === "freshman" ? "Year graduated" : "Last year attended"}
                  error={errors.yearGraduated}
                >
                  <input id="yearGraduated" inputMode="numeric" value={form.yearGraduated} onChange={(e) => set("yearGraduated", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2026" aria-invalid={!!errors.yearGraduated} aria-describedby={errors.yearGraduated ? "yearGraduated-error" : undefined} className={inputCls(errors.yearGraduated)} />
                </Field>
              </div>
            </section>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <section className="flex flex-col gap-5">
              <StepTitle title="Review and submit" sub="Make sure everything is correct. You can go back to change anything." />
              <dl className="grid gap-x-6 gap-y-3 border border-zinc-200 bg-zinc-50/50 p-4 text-sm sm:grid-cols-2">
                <Row k="Applicant type" v={TYPE_LABEL[form.type]} />
                <Row k="Program" v={programLabel(form.programId)} />
                <Row k="Name" v={[form.firstName, form.middleName, form.lastName, form.suffix].map(tidy).filter(Boolean).join(" ")} />
                <Row k="Date of birth" v={form.birthDate} />
                <Row k="Sex" v={form.sex} />
                <Row k="Citizenship" v={form.citizenship} />
                <Row k="Email" v={form.email} />
                <Row k="Mobile" v={form.mobile} />
                <Row k="Address" v={[form.addressLine, form.city, form.province, form.zip].map(tidy).filter(Boolean).join(", ")} />
                <Row k="Parent / guardian" v={`${form.guardianName} (${form.guardianRelationship}), ${form.guardianMobile}`} />
                <Row k="Previous school" v={`${form.previousSchool}, ${form.previousTrack}, ${form.yearGraduated}`} />
              </dl>

              <div>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => set("consent", e.target.checked)}
                    aria-invalid={!!errors.consent}
                    aria-describedby={errors.consent ? "consent-error" : undefined}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-800"
                  />
                  <span>
                    I confirm that the information above is true and correct, and I consent to De La Salle Araneta
                    University collecting and processing my personal information for admission and enrollment, in
                    accordance with the Data Privacy Act of 2012 (RA 10173).
                  </span>
                </label>
                {errors.consent && (
                  <p id="consent-error" className="mt-1.5 text-xs font-medium text-red-600">
                    {errors.consent}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* nav */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-zinc-200 pt-5">
            {step > 0 ? (
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                className="border border-zinc-300 bg-white px-5 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={submitting}
              className="border-l-4 border-emerald-400 bg-emerald-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step < STEPS.length - 1 ? "Continue" : submitting ? "Submitting..." : "Submit application"}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

/* ───────── small layout pieces ───────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F8FAF9] font-sans text-zinc-900">
      <header className="border-b border-emerald-900/15 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/logo/dlsau.png" alt="DLSAU logo" width={40} height={40} className="h-10 w-10 object-contain" priority />
            <div>
              <p className="font-bold leading-none tracking-tight text-emerald-950">PATHWAYS</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">Admissions</p>
            </div>
          </div>
          <Link href="/" className="text-xs font-bold text-emerald-900 hover:underline">
            Already enrolled? Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-5 text-2xl font-bold tracking-tight text-emerald-950">Apply for admission</h1>
        {children}
      </main>
    </div>
  );
}

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-2 bg-emerald-800" />
      <div>
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-600">{sub}</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{k}</dt>
      <dd className="mt-0.5 font-semibold text-zinc-900 break-words">{v || "-"}</dd>
    </div>
  );
}