"use client";

import Link from "next/link";

type Props = {
  enlistedSubjects: any[];
  enlistedByTerm: Record<string, any[]>;
  terms: string[];
  currentUnits: number;
  maxUnits: number;
  unitsLeft: number;
  unitPercentage: number;
  trayOpen: boolean;
  setTrayOpen: React.Dispatch<React.SetStateAction<boolean>>;
  locked: boolean;
  onDrop: (subject: any) => void;
  onClearAll: () => void;
};

export default function EnlistmentBar({
  enlistedSubjects,
  enlistedByTerm,
  terms,
  currentUnits,
  maxUnits,
  unitsLeft,
  unitPercentage,
  trayOpen,
  setTrayOpen,
  locked,
  onDrop,
  onClearAll,
}: Props) {
  return (
    <>
      {/* ───────── MY SUBJECTS TRAY ───────── */}
      {trayOpen && (
        <div className="fixed bottom-[76px] left-0 right-0 z-30 md:left-64 px-4">
          <div className="mx-auto max-w-5xl border border-emerald-900/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-emerald-900 px-5 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1.5 bg-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-tight">
                  My Subjects ({enlistedSubjects.length})
                </h2>
              </div>
              <button
                onClick={() => setTrayOpen(false)}
                className="border border-emerald-700 bg-emerald-800/60 px-2.5 py-1 text-xs font-bold hover:bg-emerald-700"
              >
                Close ✕
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {enlistedSubjects.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-3 h-3 w-12 bg-emerald-800/20" />
                  <p className="text-sm font-semibold text-zinc-700">No subjects added yet.</p>
                  <p className="mt-1 text-xs text-zinc-500">Click “Add” on a subject to put it here.</p>
                </div>
              ) : (
                Object.keys(enlistedByTerm)
                  .sort((a, b) => terms.indexOf(a) - terms.indexOf(b))
                  .map((term) => {
                    const list = enlistedByTerm[term];
                    const termUnits = list.reduce((t, s) => t + s.units, 0);
                    return (
                      <div key={term}>
                        <div className="flex items-center justify-between bg-emerald-950/[0.04] px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                          <span>{term}</span>
                          <span className="font-mono">{termUnits} units</span>
                        </div>
                        <ul className="divide-y divide-zinc-100">
                          {list.map((s) => (
                            <li key={s.code} className="flex items-center justify-between gap-4 px-5 py-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-zinc-900">
                                  {s.code}{" "}
                                  <span className="ml-1 font-mono text-xs font-medium text-zinc-500">
                                    {s.units} units
                                  </span>
                                </p>
                                <p className="truncate text-xs text-zinc-600">{s.title}</p>
                              </div>
                              {!locked && (
                                <button
                                  onClick={() => onDrop(s)}
                                  className="shrink-0 border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
                                >
                                  Drop
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
              )}
            </div>

            {enlistedSubjects.length > 0 && (
              <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3">
                <p className="text-xs font-bold text-zinc-600">
                  Total: <span className="font-mono text-emerald-950">{currentUnits} / {maxUnits}</span> units
                </p>
                {!locked && (
                  <button
                    onClick={onClearAll}
                    className="text-xs font-bold text-red-700 underline hover:text-red-900"
                  >
                    Drop all subjects
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────── STICKY SUMMARY BAR ───────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-emerald-900 bg-white px-4 sm:px-6 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 md:gap-6">
   <div className="flex flex-1 items-center justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              {enlistedSubjects.length} subject{enlistedSubjects.length === 1 ? "" : "s"} selected
            </span>
            <span
              className={`font-mono text-sm font-bold ${
                currentUnits >= maxUnits ? "text-red-700" : "text-emerald-800"
              }`}
            >
              {currentUnits} / {maxUnits} units
              <span className="ml-2 hidden text-xs font-medium text-zinc-500 sm:inline">
                ({unitsLeft} left)
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setTrayOpen((o) => !o)}
              aria-expanded={trayOpen}
              className="shrink-0 border border-emerald-800 bg-white px-3 sm:px-4 py-2.5 text-sm font-bold text-emerald-900 transition-all hover:bg-emerald-800 hover:text-white"
            >
              My Subjects {trayOpen ? "▾" : "▴"}
            </button>
            <Link
              href="/schedule"
              className="shrink-0 border-l-4 border-emerald-400 bg-emerald-900 px-4 sm:px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
            >
              View Schedule →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}