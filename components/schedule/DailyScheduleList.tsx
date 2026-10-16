"use client";

import { DAY_FULL, fmt, Item, Status } from "./types";

export function StatusTag({ status }: { status: Status }) {
  return status === "Enrolled" ? (
    <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
      Enrolled
    </span>
  ) : (
    <span className="border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-900">
      Added
    </span>
  );
}

type Props = {
  scheduled: Item[];
  conflictCodes: Set<string>;
  onDrop: (code: string) => void;
};

export default function DailyScheduleList({ scheduled, conflictCodes, onDrop }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {scheduled.length === 0 && (
        <div className="border border-emerald-900/15 bg-white px-6 py-16 text-center shadow-xs">
          <div className="mx-auto mb-3 h-3 w-12 bg-emerald-800/20" />
          <p className="text-sm font-semibold text-zinc-700">No classes with a meeting time yet.</p>
        </div>
      )}
      {[0, 1, 2, 3, 4, 5, 6].map((d) => {
        const onDay = scheduled
          .filter((i) => i.days.includes(d))
          .sort((a, b) => a.start! - b.start!);
        if (onDay.length === 0) return null;
        return (
          <section key={d} className="border border-emerald-900/15 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1.5 bg-emerald-800" />
                <h2 className="text-sm font-bold uppercase tracking-tight text-zinc-900">
                  {DAY_FULL[d]}
                </h2>
              </div>
              <span className="text-xs font-bold text-zinc-500">
                {onDay.length} class{onDay.length === 1 ? "" : "es"}
              </span>
            </div>
            <ul className="divide-y divide-zinc-100">
              {onDay.map((i) => (
                <li
                  key={`${i.code}-${d}`}
                  className={`flex flex-col gap-3 border-l-4 px-5 py-4 sm:flex-row sm:items-center ${
                    conflictCodes.has(i.code)
                      ? "border-l-red-600 bg-red-50/40"
                      : i.status === "Enrolled"
                        ? "border-l-emerald-800"
                        : "border-l-sky-600"
                  }`}
                >
                  <div className="shrink-0 sm:w-40">
                    <p className="font-mono text-sm font-bold text-emerald-950">{fmt(i.start!)}</p>
                    <p className="font-mono text-xs text-zinc-500">to {fmt(i.end!)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900">{i.code}</h3>
                      <StatusTag status={i.status} />
                      {conflictCodes.has(i.code) && (
                        <span className="border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-800">
                          Overlap
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-600">{i.title}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-mono text-xs font-bold text-zinc-700">
                      Room {i.room}
                    </span>
                    {i.status === "Added" && (
                      <button
                        onClick={() => onDrop(i.code)}
                        className="border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
                      >
                        Drop
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}