"use client";

import { DAY_SHORT, HOUR_H, fmt, Item } from "./types";

type Props = {
  scheduled: Item[];
  conflictCodes: Set<string>;
};

export default function WeeklyTimetable({ scheduled, conflictCodes }: Props) {
  const minStart = scheduled.length ? Math.min(...scheduled.map((i) => i.start!)) : 7 * 60;
  const maxEnd = scheduled.length ? Math.max(...scheduled.map((i) => i.end!)) : 18 * 60;
  const startHour = Math.min(7, Math.floor(minStart / 60));
  const endHour = Math.max(18, Math.ceil(maxEnd / 60));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const usedDays = new Set(scheduled.flatMap((i) => i.days));
  const visibleDays = [0, 1, 2, 3, 4, 5].concat(usedDays.has(6) ? [6] : []);

  const blockClass = (item: Item) =>
    conflictCodes.has(item.code)
      ? "border-red-600 bg-red-50 text-red-900"
      : item.status === "Enrolled"
        ? "border-emerald-900 bg-emerald-900 text-white"
        : "border-sky-600 bg-sky-50 text-sky-950";

  return (
    <section className="border border-emerald-900/15 bg-white shadow-xs">
      {scheduled.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-3 h-3 w-12 bg-emerald-800/20" />
          <p className="text-sm font-semibold text-zinc-700">No classes with a meeting time yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Day headers */}
            <div
              className="grid border-b border-zinc-200 bg-emerald-950/[0.03]"
              style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
            >
              <div />
              {visibleDays.map((d) => (
                <div
                  key={d}
                  className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-emerald-950"
                >
                  {DAY_SHORT[d]}
                </div>
              ))}
            </div>

            {/* Grid Body */}
            <div
              className="grid"
              style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
            >
              <div className="relative" style={{ height: hours.length * HOUR_H }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 font-mono text-[10px] font-bold text-zinc-400"
                    style={{ top: i * HOUR_H + (i === 0 ? 8 : 0) }}
                  >
                    {fmt(h * 60).replace(":00 ", " ")}
                  </div>
                ))}
              </div>

              {visibleDays.map((d) => (
                <div
                  key={d}
                  className="relative border-l border-zinc-200"
                  style={{
                    height: hours.length * HOUR_H,
                    backgroundImage: `linear-gradient(to bottom, #e4e4e7 1px, transparent 1px)`,
                    backgroundSize: `100% ${HOUR_H}px`,
                  }}
                >
                  {scheduled
                    .filter((i) => i.days.includes(d))
                    .map((i) => {
                      const top = ((i.start! - startHour * 60) / 60) * HOUR_H;
                      const height = ((i.end! - i.start!) / 60) * HOUR_H - 2;
                      return (
                        <div
                          key={`${i.code}-${d}`}
                          title={`${i.code} — ${i.title}\n${fmt(i.start!)} - ${fmt(i.end!)}\n${i.room}`}
                          className={`absolute left-1 right-1 overflow-hidden border-l-4 px-2 py-1 shadow-xs ${blockClass(i)}`}
                          style={{ top, height }}
                        >
                          <p className="truncate text-xs font-bold leading-tight">{i.code}</p>
                          <p className="truncate font-mono text-[10px] leading-tight opacity-80">
                            {fmt(i.start!)} - {fmt(i.end!)}
                          </p>
                          {height > 56 && (
                            <p className="truncate text-[10px] leading-tight opacity-80">{i.room}</p>
                          )}
                          {height > 84 && (
                            <p className="mt-1 line-clamp-2 text-[10px] leading-tight opacity-80">
                              {i.title}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}