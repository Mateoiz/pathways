export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const HOUR_H = 64; // pixels per hour in the timetable

export type Status = "Enrolled" | "Added";

export type Item = {
  code: string;
  title: string;
  room: string;
  units?: number;
  status: Status;
  days: number[]; // 0 = Mon ... 6 = Sun
  start: number | null; // minutes from midnight
  end: number | null;
  scheduled: boolean;
};

// Accepts "Mon, Wed", "Monday/Thursday" and compact codes like "MWF", "TTh", "MTh"
export function parseDays(text?: string): number[] {
  if (!text) return [];
  const out: number[] = [];
  const add = (i: number | undefined) => {
    if (i !== undefined && i >= 0 && !out.includes(i)) out.push(i);
  };

  text.split(/[\s,/&]+/).forEach((t) => add(DAY_KEYS.indexOf(t.slice(0, 3).toLowerCase())));
  if (out.length) return out;

  const COMPACT: Record<string, number> = { M: 0, T: 1, W: 2, Th: 3, F: 4, S: 5, Sa: 5, Su: 6 };
  (text.match(/Th|Sa|Su|M|T|W|F|S/g) ?? []).forEach((tok) => add(COMPACT[tok]));
  return out;
}

export function parseTime(text?: string): { start: number; end: number } | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  const to24 = (h: string, min: string, ap: string) => {
    let hh = parseInt(h, 10) % 12;
    if (ap.toUpperCase() === "PM") hh += 12;
    return hh * 60 + parseInt(min, 10);
  };
  return { start: to24(m[1], m[2], m[3]), end: to24(m[4], m[5], m[6]) };
}

export function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function toItem(raw: any, status: Status): Item {
  const days = parseDays(raw.days);
  const t = parseTime(raw.time);
  return {
    code: raw.code,
    title: raw.title,
    room: raw.room || "TBA",
    units: raw.units,
    status,
    days,
    start: t?.start ?? null,
    end: t?.end ?? null,
    scheduled: days.length > 0 && !!t,
  };
}