"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/firebase";

const ADMIN_LINKS = [
  {
    label: "System Health",
    href: "/dashboard",
    icon: "M3 13h4l3-8 4 14 3-6h4",
  },
  {
    label: "Student Profiles",
    href: "/admin/students",
    icon: "M15 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9 11a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.87M16 5.13a3 3 0 010 5.74",
  },
  {
    label: "Curriculum Config",
    href: "/curriculum",
    icon: "M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h12",
  },
  {
    label: "User Roles",
    href: "/roles",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  },
  {
    label: "Audit Logs",
    href: "/logs",
    icon: "M9 5h6M9 9h6M9 13h4M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z",
  },
];

const COLLAPSE_KEY = "admin_sidebar_collapsed";

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

export default function AdminNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState("System Admin");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem("mock_user_name");
    if (storedName && storedName !== "undefined") {
      setAdminName(storedName);
    }
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

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
      className={`w-full shrink-0 border-b md:border-b-0 md:border-r border-emerald-900/15 bg-white transition-[width] duration-200 ${
        collapsed ? "md:w-[72px]" : "md:w-64"
      }`}
    >
      <div className={`flex flex-col h-full p-4 ${collapsed ? "md:px-3 md:py-6" : "md:p-6"}`}>
        {/* Brand Header */}
        <div
          className={`flex items-center justify-between mb-4 md:mb-8 pb-4 border-b border-emerald-900/10 ${
            collapsed ? "md:flex-col md:gap-3" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              <Image
                src="/logo/dlsau.png"
                alt="DLSAU logo"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>
            <div className={collapsed ? "md:hidden" : ""}>
              <span className="block font-bold tracking-tight text-emerald-950 leading-none">
                PATHWAYS
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                DLSAU Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="md:hidden border border-emerald-800 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
            >
              Sign Out
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-8 w-8 items-center justify-center border border-emerald-900/20 text-emerald-900 hover:bg-emerald-50"
            >
              {/* Desktop: chevron left/right. Mobile: chevron up/down */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 transition-transform duration-200 ${
                  collapsed ? "rotate-180 md:rotate-180" : "rotate-90 md:rotate-0"
                }`}
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={`hidden md:flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          <span className="h-2.5 w-1 bg-emerald-700" />
          Administration
        </div>

        <nav
          className={`flex-row md:flex-col flex-1 gap-1.5 overflow-x-auto no-scrollbar pb-2 md:pb-0 ${
            collapsed ? "hidden md:flex" : "flex"
          }`}
        >
          {ADMIN_LINKS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                <Icon path={item.icon} className="hidden md:block h-5 w-5 shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block border-t border-emerald-900/10 pt-5 mt-6">
          {!collapsed && (
            <div className="mb-4 border-l-2 border-emerald-700 pl-3">
              <p className="text-sm font-bold text-zinc-900 truncate">{adminName}</p>
              <p className="text-xs font-medium text-emerald-800">DLSAU Administrator</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sign Out"
            aria-label="Sign Out"
            className="flex w-full items-center justify-center border border-emerald-900/20 bg-emerald-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-950 transition-colors hover:bg-emerald-900 hover:text-white"
          >
            {collapsed ? (
              <Icon path="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            ) : (
              "Sign Out"
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}