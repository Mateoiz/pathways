"use client";

// app/applications/page.tsx  (registrar + admin)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";
import RegistrarNavbar from "@/components/RegistrarNavbar";
import {
  REQUIRED_DOCS,
  STATUS_LABEL,
  TYPE_LABEL,
  YEAR_LEVELS,
  approveApplication,
  fullName,
  missingDocs,
  programLabel,
  type ApplicationDoc,
  type ApplicationStatus,
} from "@/lib/applications";

type Filter = ApplicationStatus | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "needs_info", label: "Needs info" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_STYLE: Record<ApplicationStatus, { badge: string; dot: string }> = {
  pending: { badge: "border-amber-300 bg-amber-50 text-amber-900", dot: "bg-amber-600" },
  needs_info: { badge: "border-sky-300 bg-sky-50 text-sky-900", dot: "bg-sky-600" },
  approved: { badge: "border-emerald-300 bg-emerald-50 text-emerald-900", dot: "bg-emerald-700" },
  rejected: { badge: "border-red-300 bg-red-50 text-red-900", dot: "bg-red-600" },
};

function fmtDate(ts?: any): string {
  if (!ts) return "Just now";
  if (typeof ts?.toDate === "function") {
    return ts.toDate().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }
  const d = new Date(ts);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }
  return "Just now";
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-bold ${s.badge}`}>
      <span className={`h-1.5 w-1.5 ${s.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function ApplicationsPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [apps, setApps] = useState<ApplicationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => {
    const storedRole = localStorage.getItem("mock_user_role");
    if (storedRole !== "registrar" && storedRole !== "admin") {
      router.push("/");
      return;
    }
    setRole(storedRole);
    setReviewer(localStorage.getItem("mock_user_name") || "Registrar");
  }, [router]);

