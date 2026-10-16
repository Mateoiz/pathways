"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Where each role lands after signing in
const ROLE_REDIRECTS: Record<string, string> = {
  student: "/dashboard",
  admin: "/admin/students",
  registrar: "/dashboard",
};

function validateIdentifier(value: string): string {
  if (!value) return "This field is required.";
  // DLSAU student number format: YYYY-NN-NNNNNN (e.g., 2024-00-000890)
  const isStudentNum = /^\d{4}-\d{2}-\d{6}$/.test(value);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!isStudentNum && !isEmail)
    return "Enter a valid student number (e.g. 2024-00-000890) or email.";
  return "";
}
function validatePassword(value: string): string {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return "";
}

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  function handleIdentifierBlur() {
    setIdentifierTouched(true);
    setIdentifierError(validateIdentifier(identifier));
  }

  function handlePasswordBlur() {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  }

  function handleIdentifierChange(e: React.ChangeEvent<HTMLInputElement>) {
    setIdentifier(e.target.value);
    if (identifierTouched) setIdentifierError(validateIdentifier(e.target.value));
    setSubmitError("");
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (passwordTouched) setPasswordError(validatePassword(e.target.value));
    setSubmitError("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const idErr = validateIdentifier(identifier);
    const pwErr = validatePassword(password);
    setIdentifierError(idErr);
    setPasswordError(pwErr);
    setIdentifierTouched(true);
    setPasswordTouched(true);

    if (idErr || pwErr) return;

    setLoading(true);
    setSubmitError("");

    try {
      let userData = null;

      if (identifier.includes("@")) {
        // Staff accounts live in the "users" collection
        const q = query(collection(db, "users"), where("email", "==", identifier));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          userData = snapshot.docs[0].data();
        } else {
          // Fallback accounts so you don't get locked out
          if (identifier === "admin@dlsau.edu.ph") {
            userData = { role: "admin", name: "System Admin" };
          } else if (identifier === "registrar@dlsau.edu.ph") {
            userData = { role: "registrar", name: "Registrar Office" };
          }
        }
      } else {
        // Students: document ID is the student number
        const docRef = doc(db, "students", identifier);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          userData = {
            ...data,
            name: `${data.firstName} ${data.lastName}`,
            role: "student",
          };
        }
      }

      // Mocked password check (no Firebase Auth yet)
      if (userData && password === "password123") {
        localStorage.setItem("mock_user_role", userData.role);
        localStorage.setItem("mock_user_name", userData.name);
        localStorage.setItem("mock_user_id", identifier);

        const destination = ROLE_REDIRECTS[userData.role] || "/dashboard";
        router.push(destination);
      } else {
        setSubmitError("Incorrect student number, email, or password.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Login Error:", error);
      setSubmitError("Can't connect right now. Please try again.");
      setLoading(false);
    }
  }

  const isFormValid = !validateIdentifier(identifier) && !validatePassword(password);

  const inputClass = (hasError: boolean) =>
    `w-full border bg-zinc-50/50 px-3.5 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-all ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400"
        : "border-zinc-300 focus:border-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-800"
    }`;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[#F8FAF9] text-zinc-900 font-sans">
      {/* ── LEFT: BRANDING PANEL (Desktop only) ── */}
      <div className="relative hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col overflow-hidden bg-emerald-900 text-white">
        {/* Top geometric strip */}
<Image
          src="/images/campus.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-30 grayscale mix-blend-luminosity"
        />

        {/* Fade: solid green at the bottom and left, photo shows at the top right */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-900 via-emerald-900/70 to-emerald-900/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-900/80 via-transparent to-transparent" />

        {/* Ghost letters, cropped by the panel edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute -left-10 -bottom-16 font-black leading-[0.8] tracking-tighter text-white/[0.06] text-[16rem] xl:text-[20rem]"
        >
          DLS
          <br />
          AU
        </div>

        {/* Thin triangle lattice */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            maskImage: "radial-gradient(ellipse 90% 80% at 85% 20%, #000 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 85% 20%, #000 20%, transparent 85%)",
          }}
        >
          <defs>
            <pattern id="tri-lattice" width="40" height="69.28" patternUnits="userSpaceOnUse">
              <path
                d="M0 0H40 M0 34.64H40 M0 0L20 34.64L40 0 M0 69.28L20 34.64L40 69.28"
                fill="none"
                stroke="white"
                strokeWidth="0.6"
                strokeOpacity="0.18"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tri-lattice)" />
        </svg>

        {/* Larger outline triangles */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 600 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          stroke="white"
          strokeWidth="1"
        >
          <polygon points="420,120 540,330 300,330" strokeOpacity="0.35" />
          <polygon points="420,170 500,310 340,310" strokeOpacity="0.2" />
          <polygon points="120,560 220,730 20,730" strokeOpacity="0.25" />
          <polygon points="470,640 560,800 380,800" strokeOpacity="0.3" />
          <polygon points="250,40 290,110 210,110" strokeOpacity="0.4" />
        </svg>

        {/* Decorative rectangles */}
        <div className="pointer-events-none absolute -right-10 top-24 h-48 w-72 border-2 border-emerald-700/40 bg-emerald-800/30" />
        <div className="pointer-events-none absolute right-32 bottom-0 h-24 w-48 bg-emerald-800/50 border-t border-l border-emerald-600/30" />
        <div className="pointer-events-none absolute right-10 bottom-16 h-10 w-10 bg-emerald-500/20 border border-emerald-400/30" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          <div className="mt-12 flex items-start gap-5">
            <div className="mt-1 h-24 w-2 shrink-0 bg-white" />
            <div>
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center bg-white p-2 shadow-lg border-l-4 border-emerald-400">
                <Image
                  src="/logo/dlsau.png"
                  alt="DLSAU logo"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                  priority
                />
              </div>
              <div className="mb-3 inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
                <span className="h-2 w-2 bg-emerald-400" />
                De La Salle Araneta University
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-white">
                PATHWAYS
              </h1>
              <p className="mt-4 max-w-md text-base text-emerald-100/80 leading-relaxed">
                Enrollment, clearance, and student records in one place.
              </p>
            </div>
          </div>

          <div className="text-sm text-emerald-200/70 font-medium">
            © 2026 De La Salle Araneta University
          </div>
        </div>
      </div>

      {/* ── RIGHT: SIGN IN FORM ── */}
      <div className="flex w-full flex-col justify-center px-4 py-10 sm:px-12 lg:w-[55%] xl:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile header */}
          <div className="mb-8 flex items-center gap-4 lg:hidden">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-emerald-900/15 bg-white p-1.5 shadow-xs border-l-4 border-l-emerald-700">
              <Image
                src="/logo/dlsau.png"
                alt="DLSAU logo"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-emerald-950 leading-none">
                PATHWAYS
              </h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                De La Salle Araneta University
              </p>
            </div>
          </div>

          {/* Form card */}
          <div className="border border-emerald-900/15 bg-white shadow-xs">
            <div className="h-2 w-full bg-emerald-900 flex">
              <div className="h-full w-20 bg-emerald-600" />
              <div className="h-full w-8 bg-emerald-400" />
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="h-8 w-2 bg-emerald-800" />
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Sign In</h2>
                  <p className="text-xs text-zinc-500">
                    Use your student number or school email.
                  </p>
                </div>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="mb-5 flex items-stretch border border-red-200 bg-white text-red-900"
                >
                  <div className="w-2 shrink-0 bg-red-600" />
                  <div className="px-4 py-3 text-sm font-semibold">{submitError}</div>
                </div>
              )}

              <form onSubmit={handleLogin} noValidate className="flex flex-col gap-5">
                {/* Identifier */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="identifier"
                    className="text-xs font-bold uppercase tracking-wider text-zinc-700"
                  >
                    Student No. / Email
                  </label>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    value={identifier}
                    onChange={handleIdentifierChange}
                    onBlur={handleIdentifierBlur}
                    placeholder="e.g. 2024-00-000890"
                    autoComplete="username"
                    aria-invalid={!!identifierError}
                    aria-describedby={identifierError ? "identifier-error" : undefined}
                    className={inputClass(!!identifierError)}
                  />
                  {identifierError && (
                    <p id="identifier-error" className="text-xs font-medium text-red-600">
                      {identifierError}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="password"
                    className="text-xs font-bold uppercase tracking-wider text-zinc-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={handlePasswordBlur}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : undefined}
                    className={inputClass(!!passwordError)}
                  />
                  {passwordError && (
                    <p id="password-error" className="text-xs font-medium text-red-600">
                      {passwordError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`mt-2 flex h-12 w-full items-center justify-center gap-2 px-4 text-sm font-bold transition-all ${
                    loading
                      ? "cursor-not-allowed bg-emerald-900/60 text-white border-l-4 border-emerald-400/60"
                      : isFormValid
                        ? "bg-emerald-900 text-white border-l-4 border-emerald-400 hover:bg-emerald-800 active:translate-y-px"
                        : "cursor-not-allowed bg-zinc-200 text-zinc-500 border-l-4 border-zinc-300"
                  }`}
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Test accounts (development only) */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 border border-emerald-900/15 bg-white">
              <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5">
                <span className="h-3 w-1 bg-emerald-700" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                  Test Accounts
                </p>
              </div>
              <ul className="flex flex-col gap-2 p-4 text-xs font-mono text-zinc-600">
                <li className="flex justify-between items-center">
                  <span>Student:</span>
                  <span className="font-bold text-zinc-900">2024-00-000890</span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Admin:</span>
                  <span className="font-bold text-zinc-900">admin@dlsau.edu.ph</span>
                </li>
                <li className="flex justify-between items-center border-t border-zinc-200 pt-2">
                  <span>Password:</span>
                  <span className="font-bold text-zinc-900">password123</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}