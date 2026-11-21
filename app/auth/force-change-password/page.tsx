"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { updatePassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const HELPDESK_EMAIL = "itc.helpdesk@dlsau.edu.ph";

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>("Student");

  useEffect(() => {
    const id = localStorage.getItem("mock_user_id");
    const role = localStorage.getItem("mock_user_role");
    const name = localStorage.getItem("mock_user_name");
    if (!id || role !== "student") {
      router.replace("/");
    } else {
      setStudentId(id);
      if (name) setStudentName(name);
    }
  }, [router]);

  // Opens a new Outlook (web) message addressed to the ITC helpdesk, with the subject pre-filled.
  const outlookHref =
    "https://outlook.office.com/mail/deeplink/compose?" +
    new URLSearchParams({
      to: HELPDESK_EMAIL,
      subject: `Password change help${studentId ? ` - ${studentId}` : ""}`,
    }).toString();

  async function handleCancelAndSignOut() {
    await signOut(auth).catch(() => {});
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    localStorage.removeItem("mock_user_id");
    localStorage.removeItem("mock_must_change_pw");
    router.replace("/");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Your new password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (
      newPassword === "password123" ||
      (studentId && newPassword.toLowerCase() === studentId.toLowerCase())
    ) {
      setError("Please choose a new password different from your default temporary password.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Your login session expired. Please sign out and sign in again.");
      }

      // 1. Update live Firebase Authentication password
      await updatePassword(user, newPassword);

      // 2. Mark mustChangePassword: false in Firestore `students/{studentId}`
      if (studentId) {
        await setDoc(
          doc(db, "students", studentId),
          {
            mustChangePassword: false,
            passwordUpdatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      // 3. Clear the force-change lock in localStorage and enter the portal
      localStorage.removeItem("mock_must_change_pw");
      router.replace("/dashboard");
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err?.code === "auth/requires-recent-login") {
        setError("Session timed out. Click 'Sign out' below and log back in to change your password.");
      } else {
        setError(err?.message || "Failed to update password. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F8FAF9] p-4 text-zinc-900 font-sans">
      <div className="w-full max-w-md border border-emerald-900/15 bg-white shadow-xl">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-20 bg-emerald-600" />
          <div className="h-full w-8 bg-emerald-400" />
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-emerald-900/15 border-l-4 border-l-emerald-700 bg-white p-1">
                <Image
                  src="/logo/dlsau.png"
                  alt="DLSAU logo"
                  width={36}
                  height={36}
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  DLSAU • First-Time Login
                </p>
                <h1 className="text-lg font-bold text-zinc-900">
                  Update Your Password
                </h1>
              </div>
            </div>
          </div>

          <div className="mb-5 border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/70 px-4 py-3 text-xs text-amber-950">
            <p className="font-bold">Temporary Password Detected</p>
            <p className="mt-0.5 text-amber-900">
              Welcome, <span className="font-bold">{studentName}</span> ({studentId}). Because you signed in with a default temporary password (<code className="font-mono font-bold">password123</code>), you must set a personal password before accessing Pathways.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-stretch border border-red-300 bg-red-50/50 text-red-900"
            >
              <div className="w-2 shrink-0 bg-red-600" />
              <div className="px-4 py-3 text-xs font-semibold">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  New Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="text-xs font-bold uppercase tracking-wider text-emerald-800 hover:underline"
                >
                  {showNew ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="newPassword"
                type={showNew ? "text" : "password"}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters (not password123)"
                className="w-full border border-zinc-300 bg-zinc-50/50 px-3.5 py-3 text-sm text-zinc-900 outline-none focus:border-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-800"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type={showNew ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full border border-zinc-300 bg-zinc-50/50 px-3.5 py-3 text-sm text-zinc-900 outline-none focus:border-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-800"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 border-l-4 border-emerald-400 bg-emerald-900 px-4 text-sm font-bold text-white transition-all hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? "Saving New Password..." : "Save Password & Continue →"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            <button
              type="button"
              onClick={handleCancelAndSignOut}
              className="font-bold text-zinc-600 hover:text-red-700 hover:underline"
            >
              ← Sign out
            </button>
            <span className="text-right">
              ITC Helpdesk:{" "}
              <a
                href={outlookHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Compose an email to the ITC Helpdesk in Outlook"
                className="font-bold text-emerald-900 underline"
              >
                {HELPDESK_EMAIL}
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}3