"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

// Where each role lands after signing in
const ROLE_REDIRECTS: Record<string, string> = {
  student: "/dashboard",
  admin: "/admin/students",
  registrar: "/dashboard",
};

const IS_DEV = process.env.NODE_ENV === "development";

function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

function validateIdentifier(raw: string): string {
  const value = normalizeIdentifier(raw);
  if (!value) return "Student number or school email is required.";
  // DLSAU student number format: YYYY-NN-NNNNNN (e.g., 2024-00-000890)
  const isStudentNum = /^\d{4}-\d{2}-\d{6}$/.test(value);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!isStudentNum && !isEmail) {
    return "Enter a valid student number (e.g. 2024-00-000890) or email.";
  }
  return "";
}

function validatePassword(value: string): string {
  if (!value) return "Password is required.";
  return "";
}

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);

  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Redirect automatically if already signed in
  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    const storedId = localStorage.getItem("mock_user_id");

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && storedRole) {
        router.replace(ROLE_REDIRECTS[storedRole] || "/dashboard");
        return;
      }
      if (IS_DEV && storedRole && storedId) {
        router.replace(ROLE_REDIRECTS[storedRole] || "/dashboard");
        return;
      }
      setCheckingSession(false);
    });

    return () => unsubscribe();
  }, [router]);

  function handleIdentifierBlur() {
    setIdentifierTouched(true);
    setIdentifierError(validateIdentifier(identifier));
  }

  function handlePasswordBlur() {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  }

  function handleIdentifierChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setIdentifier(val);
    if (identifierTouched) setIdentifierError(validateIdentifier(val));
    setSubmitError("");
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setPassword(val);
    if (passwordTouched) setPasswordError(validatePassword(val));
    setSubmitError("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const cleanId = normalizeIdentifier(identifier);
    const idErr = validateIdentifier(cleanId);
    const pwErr = validatePassword(password);

    setIdentifier(cleanId);
    setIdentifierError(idErr);
    setPasswordError(pwErr);
    setIdentifierTouched(true);
    setPasswordTouched(true);

    if (idErr || pwErr) return;

    setLoading(true);
    setSubmitError("");

    try {
      let userData: { role: string; name: string; email?: string } | null = null;

      // 1. Resolve user profile from Firestore
      if (cleanId.includes("@")) {
        const q = query(collection(db, "users"), where("email", "==", cleanId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          userData = {
            role: docData.role || "staff",
            name: docData.name || cleanId,
            email: cleanId,
          };
        } else if (IS_DEV) {
          // Development-only fallback accounts
          if (cleanId === "admin@dlsau.edu.ph") {
            userData = { role: "admin", name: "System Admin", email: cleanId };
          } else if (cleanId === "registrar@dlsau.edu.ph") {
            userData = { role: "registrar", name: "Registrar Office", email: cleanId };
          }
        }
      } else {
        const docRef = doc(db, "students", cleanId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          userData = {
            role: "student",
            name: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || "Student",
            email: data.email || `${cleanId}@dlsau.edu.ph`,
          };
        }
      }

      if (!userData) {
        setSubmitError("Incorrect student number, email, or password.");
        setLoading(false);
        return;
      }

      // 2. Authenticate via Firebase Auth first, with Dev Mock Fallback in development
      let authenticated = false;
      const authEmail = userData.email || (cleanId.includes("@") ? cleanId : `${cleanId}@dlsau.edu.ph`);

      try {
        await signInWithEmailAndPassword(auth, authEmail, password);
        authenticated = true;
      } catch (firebaseErr: any) {
        // Allow "password123" fallback ONLY in local development while migrating accounts
        if (IS_DEV && password === "password123") {
          authenticated = true;
        }
      }

      if (authenticated) {
        localStorage.setItem("mock_user_role", userData.role);
        localStorage.setItem("mock_user_name", userData.name);
        localStorage.setItem("mock_user_id", cleanId);

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

  function fillTestAccount(testId: string) {
    setIdentifier(testId);
    setPassword("password123");
    setIdentifierError("");
    setPasswordError("");
    setSubmitError("");
  }

  const inputClass = (hasError: boolean) =>
    `w-full border bg-zinc-50/50 px-3.5 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-all ${
      hasError
        ? "border-red-500 focus:border-red-600 focus:bg-white focus:ring-1 focus:ring-red-500"
        : "border-zinc-300 focus:border-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-800"
    }`;

  if (checkingSession) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F8FAF9]">
        <div className="flex items-center gap-3 text-emerald-900 text-sm font-semibold">
          <div className="h-5 w-1.5 bg-emerald-700 animate-pulse" />
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row bg-[#F8FAF9] text-zinc-900 font-sans">
      {/* ── LEFT: BRANDING PANEL (Desktop only) ── */}
      <div className="relative hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col overflow-hidden bg-emerald-900 text-white">
        <Image
          src="/images/campus.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-25 grayscale mix-blend-luminosity"
        />

        {/* Gradient overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-900/75 to-emerald-900/20" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-950/80 via-transparent to-transparent" />

        {/* Subtle geometric lattice (cleaned up to a single background texture) */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            maskImage: "radial-gradient(ellipse 80% 70% at 85% 20%, #000 15%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 85% 20%, #000 15%, transparent 80%)",
          }}
        >
          <defs>
            <pattern id="tri-lattice" width="40" height="69.28" patternUnits="userSpaceOnUse">
              <path
                d="M0 0H40 M0 34.64H40 M0 0L20 34.64L40 0 M0 69.28L20 34.64L40 69.28"
                fill="none"
                stroke="white"
                strokeWidth="0.6"
                strokeOpacity="0.14"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tri-lattice)" />
        </svg>

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          <div className="mt-8 flex items-start gap-5">
            <div className="mt-1 h-24 w-2 shrink-0 bg-emerald-400" />
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
              <div className="mb-3 inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-700 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-100">
                <span className="h-2 w-2 bg-emerald-400" />
                De La Salle Araneta University
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-white">
                PATHWAYS
              </h1>
              <p className="mt-4 max-w-md text-base text-emerald-50/90 leading-relaxed">
                Enrollment, schedule building, clearance, and academic records in one place.
              </p>
            </div>
          </div>

          {/* Academic / Enrollment Advisory Strip */}
          <div className="space-y-6">
            <div className="border border-emerald-700/60 border-l-4 border-l-emerald-400 bg-emerald-950/65 p-5 backdrop-blur-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Academic Advisory
                </span>
                <span className="bg-emerald-800/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-100">
                  AY 2026–2027
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">
                Online Enlistment &amp; Automated Add/Drop Portal
              </p>
              <p className="mt-1 text-xs text-emerald-100/85 leading-relaxed">
                Ensure all institutional clearances and prerequisite grades are verified before finalizing your trimester schedule.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-emerald-100/90 font-medium">
              <span>© 2026 De La Salle Araneta University</span>
              <span>Salvador Araneta Campus, Malabon</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: SIGN IN FORM ── */}
      <div className="flex w-full flex-1 flex-col justify-center px-4 py-10 sm:px-12 lg:w-[55%] xl:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile header */}
          <div className="mb-6 flex items-center gap-4 lg:hidden">
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
              <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                De La Salle Araneta University
              </p>
            </div>
          </div>

          {/* Mobile enrollment notice */}
          <div className="mb-6 border border-emerald-900/15 border-l-4 border-l-emerald-700 bg-emerald-950/[0.03] px-4 py-3 lg:hidden">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              AY 2026–2027 Enlistment Active
            </p>
            <p className="mt-0.5 text-xs text-zinc-600">
              Sign in with your DLSAU student number or staff email to manage your schedule.
            </p>
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
                  <p className="text-xs text-zinc-600">
                    Use your student number or university email.
                  </p>
                </div>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="mb-5 flex items-stretch border border-red-300 bg-red-50/50 text-red-900"
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
                    placeholder="e.g. 2024-00-000890 or name@dlsau.edu.ph"
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
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-xs font-bold uppercase tracking-wider text-zinc-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowResetHelp((prev) => !prev)}
                      className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:underline focus:outline-none"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? "password-error" : undefined}
                      className={`${inputClass(!!passwordError)} pr-16`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 hover:text-emerald-900 focus:outline-none"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {passwordError && (
                    <p id="password-error" className="text-xs font-medium text-red-600">
                      {passwordError}
                    </p>
                  )}

                  {showResetHelp && (
                    <div className="mt-2 border border-emerald-900/15 border-l-4 border-l-emerald-700 bg-emerald-50/50 p-3 text-xs text-zinc-700 leading-relaxed">
                      <p className="font-bold text-emerald-950">Password Reset Assistance</p>
                      <p className="mt-1">
                        For security, student and staff credentials are managed through DLSAU ITSD. Email{" "}
                        <a
                          href="mailto:itsd@dlsau.edu.ph"
                          className="font-semibold text-emerald-900 underline"
                        >
                          itsd@dlsau.edu.ph
                        </a>{" "}
                        using your institutional account or visit the Registrar&apos;s Office with your university ID.
                      </p>
                    </div>
                  )}
                </div>

                {/* Submit button: always looks active when not loading so clicking surfaces validation errors */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`mt-2 flex h-12 w-full items-center justify-center gap-2 px-4 text-sm font-bold transition-all ${
                    loading
                      ? "cursor-not-allowed bg-emerald-900/60 text-white border-l-4 border-emerald-400/60"
                      : "bg-emerald-900 text-white border-l-4 border-emerald-400 hover:bg-emerald-800 active:translate-y-px cursor-pointer"
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
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              {/* Need Help / Support Footer */}
              <div className="mt-6 border-t border-zinc-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-zinc-600">
                <span className="font-medium">Having trouble signing in?</span>
                <div className="flex items-center gap-3 font-semibold text-emerald-900">
                  <a href="mailto:registrar@dlsau.edu.ph" className="hover:underline">
                    Registrar Support
                  </a>
                  <span className="text-zinc-300">•</span>
                  <a href="mailto:itsd@dlsau.edu.ph" className="hover:underline">
                    IT Helpdesk
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Test accounts (development only, now clickable to auto-fill) */}
          {IS_DEV && (
            <div className="mt-6 border border-emerald-900/15 bg-white">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-1 bg-emerald-700" />
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                    Dev Quick-Fill Accounts
                  </p>
                </div>
                <span className="font-mono text-[11px] text-zinc-500">pw: password123</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => fillTestAccount("2024-00-000890")}
                  className="flex items-center justify-between border border-zinc-200 px-3 py-2 text-left hover:border-emerald-700 hover:bg-emerald-50/50 transition-colors"
                >
                  <span className="text-zinc-600">Student</span>
                  <span className="font-bold text-emerald-950">2024-00-000890</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillTestAccount("admin@dlsau.edu.ph")}
                  className="flex items-center justify-between border border-zinc-200 px-3 py-2 text-left hover:border-emerald-700 hover:bg-emerald-50/50 transition-colors"
                >
                  <span className="text-zinc-600">Admin</span>
                  <span className="font-bold text-emerald-950">admin@dlsau.edu.ph</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}