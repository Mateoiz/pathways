"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, createAuthUserWithoutLoggingOut } from "@/lib/firebase";

import AdminNavbar from "@/components/AdminNavbar";
import { getAcademicConfig } from "@/lib/academicConfig";

/* ---------- Option lists & Auto-Generators ---------- */
const PROGRAMS = [
  "BS Computer Science",
  "BS Accountancy",
  "BSBA Marketing Management",
];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const ENROLLMENT_STATUSES = ["Regular", "Irregular", "Returnee", "Transferee"];
const ADMISSION_TYPES = ["Freshman", "Transferee", "Returnee", "Cross-Enrollee", "Foreign Student"];
const SEMESTERS = ["1st Trimester", "2nd Trimester", "3rd Trimester"];

const PROGRAM_PREFIXES: Record<string, string> = {
  "BS Computer Science": "BSCS",
  "BS Accountancy": "BACC",
  "BSBA Marketing Management": "MKTG",
};
function generateUniversityEmail(firstName: string, lastName: string): string {
  const sanitize = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Convert ñ -> n and strip accents
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const firstGivenName = firstName.trim().split(/\s+/)[0] || "";
  const first = sanitize(firstGivenName);
  const last = sanitize(lastName);

  if (!first && !last) return "";
  return `${first}${first && last ? "." : ""}${last}@dlsau.edu.ph`;
}

function generateDefaultSection(program: string, yearLevel: string): string {
  const prefix = PROGRAM_PREFIXES[program] || "SEC";
  const yearNum = yearLevel.charAt(0) || "1";
  return `${prefix}${yearNum}A`;
}