// Live feed: new applications show up without refreshing (even if createdAt is pending/missing)
  useEffect(() => {
    if (!role) return;
    const q = query(collection(db, "applications"), limit(500));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const parsed: ApplicationDoc[] = snap.docs.map((d) => {
          const raw = d.data() as any;
          const applicant = raw.applicant || {
            firstName: raw.firstName || "",
            middleName: raw.middleName || "",
            lastName: raw.lastName || "",
            suffix: raw.suffix || "",
            birthDate: raw.birthDate || "",
            sex: raw.sex || "",
            citizenship: raw.citizenship || "Filipino",
            email: raw.email || "",
            mobile: raw.mobile || "",
            addressLine: raw.addressLine || "",
            city: raw.city || "",
            province: raw.province || "",
            zip: raw.zip || "",
            guardianName: raw.guardianName || "",
            guardianRelationship: raw.guardianRelationship || "",
            guardianMobile: raw.guardianMobile || "",
            previousSchool: raw.previousSchool || "",
            previousTrack: raw.previousTrack || "",
            yearGraduated: raw.yearGraduated || "",
            programId: raw.programId || "bs-computer-science",
            consent: true,
          };
          return {
            id: d.id,
            reference: raw.reference || d.id,
            status: (raw.status as ApplicationStatus) || "pending",
            type: raw.type || "freshman",
            applicant,
            documents: raw.documents || {},
            reviewNote: raw.reviewNote || "",
            reviewedBy: raw.reviewedBy,
            reviewedAt: raw.reviewedAt ?? null,
            studentNumber: raw.studentNumber,
            createdAt: raw.createdAt ?? null,
            updatedAt: raw.updatedAt ?? null,
          };
        });

        // Sort newest-first client-side so docs without `createdAt` are never hidden
        parsed.sort((x, y) => {
          const tx = (x.createdAt as any)?.seconds ?? 0;
          const ty = (y.createdAt as any)?.seconds ?? 0;
          return ty - tx;
        });

        setApps(parsed);
        setLoading(false);
        setLoadError(false);
      },
      (err) => {
        console.error("Firestore applications listener error:", err);
        setLoadError(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [role]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { pending: 0, needs_info: 0, approved: 0, rejected: 0, all: apps.length };
    apps.forEach((a) => {
      if (c[a.status] !== undefined) c[a.status] += 1;
    });
    return c;
  }, [apps]);

  // Same email, or same name + birth date, on more than one live application
  const duplicateIds = useMemo(() => {
    const byKey = new Map<string, string[]>();
    apps
      .filter((a) => a.status !== "rejected")
      .forEach((a) => {
        const p = a.applicant;
        if (!p) return;
        const keys = [
          `e:${(p.email || "").toLowerCase()}`,
          `n:${(p.lastName || "").toLowerCase()}|${(p.firstName || "").toLowerCase()}|${p.birthDate || ""}`,
        ];
        keys.forEach((k) => byKey.set(k, [...(byKey.get(k) ?? []), a.id]));
      });
    const out = new Set<string>();
    byKey.forEach((ids) => ids.length > 1 && ids.forEach((id) => out.add(id)));
    return out;
  }, [apps]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = apps.filter((a) => filter === "all" || a.status === filter);
    if (term) {
      list = list.filter((a) =>
        [fullName(a.applicant), a.reference, a.applicant.email, a.studentNumber ?? ""].some((v) =>
          v.toLowerCase().includes(term)
        )
      );
    }
    // Work the queue oldest-first so nobody waits forever
    if (filter === "pending" || filter === "needs_info") {
      list = [...list].sort((x, y) => (x.createdAt?.seconds ?? Infinity) - (y.createdAt?.seconds ?? Infinity));
    }
    return list;
  }, [apps, filter, search]);

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  if (!role) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAF9] text-zinc-900 font-sans">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm" role="status">
          <div
            className={`flex items-stretch border bg-white shadow-xl ${
              toast.type === "error" ? "border-red-200 text-red-900" : "border-emerald-200 text-emerald-950"
            }`}
          >
            <div className={`w-2 shrink-0 ${toast.type === "error" ? "bg-red-600" : "bg-emerald-700"}`} />
            <div className="px-4 py-3 text-sm font-semibold">{toast.text}</div>
          </div>
        </div>
      )}

      {role === "admin" ? <AdminNavbar /> : <RegistrarNavbar />}

      <main className="flex-1 overflow-y-auto">
        <div className="h-2 w-full bg-emerald-900 flex">
          <div className="h-full w-32 bg-emerald-600" />
          <div className="h-full w-12 bg-emerald-400" />
        </div>

        <div className="p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto">
          <header className="mb-6 border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white px-6 py-5 shadow-xs">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">Admission applications</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Review new applications, check documents, and admit applicants. Approving creates the student profile
              automatically.
            </p>
          </header>

          {/* filters + search */}
          <section className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex flex-wrap border border-zinc-300 bg-white">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold transition-colors ${
                    filter === f.key ? "bg-emerald-900 text-white" : "text-zinc-700 hover:bg-emerald-50"
                  }`}
                >
                  {f.label}
                  <span
                    className={`font-mono text-[11px] ${filter === f.key ? "text-emerald-200" : "text-zinc-500"}`}
                  >
                    {counts[f.key]}
                  </span>
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, reference, email, student no."
              aria-label="Search applications"
              className="w-full border border-zinc-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-800 focus:ring-1 focus:ring-emerald-800 lg:w-80"
            />
          </section>

          {/* list */}
          <section className="border border-emerald-900/15 bg-white shadow-xs">
            {loading ? (
              <p className="px-6 py-16 text-center text-sm text-zinc-600">Loading applications...</p>
            ) : loadError ? (
              <p className="px-6 py-16 text-center text-sm font-semibold text-red-700">
                Couldn&apos;t load applications. Check your connection and your permissions, then refresh.
              </p>
            ) : visible.length === 0 ? (
              <p className="px-6 py-16 text-center text-sm text-zinc-600">
                {search
                  ? "No applications match your search."
                  : filter === "pending"
                    ? "Nothing waiting for review."
                    : "No applications in this view."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="border-b border-emerald-900/10 bg-emerald-950/[0.03] text-[11px] uppercase tracking-wider text-emerald-950">
                    <tr>
                      <th className="px-6 py-3.5 font-bold">Applicant</th>
                      <th className="px-6 py-3.5 font-bold">Reference</th>
                      <th className="px-6 py-3.5 font-bold">Program</th>
                      <th className="px-6 py-3.5 font-bold">Type</th>
                      <th className="px-6 py-3.5 font-bold">Submitted</th>
                      <th className="px-6 py-3.5 font-bold">Status</th>
                      <th className="px-6 py-3.5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {visible.map((a) => (
                      <tr key={a.id} className="hover:bg-emerald-50/40">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-zinc-900">{fullName(a.applicant)}</p>
                          <p className="text-xs text-zinc-600">{a.applicant.email}</p>
                          {duplicateIds.has(a.id) && (
                            <p className="mt-1 text-[11px] font-bold text-amber-800">Possible duplicate</p>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-950">{a.reference}</td>
                        <td className="px-6 py-4 text-zinc-800">{programLabel(a.applicant.programId)}</td>
                        <td className="px-6 py-4 text-zinc-700">{TYPE_LABEL[a.type]}</td>
                        <td className="px-6 py-4 text-zinc-700">{fmtDate(a.createdAt)}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedId(a.id)}
                            className="border border-emerald-800 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-800 hover:text-white"
                          >
                            {a.status === "pending" || a.status === "needs_info" ? "Review" : "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {selected && (
        <ReviewModal
          key={selected.id}
          app={selected}
          duplicate={duplicateIds.has(selected.id)}
          reviewer={reviewer}
          onClose={() => setSelectedId(null)}
          onToast={showToast}
        />
      )}
    </div>
  );
}

/* ───────────────────────── review modal ───────────────────────── */

function ReviewModal({
  app,
  duplicate,
  reviewer,
  onClose,
  onToast,
}: {
  app: ApplicationDoc;
  duplicate: boolean;
  reviewer: string;
  onClose: () => void;
  onToast: (type: "success" | "error", text: string) => void;
}) {
  const a = app.applicant;
  const appRef = doc(db, "applications", app.id);
  const required = REQUIRED_DOCS[app.type];
  const missing = missingDocs(app);
  const isApproved = app.status === "approved";
  const isOpen = app.status === "pending" || app.status === "needs_info";

  const [yearLevel, setYearLevel] = useState("1st Year");
  const [note, setNote] = useState(app.reviewNote ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleDoc(key: string, checked: boolean) {
    try {
      await updateDoc(appRef, { [`documents.${key}`]: checked, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error(e);
      setError("Couldn't update the document checklist.");
    }
  }

  async function changeStatus(status: "needs_info" | "rejected" | "pending") {
    if ((status === "needs_info" || status === "rejected") && !note.trim()) {
      setError(status === "rejected" ? "Add the reason for rejecting." : "Tell the applicant what's missing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateDoc(appRef, {
        status,
        reviewNote: note.trim(),
        reviewedBy: reviewer,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onToast("success", `Application ${app.reference} marked "${STATUS_LABEL[status].toLowerCase()}".`);
      onClose();
    } catch (e) {
      console.error(e);
      setError("Couldn't save. Please try again.");
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError("");
    try {
      const { studentNumber, schoolEmail } = await approveApplication(app.id, { yearLevel, reviewer });
      onToast("success", `Approved. Student number ${studentNumber} (${schoolEmail}).`);
      onClose();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Couldn't approve this application.");
      setConfirming(false);
      setBusy(false);
    }
  }

  const address = [a.addressLine, a.city, a.province, a.zip].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Application ${app.reference}`}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border-2 border-emerald-900 bg-white shadow-2xl"
      >
        <div className="h-2 w-full bg-emerald-800 flex shrink-0">
          <div className="h-full w-24 bg-emerald-500" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-emerald-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="h-7 w-1.5 bg-emerald-400" />
            <div>
              <h2 className="text-base font-bold tracking-tight">{fullName(a)}</h2>
              <p className="font-mono text-xs text-emerald-200">{app.reference}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-emerald-700 bg-emerald-800/60 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {duplicate && (
            <div className="flex items-stretch border border-amber-300 bg-amber-50 text-amber-950">
              <div className="w-2 shrink-0 bg-amber-500" />
              <p className="px-4 py-3 text-sm font-semibold">
                Another application has the same email, or the same name and birth date. Check before approving so the
                student isn&apos;t admitted twice.
              </p>
            </div>
          )}

