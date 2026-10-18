"use client";

// components/WeeklyTimetable.tsx
import { DAYS, DAY_START, DAY_END, fmtTime, meetingsOverlap, type Day, type Meeting, type MeetingKind } from "@/lib/autoSchedule";

export interface TimetableItem {
  code: string;
  title?: string;
  meetings: Meeting[];
}

interface Props {
  items: TimetableItem[]; // what the student has already added
  preview?: TimetableItem | null; // a subject they're hovering/considering, drawn dashed
}

const PX_PER_MIN = 0.9; // 54px per hour
const GRID_HEIGHT = (DAY_END - DAY_START) * PX_PER_MIN;

const KIND_STYLE: Record<MeetingKind, string> = {
  lecture: "bg-emerald-100 border-emerald-700 text-emerald-950",
  lab: "bg-teal-100 border-teal-700 text-teal-950",
  pe: "bg-amber-100 border-amber-600 text-amber-950",
  nstp: "bg-zinc-200 border-zinc-600 text-zinc-900",
};
const KIND_LABEL: Record<MeetingKind, string> = {
  lecture: "Lecture",
  lab: "Lab",
  pe: "PE",
  nstp: "NSTP",
};

interface Block {
  code: string;
  title?: string;
  m: Meeting;
  isPreview: boolean;
  conflict: boolean;
}

export default function WeeklyTimetable({ items, preview }: Props) {
  const all = preview ? [...items, preview] : items;

  const blocks: Block[] = all.flatMap((it) =>
    it.meetings.map((m) => ({
      code: it.code,
      title: it.title,
      m,
      isPreview: it === preview,
      conflict: all.some(
        (other) => other.code !== it.code && other.meetings.some((om) => meetingsOverlap(m, om))
      ),
    }))
  );

  const conflictPairs = new Set<string>();
  for (const a of all)
    for (const b of all)
      if (a.code < b.code && a.meetings.some((x) => b.meetings.some((y) => meetingsOverlap(x, y))))
        conflictPairs.add(`${a.code} and ${b.code}`);

  // Only show days that have classes, plus Mon-Fri always, so the grid stays stable.
  const usedDays = new Set<Day>(blocks.map((b) => b.m.day));
  const visibleDays = DAYS.filter((d) => d !== "Sat" || usedDays.has("Sat"));

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
  const cols = `56px repeat(${visibleDays.length}, minmax(0, 1fr))`;

  return (
    <section aria-label="Weekly timetable" className="border border-emerald-900/15 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-5 w-1.5 bg-emerald-800" />
          <h2 className="text-base font-bold text-zinc-900">Weekly schedule</h2>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-zinc-600">
          {(Object.keys(KIND_LABEL) as MeetingKind[]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 border ${KIND_STYLE[k]}`} />
              {KIND_LABEL[k]}
            </li>
          ))}
        </ul>
      </div>

      {conflictPairs.size > 0 && (
        <div role="alert" className="flex items-stretch border-b border-red-200 bg-white text-red-900">
          <div className="w-2 shrink-0 bg-red-600" />
          <p className="px-4 py-2.5 text-sm font-semibold">
            Time conflict: {[...conflictPairs].join("; ")}. Pick a different section or remove one.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* day headers */}
          <div className="grid border-b border-zinc-200 bg-zinc-50" style={{ gridTemplateColumns: cols }}>
            <div />
            {visibleDays.map((d) => (
              <div key={d} className="border-l border-zinc-200 py-2 text-center text-sm font-bold text-zinc-700">
                {d}
              </div>
            ))}
          </div>

          {/* body */}
          <div className="grid" style={{ gridTemplateColumns: cols }}>
            {/* time gutter */}
            <div className="relative" style={{ height: GRID_HEIGHT }}>
              {hours.map((h) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-zinc-500"
                  style={{ top: (h - DAY_START) * PX_PER_MIN, display: h === DAY_START ? "none" : undefined }}
                >
                  {fmtTime(h).replace(":00", "")}
                </span>
              ))}
            </div>

            {visibleDays.map((day) => (
              <div
                key={day}
                className="relative border-l border-zinc-200"
                style={{
                  height: GRID_HEIGHT,
                  backgroundImage: "linear-gradient(to bottom, #e4e4e7 1px, transparent 1px)",
                  backgroundSize: `100% ${60 * PX_PER_MIN}px`,
                }}
              >
                {blocks
                  .filter((b) => b.m.day === day)
                  .map((b) => {
                    const style = b.conflict ? "bg-red-100 border-red-600 text-red-900" : KIND_STYLE[b.m.kind];
                    return (
                      <div
                        key={`${b.code}-${b.m.start}`}
                        className={`absolute inset-x-0.5 overflow-hidden border-l-4 px-2 py-1 ${style} ${
                          b.isPreview ? "border-dashed opacity-80 outline outline-1 outline-dashed outline-zinc-500" : ""
                        }`}
                        style={{
                          top: (b.m.start - DAY_START) * PX_PER_MIN + 1,
                          height: (b.m.end - b.m.start) * PX_PER_MIN - 2,
                        }}
                        title={`${b.code}${b.title ? `: ${b.title}` : ""} (${fmtTime(b.m.start)} to ${fmtTime(b.m.end)})`}
                      >
                        <p className="truncate text-xs font-bold leading-tight">{b.code}</p>
                        <p className="truncate text-[11px] leading-tight">
                          {fmtTime(b.m.start)} to {fmtTime(b.m.end)}
                        </p>
                        {b.m.end - b.m.start >= 120 && (
                          <p className="mt-0.5 text-[11px] font-semibold leading-tight">{KIND_LABEL[b.m.kind]}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}