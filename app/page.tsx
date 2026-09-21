"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MOCK_USERS: Record<string, { role: string; name: string }> = {
  "2023-12345": { role: "student", name: "Ice Matthew Ramirez" },
  "registrar@dlsau.edu.ph": { role: "registrar", name: "Registrar Office" },
  "admin@dlsau.edu.ph": { role: "admin", name: "System Admin" },
};

function validateIdentifier(value: string): string {
  if (!value) return "This field is required.";
  const isStudentNum = /^\d{4}-\d{5}$/.test(value);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!isStudentNum && !isEmail)
    return "Enter a valid student number (e.g. 2023-12345) or email.";
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

    // Simulate async auth check
    await new Promise((r) => setTimeout(r, 600));

    const user = MOCK_USERS[identifier];
    if (user && password === "password123") {
      localStorage.setItem("mock_user_role", user.role);
      localStorage.setItem("mock_user_name", user.name);
      router.push("/dashboard");
    } else {
      setLoading(false);
      setSubmitError(
        MOCK_USERS[identifier]
          ? "Incorrect password. Please try again."
          : "No account found for that student number or email."
      );
    }
  }

  const isFormValid = !validateIdentifier(identifier) && !validatePassword(password);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-white font-sans dark:bg-black">
      
      {/* ── LEFT: BRANDING PANEL (Desktop Only) ── */}
      <div className="relative hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col justify-between overflow-hidden bg-zinc-50 p-12 dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/[.08]">
        {/* Blueprint Background */}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_20%,#000_50%,transparent_100%)]" />
        
        <div className="relative z-10 mt-12">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-white shadow-xl dark:bg-white dark:text-black">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
            </svg>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            PATHWAYS
          </h1>
          <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            DLSAU's official student enrollment system. Engineered for speed, clarity, and reliability.
          </p>
        </div>

        <div className="relative z-10 text-sm text-zinc-500 font-medium">
          © 2026 De La Salle Araneta University
        </div>
      </div>

      {/* ── RIGHT: AUTH FORM PANEL (Full width on mobile) ── */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[55%] xl:w-1/2 lg:px-20 xl:px-32 relative bg-white dark:bg-black">
        
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="mb-10 flex flex-col items-start lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white shadow-lg dark:bg-white dark:text-black">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">PATHWAYS</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Your academic journey, simplified.</p>
          </div>

          <div className="mb-8 hidden lg:block">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Welcome back</h2>
            <p className="mt-1 text-sm text-zinc-500">Please enter your credentials to access your portal.</p>
          </div>

          {submitError && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 border border-red-500/20 font-medium animate-in fade-in slide-in-from-top-2"
            >
              {submitError}
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="flex flex-col gap-5">
            {/* Identifier field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="identifier" className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Student Number / Email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                value={identifier}
                onChange={handleIdentifierChange}
                onBlur={handleIdentifierBlur}
                placeholder="e.g. 2023-12345"
                aria-invalid={!!identifierError}
                aria-describedby={identifierError ? "identifier-error" : undefined}
                className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition-all bg-zinc-50 dark:bg-zinc-900/50
                  ${identifierError
                    ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400"
                    : "border-zinc-200 focus:border-black focus:ring-1 focus:ring-black dark:border-white/[.08] dark:focus:border-white dark:focus:ring-white"
                  }`}
              />
              {identifierError ? (
                <p id="identifier-error" className="text-xs text-red-500">{identifierError}</p>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Use your student number (2023-12345) or institutional email.
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
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
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error" : undefined}
                className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition-all bg-zinc-50 dark:bg-zinc-900/50
                  ${passwordError
                    ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400"
                    : "border-zinc-200 focus:border-black focus:ring-1 focus:ring-black dark:border-white/[.08] dark:focus:border-white dark:focus:ring-white"
                  }`}
              />
              {passwordError && (
                <p id="password-error" className="text-xs text-red-500">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 font-medium text-white transition-all
                ${loading
                  ? "bg-zinc-400 cursor-not-allowed dark:bg-zinc-600"
                  : isFormValid
                    ? "bg-zinc-900 hover:bg-black hover:shadow-md active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    : "bg-zinc-300 cursor-not-allowed text-zinc-500 dark:bg-zinc-800 dark:text-zinc-600"
                }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Authenticating…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Dev helper */}
          <div className="mt-8 rounded-lg bg-zinc-50 p-5 text-xs text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400 border border-zinc-200 dark:border-white/[.05]">
            <p className="font-semibold mb-3 text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[10px]">Development Credentials</p>
            <ul className="flex flex-col gap-2 font-mono">
              <li className="flex justify-between items-center">
                <span>Student:</span> <span className="font-semibold text-zinc-900 dark:text-zinc-200">2023-12345</span>
              </li>
              <li className="flex justify-between items-center">
                <span>Registrar:</span> <span className="font-semibold text-zinc-900 dark:text-zinc-200">registrar@dlsau.edu.ph</span>
              </li>
              <li className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800 pt-2 mt-1">
                <span>Password:</span> <span className="font-semibold text-zinc-900 dark:text-zinc-200">password123</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}