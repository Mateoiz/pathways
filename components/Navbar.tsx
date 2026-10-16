"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/firebase";

const STUDENT_LINKS = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "Subjects",
    href: "/catalog",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    label: "Academic Records",
    href: "/ledger",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
];

const COLLAPSE_KEY = "student_sidebar_collapsed";

function Icon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [studentName, setStudentName] = useState("Student");
  const [studentId, setStudentId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem("mock_user_name");
    const storedId = localStorage.getItem("mock_user_id");
    if (storedName && storedName !== "undefined") setStudentName(storedName);
    if (storedId && storedId !== "undefined") setStudentId(storedId);
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }

  function handleLogout() {
    localStorage.removeItem("mock_user_role");
    localStorage.removeItem("mock_user_name");
    localStorage.removeItem("mock_user_id");
    auth.signOut();
    router.push("/");
  }

  return (
    <aside
      className={`sticky top-0 z-40 w-full md:h-dvh shrink-0 border-b md:border-b-0 md:border-r border-emerald-900/15 bg-white transition-[width] duration-200 ${
        collapsed ? "md:w-[72px]" : "md:w-64"
      }`}
    >
      <div
        className={`flex flex-col h-full px-4 py-3 ${
          collapsed ? "md:px-3 md:py-6" : "md:p-6"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`flex items-center justify-between md:mb-8 md:pb-4 md:border-b md:border-emerald-900/10 ${
            collapsed ? "md:flex-col md:gap-3" : ""
          }`}
        >
          <Link
            href="/dashboard"
            title="Go to Overview"
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="relative h-9 w-9 md:h-10 md:w-10 shrink-0">
              <Image
                src="/logo/dlsau.png"
                alt="DLSAU logo"
                width={40}
                height={40}
                className="h-9 w-9 md:h-10 md:w-10 object-contain transition-transform duration-150 group-hover:scale-105"
                priority
              />
            </div>
            <div className={collapsed ? "md:hidden" : ""}>
              <span className="block font-bold tracking-tight text-emerald-950 leading-none group-hover:text-emerald-700 transition-colors">
                PATHWAYS
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                DLSAU Portal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="md:hidden flex h-9 w-9 items-center justify-center border border-emerald-900/20 text-emerald-950 hover:bg-emerald-50 transition-colors"
            >
              <Icon
                path={
                  mobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
                className="h-5 w-5"
              />
            </button>

            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden md:flex h-8 w-8 items-center justify-center border border-emerald-900/20 text-emerald-900 hover:bg-emerald-50 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 transition-transform duration-200 ${
                  collapsed ? "rotate-180" : "rotate-0"
                }`}
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop Section Label */}
        <div
          className={`hidden md:flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          <span className="h-2.5 w-1 bg-emerald-700" />
          Student
        </div>

        {/* Navigation Links & Footer */}
        <div
          className={`${
            mobileMenuOpen ? "flex" : "hidden"
          } md:flex flex-col flex-1 justify-between pt-3 pb-2 md:p-0 mt-3 md:mt-0 border-t md:border-t-0 border-emerald-900/10 overflow-y-auto no-scrollbar`}
        >
          <nav className="flex flex-col gap-1.5">
            {STUDENT_LINKS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`relative flex shrink-0 items-center gap-3 px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    collapsed ? "md:justify-center md:px-0" : ""
                  } ${
                    isActive
                      ? "bg-emerald-900 text-white shadow-xs"
                      : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-950"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400" />
                  )}
                  <Icon path={item.icon} className="h-5 w-5 shrink-0" />
                  <span className={collapsed ? "md:hidden" : ""}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Sign Out Footer */}
          <div className="border-t border-emerald-900/10 pt-4 mt-4 md:pt-5 md:mt-6">
            <div
              className={`mb-4 border-l-2 border-emerald-700 pl-3 ${
                collapsed ? "md:hidden" : ""
              }`}
            >
              <p className="text-sm font-bold text-zinc-900 truncate">
                {studentName}
              </p>
              <p className="text-xs font-mono font-medium text-emerald-800">
                {studentId || "Student"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="flex w-full items-center justify-center gap-2 border border-emerald-900/20 bg-emerald-50/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-950 transition-colors hover:bg-emerald-900 hover:text-white"
            >
              <Icon
                path="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
                className="h-4 w-4 shrink-0"
              />
              <span className={collapsed ? "md:hidden" : ""}>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}