{isApproved && (
            <div className="border border-emerald-200 border-l-4 border-l-emerald-700 bg-emerald-50/60 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Admitted</p>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-950">{app.studentNumber}</p>
              <p className="text-sm text-zinc-700">
                Login ID: <span className="font-mono font-bold">{app.studentNumber}</span> (Default password: <span className="font-mono">password123</span>)
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <Link
                  href={`/admin/students/new?studentId=${app.studentNumber}`}
                  className="border-l-4 border-emerald-400 bg-emerald-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Complete / Edit Full Student Profile →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(`${fullName(a)}\nStudent number: ${app.studentNumber}\nDefault Password: password123`)
                      .then(() => onToast("success", "Admission details copied."))
                      .catch(() => onToast("error", "Couldn't copy."));
                  }}
                  className="border border-emerald-800 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-800 hover:text-white"
                >
                  Copy Login Details
                </button>
              </div>
            </div>
          )}

          <Block title="Application">
            <Item k="Status" v={<StatusBadge status={app.status} />} />
            <Item k="Type" v={TYPE_LABEL[app.type]} />
            <Item k="Program" v={programLabel(a.programId)} />
            <Item k="Submitted" v={fmtDate(app.createdAt)} />
          </Block>

          <Block title="Personal">
            <Item k="Date of birth" v={a.birthDate} />
            <Item k="Sex" v={a.sex} />
            <Item k="Citizenship" v={a.citizenship} />
          </Block>

          <Block title="Contact">
            <Item k="Email" v={a.email} />
            <Item k="Mobile" v={a.mobile} />
            <Item k="Address" v={address} wide />
          </Block>

          <Block title="Parent or guardian">
            <Item k="Name" v={a.guardianName} />
            <Item k="Relationship" v={a.guardianRelationship} />
            <Item k="Mobile" v={a.guardianMobile} />
          </Block>

          <Block title="Previous school">
            <Item k="School" v={a.previousSchool} />
            <Item k={app.type === "freshman" ? "Strand / track" : "Course"} v={a.previousTrack} />
            <Item k={app.type === "freshman" ? "Year graduated" : "Last year attended"} v={a.yearGraduated} />
          </Block>

          {/* documents */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Documents received</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {required.map((d) => (
                <li key={d.key}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 border border-l-4 px-3.5 py-2.5 text-sm font-semibold ${
                      app.documents?.[d.key]
                        ? "border-zinc-200 border-l-emerald-700 bg-white text-zinc-800"
                        : "border-amber-200 border-l-amber-500 bg-amber-50/50 text-amber-950"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!app.documents?.[d.key]}
                      disabled={isApproved}
                      onChange={(e) => toggleDoc(d.key, e.target.checked)}
                      className="h-4 w-4 accent-emerald-800"
                    />
                    {d.label}
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {/* decision */}
          {!isApproved && (
            <section className="border-t border-zinc-200 pt-5">
              {error && (
                <div role="alert" className="mb-4 flex items-stretch border border-red-300 bg-red-50/50 text-red-900">
                  <div className="w-2 shrink-0 bg-red-600" />
                  <p className="px-4 py-3 text-sm font-semibold">{error}</p>
                </div>
              )}

              <label htmlFor="note" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Note (required to reject or request info)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setError("");
                }}
                rows={3}
                className="mt-1.5 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-800 focus:ring-1 focus:ring-emerald-800"
              />

              {isOpen && (
                <div className="mt-4 flex flex-col gap-1.5 sm:max-w-xs">
                  <label htmlFor="yearLevel" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Admit as
                  </label>
                  <select
                    id="yearLevel"
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-800"
                  >
                    {YEAR_LEVELS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {isOpen && missing.length > 0 && (
                <p className="mt-3 text-xs font-semibold text-amber-800">
                  Can&apos;t approve yet. Still missing: {missing.map((m) => m.label).join(", ")}.
                </p>
              )}
            </section>
          )}
        </div>

        {/* actions */}
        {!isApproved && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {isOpen ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeStatus("needs_info")}
                    className="border border-sky-700 bg-white px-4 py-2 text-xs font-bold text-sky-900 hover:bg-sky-50 disabled:opacity-50"
                  >
                    Request info
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeStatus("rejected")}
                    className="border border-red-700 bg-white px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeStatus("pending")}
                  className="border border-zinc-400 bg-white px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Reopen as pending
                </button>
              )}
            </div>

            {isOpen &&
              (confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-700">
                    Create a {yearLevel} profile for {a.firstName}?
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={approve}
                    className="border-l-4 border-emerald-400 bg-emerald-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {busy ? "Creating..." : "Yes, approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(false)}
                    className="border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy || missing.length > 0}
                  onClick={() => setConfirming(true)}
                  className="border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Approve and create profile
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
      <dl className="grid gap-x-6 gap-y-3 border border-zinc-200 bg-zinc-50/50 p-4 text-sm sm:grid-cols-3">{children}</dl>
    </section>
  );
}

function Item({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-3" : undefined}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{k}</dt>
      <dd className="mt-0.5 break-words font-semibold text-zinc-900">{v || "-"}</dd>
    </div>
  );
}