"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/firebase";

const STUDENT_LINKS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Subjects", href: "/catalog" },
  { label: "Schedule", href: "/schedule" },
  { label: "Academic Records", href: "/ledger" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [studentName, setStudentName] = useState("Student");
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    const storedName = localStorage.getItem("mock_user_name");
    const storedId = localStorage.getItem("mock_user_id");
    if (storedName && storedName !== "undefined") setStudentName(storedName);
    if (storedId && storedId !== "undefined") setStudentId(storedId);
  }, []);

  function handleLogout() {
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    localStorage.removeItem("mock_user_id");
    auth.signOut();
    router.push("/");
  }

  return (
    <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-emerald-900/15 bg-white">
      <div className="flex flex-col h-full p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-8 pb-4 border-b border-emerald-900/10">
          <div className="flex items-center gap-3">
            <Image
              src="/logo/dlsau.png"
              alt="DLSAU logo"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
            <div>
              <span className="block font-bold tracking-tight text-emerald-950 leading-none">
                PATHWAYS
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                DLSAU Portal
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="md:hidden border border-emerald-800 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
          >
            Sign Out
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <span className="h-2.5 w-1 bg-emerald-700" />
          Student
        </div>

        <nav className="flex flex-row md:flex-col flex-1 gap-1.5 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          {STUDENT_LINKS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative shrink-0 px-3.5 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-950"
                }`}
              >
                {isActive && <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400" />}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block border-t border-emerald-900/10 pt-5 mt-6">
          <div className="mb-4 border-l-2 border-emerald-700 pl-3">
            <p className="text-sm font-bold text-zinc-900 truncate">{studentName}</p>
            <p className="text-xs font-mono font-medium text-emerald-800">{studentId || "Student"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center border border-emerald-900/20 bg-emerald-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 transition-colors hover:bg-emerald-900 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}