const SEX_OPTIONS = ["Male", "Female"];
const CIVIL_STATUSES = ["Single", "Married", "Separated", "Widowed"];
const BLOOD_TYPES = ["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const SHS_STRANDS = ["STEM", "ABM", "HUMSS", "GAS", "TVL - ICT", "TVL - Other", "Arts and Design", "Sports", "Other"];
const SCHOLARSHIPS = ["None", "Academic Scholar", "Athletic Scholar", "Government Grant (CHED/TES)", "Institutional Grant", "Other"];
const GUARDIAN_RELATIONS = ["Mother", "Father", "Grandparent", "Sibling", "Aunt / Uncle", "Legal Guardian", "Other"];

const CLEARANCE_GATES = [
  { key: "library", label: "Library" },
  { key: "accounting", label: "Accounting Office" },
  { key: "clinic", label: "Clinic" },
  { key: "disciplinary", label: "Discipline Office" },
  { key: "registrar", label: "Registrar" },
  { key: "guidance", label: "Guidance Office" },
  { key: "laboratory", label: "Laboratory" },
  { key: "studentAffairs", label: "Student Affairs Office" },
];

const REQUIREMENTS = [
  { key: "psaBirthCertificate", label: "PSA Birth Certificate" },
  { key: "form138", label: "Form 138 / Report Card" },
  { key: "goodMoral", label: "Certificate of Good Moral Character" },
  { key: "medicalCertificate", label: "Medical Certificate" },
  { key: "idPictures", label: "2x2 ID Pictures" },
  { key: "transcriptOfRecords", label: "Transcript of Records (Transferees)" },
  { key: "honorableDismissal", label: "Honorable Dismissal (Transferees)" },
];

const currentYear = new Date().getFullYear();
const DEFAULT_STUDENT_ID = `${currentYear}-00-000001`;

const INITIAL_FORM_STATE = {
  personal: {
    studentId: DEFAULT_STUDENT_ID,
    lrn: "",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    dateOfBirth: "",
    placeOfBirth: "",
    sex: "",
    civilStatus: "Single",
    citizenship: "Filipino",
    religion: "",
  },
  contact: {
    email: "",
    personalEmail: "",
    mobileNumber: "",
  },
  address: {
    street: "",
    barangay: "",
    city: "",
    province: "",
    zipCode: "",
  },
  family: {
    fatherName: "",
    fatherOccupation: "",
    fatherContact: "",
    motherName: "",
    motherMaidenName: "",
    motherOccupation: "",
    motherContact: "",
    guardianName: "",
    guardianRelationship: "Mother",
    guardianContact: "",
  },
  emergency: {
    contactName: "",
    relationship: "Mother",
    contactNumber: "",
  },
academic: {
    program: "BS Computer Science",
    major: "",
    yearLevel: "1st Year",
    section: "BSCS1A",
    enrollmentStatus: "Regular",
    admissionType: "Freshman",
    schoolYearAdmitted: `${currentYear}-${currentYear + 1}`,
    semesterAdmitted: "1st Trimester",
    scholarship: "None",
    maxUnits: "21",
    blockEnrolled: "Yes",
  },
  previousSchool: {
    shsName: "",
    shsStrand: "STEM",
    yearGraduated: `${currentYear}`,
    gwa: "",
    lastCollegeAttended: "",
  },
  health: {
    bloodType: "Unknown",
    allergies: "",
    medicalNotes: "",
    pwd: "No",
  },
  clearances: {
    library: "pending",
    accounting: "pending",
    clinic: "pending",
    disciplinary: "pending",
    registrar: "pending",
    guidance: "pending",
    laboratory: "pending",
    studentAffairs: "pending",
  } as Record<string, string>,
  requirements: {
    psaBirthCertificate: false,
    form138: false,
    goodMoral: false,
    medicalCertificate: false,
    idPictures: false,
    transcriptOfRecords: false,
    honorableDismissal: false,
  } as Record<string, boolean>,
};

type FormState = typeof INITIAL_FORM_STATE;
type FieldGroup = "personal" | "contact" | "address" | "family" | "emergency" | "academic" | "previousSchool" | "health";

/* ---------- Shared styles ---------- */
const INPUT_CLASS =
  "w-full border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800";
const LABEL_CLASS = "text-xs font-bold text-zinc-700";

/* ---------- Reusable pieces ---------- */
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border border-emerald-900/15 bg-white shadow-xs">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4">
        <div className="h-6 w-2 bg-emerald-800" />
        <div>
          <h2 className="text-base font-bold uppercase tracking-tight text-zinc-900">{title}</h2>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  placeholder = "Select...",
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between border border-zinc-300 bg-white px-3 py-2 text-left text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
      >
        <span className={value ? "" : "text-zinc-400"}>{value || placeholder}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto border border-emerald-900/20 bg-white py-1 shadow-lg"
        >
          {options.map(option => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-emerald-50 ${
                  option === value ? "font-semibold text-emerald-950" : "text-zinc-700"
                }`}
              >
                {option}
                {option === value && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-800">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CreateStudentProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);

  async function generateNextStudentId() {
    try {
      const snapshot = await getDocs(collection(db, "students"));
      const prefix = `${currentYear}-00-`;
      let maxSequence = 0;

      snapshot.forEach((studentDoc) => {
        const id = studentDoc.id || studentDoc.data().studentId || "";
        if (id.startsWith(prefix)) {
          const sequencePart = parseInt(id.slice(prefix.length), 10);
          if (!isNaN(sequencePart) && sequencePart > maxSequence) {
            maxSequence = sequencePart;
          }
        }
      });

      const nextId = `${prefix}${String(maxSequence + 1).padStart(6, "0")}`;
      setFormData((prev) => ({
        ...prev,
        personal: { ...prev.personal, studentId: nextId },
      }));
    } catch (error) {
      console.error("Failed to generate next student ID:", error);
    }
  }

useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (!storedRole || storedRole !== "admin") {
      router.push("/");
    } else {
      setRole(storedRole);
      generateNextStudentId();
      getAcademicConfig().then((cfg) => {
        setFormData((prev) => ({
          ...prev,
          academic: {
            ...prev.academic,
            schoolYearAdmitted: cfg.schoolYear,
            semesterAdmitted: cfg.currentTerm,
            maxUnits: String(cfg.maxUnitsDefault || 21),
          },
        }));
      });
    }
  }, [router]);

  function showToast(type: "success" | "error", text: string) {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  }

  function setField(group: FieldGroup, name: string, value: string) {
    setFormData(prev => {
      const next: FormState = {
        ...prev,
        [group]: { ...prev[group], [name]: value },
      };

      if (group === "personal" && (name === "firstName" || name === "lastName")) {
        next.contact = {
          ...prev.contact,
          email: generateUniversityEmail(next.personal.firstName, next.personal.lastName),
        };
      }

if (group === "academic") {
        if (name === "admissionType") {
          if (value === "Freshman") {
            next.academic.yearLevel = "1st Year";
            next.academic.enrollmentStatus = "Regular";
            next.academic.blockEnrolled = "Yes";
          } else if (value === "Transferee") {
            next.academic.enrollmentStatus = "Transferee";
            next.academic.blockEnrolled = "No";
          } else if (value === "Returnee") {
            next.academic.enrollmentStatus = "Returnee";
            next.academic.blockEnrolled = "No";
          } else {
            next.academic.blockEnrolled = "No";
          }
        }

        if (name === "yearLevel" && value !== "1st Year") {
          next.academic.blockEnrolled = "No";
        }

        if (name === "program" || name === "yearLevel" || name === "admissionType") {
          next.academic.section = generateDefaultSection(
            next.academic.program,
            next.academic.yearLevel
          );
        }
      }

      if (group === "family") {
        const rel = next.family.guardianRelationship;
        if (rel === "Mother" && (name === "motherName" || name === "motherContact" || name === "guardianRelationship")) {
          next.family.guardianName = next.family.motherName;
          next.family.guardianContact = next.family.motherContact;
        } else if (rel === "Father" && (name === "fatherName" || name === "fatherContact" || name === "guardianRelationship")) {
          next.family.guardianName = next.family.fatherName;
          next.family.guardianContact = next.family.fatherContact;
        }

        next.emergency = {
          contactName: next.family.guardianName,
          relationship: next.family.guardianRelationship,
          contactNumber: next.family.guardianContact,
        };
      }

      return next;
    });
  }

  function handleInputChange(group: FieldGroup) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(group, e.target.name, e.target.value);
  }

  function handleClearanceToggle(gate: string) {
    setFormData(prev => ({
      ...prev,
      clearances: {
        ...prev.clearances,
        [gate]: prev.clearances[gate] === "cleared" ? "pending" : "cleared",
      },
    }));
  }

  function handleRequirementToggle(key: string) {
    setFormData(prev => ({
      ...prev,
      requirements: { ...prev.requirements, [key]: !prev.requirements[key] },
    }));
  }

 async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.personal.sex) {
      showToast("error", "Select the student's sex before saving.");
      return;
    }

    setIsSubmitting(true);

    try {
      const studentId = formData.personal.studentId.trim();
      const studentRef = doc(db, "students", studentId);

      const existing = await getDoc(studentRef);
      if (existing.exists()) {
        showToast("error", `Student no. ${studentId} already exists.`);
        return;
      }

      // Create live Firebase Authentication account without logging out Admin
      const authLoginEmail = `${studentId}@dlsau.edu.ph`;
      const defaultPassword = "password123";
      let authUid = "";
      try {
        authUid = await createAuthUserWithoutLoggingOut(authLoginEmail, defaultPassword);
      } catch (authErr: any) {
        if (authErr?.code !== "auth/email-already-in-use") {
          throw authErr;
        }
      }

      const now = new Date().toISOString();

      await setDoc(studentRef, {
        ...formData,
        ...(authUid ? { uid: authUid } : {}),
        authEmail: authLoginEmail,
        studentId,
        firstName: formData.personal.firstName.trim(),
        lastName: formData.personal.lastName.trim(),
        email: formData.contact.email.trim().toLowerCase(),
        program: formData.academic.program,
        yearLevel: formData.academic.yearLevel,
        section: formData.academic.section.trim(),
        enrollmentStatus: formData.academic.enrollmentStatus,
        maxUnits: Number(formData.academic.maxUnits) || 21,
        blockEnrolled: formData.academic.blockEnrolled === "Yes",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });

      showToast("success", `Student ${studentId} created! (Default password: ${defaultPassword})`);
      setFormData(INITIAL_FORM_STATE);
      await generateNextStudentId();
    } catch (error: any) {
      console.error("Error creating student profile:", error);
      showToast("error", error?.message || "Couldn't save the student. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (!role) return null;

  const { personal, contact, address, family, emergency, academic, previousSchool, health } = formData;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`flex items-center border bg-white shadow-xl ${
              toastMessage.type === "error"
                ? "border-red-200 text-red-900"
                : "border-emerald-200 text-emerald-950"
            }`}
          >
            <div
              className={`w-2 self-stretch ${
                toastMessage.type === "error" ? "bg-red-600" : "bg-emerald-700"
              }`}
            />
            <div className="px-4 py-3 text-sm font-semibold">{toastMessage.text}</div>
          </div>
        </div>
      )}

      {/* Reusable Admin Navbar */}
      <AdminNavbar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Institutional Geometric Strip */}
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="mx-auto max-w-4xl p-4 sm:p-8 lg:p-10">
          <header className="mb-8 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
              <Link href="/admin/students" className="hover:text-emerald-800 transition-colors">
                Student Profiles
              </Link>
              <span>/</span>
              <span className="text-zinc-900">Add Student</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">Add Student</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Fill in the student&apos;s details to add a new record.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* Section 1: Personal Details */}
            <Section title="Personal Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Student No. (Auto-generated)">
                  <input
                    required
                    readOnly
                    name="studentId"
                    value={personal.studentId}
                    className={`${INPUT_CLASS} bg-zinc-100 font-mono font-semibold text-zinc-600 cursor-not-allowed`}
                  />
                </Field>
                <Field label="Learner Reference Number (LRN)">
                  <input name="lrn" value={personal.lrn} onChange={handleInputChange("personal")} inputMode="numeric" maxLength={12} placeholder="12-digit LRN" className={INPUT_CLASS} />
                </Field>
                <Field label="First Name">
                  <input required name="firstName" value={personal.firstName} onChange={handleInputChange("personal")} placeholder="Juan" className={INPUT_CLASS} />
                </Field>
                <Field label="Middle Name">
                  <input name="middleName" value={personal.middleName} onChange={handleInputChange("personal")} placeholder="Santos" className={INPUT_CLASS} />
                </Field>
                <Field label="Last Name">
                  <input required name="lastName" value={personal.lastName} onChange={handleInputChange("personal")} placeholder="Dela Cruz" className={INPUT_CLASS} />
                </Field>
                <Field label="Suffix">
                  <input name="suffix" value={personal.suffix} onChange={handleInputChange("personal")} placeholder="Jr., III (optional)" className={INPUT_CLASS} />
                </Field>
                <Field label="Date of Birth">
                  <input required type="date" name="dateOfBirth" value={personal.dateOfBirth} onChange={handleInputChange("personal")} className={INPUT_CLASS} />
                </Field>
                <Field label="Place of Birth">
                  <input required name="placeOfBirth" value={personal.placeOfBirth} onChange={handleInputChange("personal")} placeholder="City / Municipality, Province" className={INPUT_CLASS} />
                </Field>
                <Field label="Sex">
                  <Select value={personal.sex} options={SEX_OPTIONS} onChange={v => setField("personal", "sex", v)} />
                </Field>
                <Field label="Civil Status">
                  <Select value={personal.civilStatus} options={CIVIL_STATUSES} onChange={v => setField("personal", "civilStatus", v)} />
                </Field>
                <Field label="Citizenship">
                  <input required name="citizenship" value={personal.citizenship} onChange={handleInputChange("personal")} className={INPUT_CLASS} />
                </Field>
                <Field label="Religion">
                  <input name="religion" value={personal.religion} onChange={handleInputChange("personal")} placeholder="Optional" className={INPUT_CLASS} />
                </Field>
              </div>
            </Section>

            {/* Section 2: Contact */}
            <Section title="Contact Details">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="School Email (Auto-generated)" className="sm:col-span-2">
                  <input
                    required
                    type="email"
                    name="email"
                    value={contact.email}
                    onChange={handleInputChange("contact")}
                    placeholder="firstname.surname@dlsau.edu.ph"
                    className={`${INPUT_CLASS} font-mono bg-zinc-50`}
                  />
                </Field>
                <Field label="Personal Email">
                  <input type="email" name="personalEmail" value={contact.personalEmail} onChange={handleInputChange("contact")} placeholder="juan@gmail.com" className={INPUT_CLASS} />
                </Field>
                <Field label="Mobile Number">
                  <input required type="tel" name="mobileNumber" value={contact.mobileNumber} onChange={handleInputChange("contact")} placeholder="09XX XXX XXXX" className={INPUT_CLASS} />
                </Field>
              </div>
            </Section>

            {/* Section 3: Address */}
            <Section title="Home Address">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="House No. / Street / Subdivision" className="sm:col-span-2">
                  <input required name="street" value={address.street} onChange={handleInputChange("address")} className={INPUT_CLASS} />
                </Field>
                <Field label="Barangay">
                  <input required name="barangay" value={address.barangay} onChange={handleInputChange("address")} className={INPUT_CLASS} />
                </Field>
                <Field label="City / Municipality">
                  <input required name="city" value={address.city} onChange={handleInputChange("address")} className={INPUT_CLASS} />
                </Field>
                <Field label="Province">
                  <input required name="province" value={address.province} onChange={handleInputChange("address")} className={INPUT_CLASS} />
                </Field>
                <Field label="ZIP Code">
                  <input name="zipCode" value={address.zipCode} onChange={handleInputChange("address")} inputMode="numeric" maxLength={4} className={INPUT_CLASS} />
                </Field>
              </div>
            </Section>

            {/* Section 4: Family */}
            <Section title="Family Background" description="Parents' details and the person responsible for the student's enrollment.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Father's Full Name" className="sm:col-span-3">
                  <input name="fatherName" value={family.fatherName} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>
                <Field label="Father's Occupation" className="sm:col-span-2">
                  <input name="fatherOccupation" value={family.fatherOccupation} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>
                <Field label="Father's Contact No.">
                  <input type="tel" name="fatherContact" value={family.fatherContact} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>

                <Field label="Mother's Full Name" className="sm:col-span-2">
                  <input name="motherName" value={family.motherName} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>
                <Field label="Mother's Maiden Name">
                  <input name="motherMaidenName" value={family.motherMaidenName} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>
                <Field label="Mother's Occupation" className="sm:col-span-2">
                  <input name="motherOccupation" value={family.motherOccupation} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>
                <Field label="Mother's Contact No.">
                  <input type="tel" name="motherContact" value={family.motherContact} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>

                <Field label="Guardian's Full Name" className="sm:col-span-3">
                  <input required name="guardianName" value={family.guardianName} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>
                <Field label="Relationship to Student" className="sm:col-span-2">
                  <Select value={family.guardianRelationship} options={GUARDIAN_RELATIONS} onChange={v => setField("family", "guardianRelationship", v)} />
                </Field>
                <Field label="Guardian's Contact No.">
                  <input required type="tel" name="guardianContact" value={family.guardianContact} onChange={handleInputChange("family")} className={INPUT_CLASS} />
                </Field>
              </div>
            </Section>

            {/* Section 5: Emergency Contact */}
            <Section title="Emergency Contact" description="Who the university should call if something happens on campus.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Full Name">
                  <input required name="contactName" value={emergency.contactName} onChange={handleInputChange("emergency")} className={INPUT_CLASS} />
                </Field>
                <Field label="Relationship">
                  <Select value={emergency.relationship} options={GUARDIAN_RELATIONS} onChange={v => setField("emergency", "relationship", v)} />
                </Field>
                <Field label="Contact Number">
                  <input required type="tel" name="contactNumber" value={emergency.contactNumber} onChange={handleInputChange("emergency")} className={INPUT_CLASS} />
                </Field>
              </div>
            </Section>

            {/* Section 6: Academic Standing */}
            <Section title="Academic Standing">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Degree Program" className="sm:col-span-2">
                  <Select value={academic.program} options={PROGRAMS} onChange={v => setField("academic", "program", v)} />
                </Field>
                <Field label="Major / Specialization">
                  <input name="major" value={academic.major} onChange={handleInputChange("academic")} placeholder="Optional" className={INPUT_CLASS} />
                </Field>
                <Field label="Year Level">
                  <Select value={academic.yearLevel} options={YEAR_LEVELS} onChange={v => setField("academic", "yearLevel", v)} />
                </Field>
                <Field label="Section">
                  <input name="section" value={academic.section} onChange={handleInputChange("academic")} placeholder="e.g. CS1A" className={INPUT_CLASS} />
                </Field>
                <Field label="Enrollment Status">
                  <Select value={academic.enrollmentStatus} options={ENROLLMENT_STATUSES} onChange={v => setField("academic", "enrollmentStatus", v)} />
                </Field>
                <Field label="Admission Type">
                  <Select value={academic.admissionType} options={ADMISSION_TYPES} onChange={v => setField("academic", "admissionType", v)} />
                </Field>
                <Field label="School Year Admitted">
                  <input required name="schoolYearAdmitted" value={academic.schoolYearAdmitted} onChange={handleInputChange("academic")} placeholder="2026-2027" className={INPUT_CLASS} />
                </Field>
<Field label="Semester Admitted">
                  <Select value={academic.semesterAdmitted} options={SEMESTERS} onChange={v => setField("academic", "semesterAdmitted", v)} />
                </Field>
                <Field label="Scholarship / Financial Aid">
                  <Select value={academic.scholarship} options={SCHOLARSHIPS} onChange={v => setField("academic", "scholarship", v)} />
                </Field>
                <Field label="Max Units per Term">
                  <Select value={academic.maxUnits} options={["15", "18", "21", "23", "24"]} onChange={v => setField("academic", "maxUnits", v)} />
                </Field>
                <Field label="1st-Term Fixed Block Schedule" className="sm:col-span-2">
                  <Select value={academic.blockEnrolled} options={["Yes", "No"]} onChange={v => setField("academic", "blockEnrolled", v)} />
                </Field>
              </div>
            </Section>

            {/* Section 7: Previous School */}
            <Section title="Previous School" description="Senior high school record, plus the last college attended for transferees.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Senior High School" className="sm:col-span-3">
                  <input required name="shsName" value={previousSchool.shsName} onChange={handleInputChange("previousSchool")} className={INPUT_CLASS} />
                </Field>
                <Field label="SHS Strand">
                  <Select value={previousSchool.shsStrand} options={SHS_STRANDS} onChange={v => setField("previousSchool", "shsStrand", v)} />
                </Field>
                <Field label="Year Graduated">
                  <input required name="yearGraduated" value={previousSchool.yearGraduated} onChange={handleInputChange("previousSchool")} inputMode="numeric" maxLength={4} placeholder="2025" className={INPUT_CLASS} />
                </Field>
                <Field label="General Weighted Average">
                  <input name="gwa" value={previousSchool.gwa} onChange={handleInputChange("previousSchool")} inputMode="decimal" placeholder="e.g. 92.50" className={INPUT_CLASS} />
                </Field>
                <Field label="Last College Attended (Transferees)" className="sm:col-span-3">
                  <input name="lastCollegeAttended" value={previousSchool.lastCollegeAttended} onChange={handleInputChange("previousSchool")} placeholder="Leave blank if not applicable" className={INPUT_CLASS} />
                </Field>
              </div>
            </Section>

            {/* Section 8: Health */}
            <Section title="Health Information" description="Used by the university clinic for campus emergencies.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Blood Type">
                  <Select value={health.bloodType} options={BLOOD_TYPES} onChange={v => setField("health", "bloodType", v)} />
                </Field>
                <Field label="Person with Disability (PWD)">
                  <Select value={health.pwd} options={["No", "Yes"]} onChange={v => setField("health", "pwd", v)} />
                </Field>
                <Field label="Known Allergies" className="sm:col-span-2">
                  <input name="allergies" value={health.allergies} onChange={handleInputChange("health")} placeholder="None" className={INPUT_CLASS} />
                </Field>
                <Field label="Medical Notes" className="sm:col-span-2">
                  <textarea
                    name="medicalNotes"
                    value={health.medicalNotes}
                    onChange={handleInputChange("health")}
                    rows={3}
                    placeholder="Conditions the clinic should be aware of"
                    className={`${INPUT_CLASS} resize-none`}
                  />
                </Field>
              </div>
            </Section>

            {/* Section 9: Pre-enrollment Clearances */}
            <Section
              title="Clearance Status"
              description="Leave unchecked for now. Check each office once the student submits their clearance."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CLEARANCE_GATES.map(({ key, label }) => {
                  const isCleared = formData.clearances[key] === "cleared";
                  return (
                    <button
                      key={key}
                      type="button"
                      role="checkbox"
                      aria-checked={isCleared}
                      onClick={() => handleClearanceToggle(key)}
                      className={`flex items-center justify-between border border-l-4 px-3.5 py-2.5 text-left text-sm transition-all ${
                        isCleared
                          ? "border-emerald-700 border-l-emerald-600 bg-emerald-50/70 text-emerald-950"
                          : "border-zinc-200 border-l-zinc-300 bg-white text-zinc-700 hover:bg-emerald-50/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                            isCleared ? "border-emerald-800 bg-emerald-800 text-white" : "border-zinc-300 bg-white"
                          }`}
                        >
                          {isCleared && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                              <path
                                fillRule="evenodd"
                                d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="font-semibold">{label}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          isCleared ? "bg-emerald-800 text-white" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isCleared ? "Cleared" : "Pending"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Section 10: Admission Requirements */}
            <Section title="Submitted Requirements" description="Check the documents the Registrar has already received.">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REQUIREMENTS.map(({ key, label }) => {
                  const received = formData.requirements[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      role="checkbox"
                      aria-checked={received}
                      onClick={() => handleRequirementToggle(key)}
                      className={`flex items-center gap-3 border border-l-4 px-3.5 py-2.5 text-left text-sm transition-all ${
                        received
                          ? "border-emerald-700 border-l-emerald-600 bg-emerald-50/70 text-emerald-950"
                          : "border-zinc-200 border-l-zinc-300 bg-white text-zinc-700 hover:bg-emerald-50/40"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                          received ? "border-emerald-800 bg-emerald-800 text-white" : "border-zinc-300 bg-white"
                        }`}
                      >
                        {received && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                            <path
                              fillRule="evenodd"
                              d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-6">
              <button
                type="button"
                onClick={() => {
                  setFormData(INITIAL_FORM_STATE);
                  generateNextStudentId();
                }}
                className="border border-zinc-300 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-100"
              >
                Clear Form
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex shrink-0 items-center gap-2 border-l-4 border-emerald-400 bg-emerald-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-800 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Student"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}