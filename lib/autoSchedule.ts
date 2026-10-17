// lib/autoSchedule.ts
// Fills in `days` and `time` for catalog subjects, in the same format you already use:
//   days: "Thu"        time: "08:00 AM - 12:00 PM"
//
// Rules (taken from your hand-entered 2nd Year 1st Trimester schedule):
//   - 80 minutes per unit (3 units = 4 hours, 2 units = 2h 40m, 1 unit = 1h 20m)
//   - Hand-entered days/time are never touched; new subjects are placed around them
//   - 30-minute break between classes, nothing before 7:30 AM or after 7:30 PM
//   - Nothing straddles 12:00 to 12:30 (afternoon classes start at 12:30 or later)
//   - Lecture + lab pairs (XXX101A + XXX101B) go back-to-back in one block
//   - Subjects over 3 units (6-unit ones) meet twice a week, same time, e.g. days "Mon/Thu"
//   - NSTP goes on Saturday; internships are left unscheduled

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type MeetingKind = "lecture" | "lab" | "pe" | "nstp";

export interface Meeting {
  day: Day;
  start: number; // minutes from midnight (450 = 7:30 AM)
  end: number;
  kind: MeetingKind;
}

export interface TermEntry {
  year: string;
  term: string;
  block: boolean;
  codes: string[];
}

export interface CatalogSubject {
  code: string;
  units: number;
  title?: string;
  days?: string;
  time?: string;
}

export const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_START = 7 * 60; // timetable grid range
export const DAY_END = 20 * 60;

const MIN_PER_UNIT = 80;
const FIRST_START = 7 * 60 + 30;
const LAST_END = 19 * 60 + 30;
const BREAK = 30;
const LUNCH_START = 12 * 60;
const LUNCH_END = 12 * 60 + 30;

/* ───────────── formatting & parsing ───────────── */

/** "7:30 AM" for the UI. */
export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** "07:30 AM", the format stored in Firestore. */
function fmtSlot(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const DAY_BY_PREFIX: Record<string, Day> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

function kindOf(code: string, title = ""): MeetingKind {
  if (/^NSTP/i.test(code)) return "nstp";
  if (/^PEED/i.test(code)) return "pe";
  if (/\bLAB\b/i.test(title)) return "lab";
  return "lecture";
}

/** Turns a subject's `days` + `time` strings into meetings. Accepts "Thu" or "Mon/Thu". */
export function parseMeetings(days?: string, time?: string, code = "", title = ""): Meeting[] {
  if (!days || !time) return [];
  const t = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!t) return [];
  const toMin = (h: string, m: string, ap: string) =>
    ((Number(h) % 12) + (ap.toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m);
  const start = toMin(t[1], t[2], t[3]);
  const end = toMin(t[4], t[5], t[6]);
  const kind = kindOf(code, title);
  return days
    .split(/[\/,&\s]+/)
    .map((d) => DAY_BY_PREFIX[d.slice(0, 3).toLowerCase()])
    .filter((d): d is Day => !!d)
    .map((day) => ({ day, start, end, kind }));
}

export function meetingsOverlap(a: Meeting, b: Meeting): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

export function hasConflict(a: Meeting[], b: Meeting[]): boolean {
  return a.some((x) => b.some((y) => meetingsOverlap(x, y)));
}

/* ───────────── placement ───────────── */

type Occ = Record<Day, Meeting[]>;
const newOcc = (): Occ => ({ Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] });

function pairOptions(): Day[][] {
  const preferred: Day[][] = [
    ["Mon", "Thu"],
    ["Tue", "Fri"],
    ["Wed", "Sat"],
  ];
  const rest: Day[][] = [];
  for (let i = 0; i < DAYS.length; i++)
    for (let j = i + 1; j < DAYS.length; j++)
      if (!preferred.some((p) => p[0] === DAYS[i] && p[1] === DAYS[j])) rest.push([DAYS[i], DAYS[j]]);
  return [...preferred, ...rest];
}

const SINGLE_OPTIONS: Day[][] = DAYS.map((d) => [d]);
const NSTP_OPTIONS: Day[][] = [["Sat"], ...DAYS.filter((d) => d !== "Sat").map((d) => [d])];
const PAIR_OPTIONS = pairOptions();

function candidateStarts(occ: Meeting[]): number[] {
  const s = new Set<number>([FIRST_START, LUNCH_END]);
  occ.forEach((o) => s.add(o.end + BREAK));
  return [...s].sort((a, b) => a - b);
}

function dayFits(occ: Meeting[], start: number, end: number): boolean {
  if (end > LAST_END) return false;
  if (start < LUNCH_END && end > LUNCH_START) return false;
  return occ.every((o) => start >= o.end + BREAK || end + BREAK <= o.start);
}

/** First option where every day has room at one common start time. Fills Mon to Fri in order. */
function place(options: Day[][], minutes: number, occ: Occ): { days: Day[]; start: number } | null {
  for (const days of options) {
    const starts = [...new Set(days.flatMap((d) => candidateStarts(occ[d])))].sort((a, b) => a - b);
    for (const s of starts) {
      if (days.every((d) => dayFits(occ[d], s, s + minutes))) return { days, start: s };
    }
  }
  return null;
}

interface Group {
  parts: { code: string; minutes: number }[];
  sessions: 1 | 2;
  priority: number; // 0 = NSTP, 1 = PE, 2 = everything else
}

function scheduleTerm(
  t: TermEntry,
  byCode: Map<string, CatalogSubject>,
  assigned: Map<string, Meeting[]>,
  warnings: string[]
) {
  const label = `${t.year}, ${t.term}`;
  const occ = newOcc();
  for (const code of t.codes) for (const m of assigned.get(code) ?? []) occ[m.day].push(m);

  const todo = t.codes.filter((c) => !assigned.has(c));
  const missing = todo.filter((c) => !byCode.has(c));
  if (missing.length) warnings.push(`${label}: no catalog entry for ${missing.join(", ")} (skipped).`);
  const pending = todo.filter((c) => byCode.has(c));

  // Build groups (a lecture+lab pair is one group)
  const used = new Set<string>();
  const groups: Group[] = [];
  for (const code of pending) {
    if (used.has(code)) continue;
    const s = byCode.get(code)!;
    if (/INTERNSHIP|PRACTICUM|ON-THE-JOB|OJT/i.test(s.title ?? "")) {
      warnings.push(`${label}: ${code} is an internship, so it was left unscheduled.`);
      continue;
    }
    const labCode = code.endsWith("A") ? `${code.slice(0, -1)}B` : null;
    if (labCode && pending.includes(labCode) && !used.has(labCode)) {
      const lab = byCode.get(labCode)!;
      used.add(code).add(labCode);
      groups.push({
        parts: [
          { code, minutes: s.units * MIN_PER_UNIT },
          { code: labCode, minutes: lab.units * MIN_PER_UNIT },
        ],
        sessions: 1,
        priority: 2,
      });
      continue;
    }
    if (s.units > 6) {
      warnings.push(`${label}: ${code} has ${s.units} units, which is too many for auto-scheduling. Set it by hand.`);
      continue;
    }
    const sessions = s.units > 3 ? 2 : 1;
    used.add(code);
    groups.push({
      parts: [{ code, minutes: (s.units / sessions) * MIN_PER_UNIT }],
      sessions,
      priority: /^NSTP/i.test(code) ? 0 : /^PEED/i.test(code) ? 1 : 2,
    });
  }
  groups.sort((a, b) => a.priority - b.priority); // stable: keeps curriculum order within a priority

  for (const g of groups) {
    const minutes = g.parts.reduce((sum, p) => sum + p.minutes, 0);
    const options = g.sessions === 2 ? PAIR_OPTIONS : g.priority === 0 ? NSTP_OPTIONS : SINGLE_OPTIONS;
    const spot = place(options, minutes, occ);
    if (!spot) {
      warnings.push(`${label}: no free slot for ${g.parts.map((p) => p.code).join(" + ")}. Set its time by hand.`);
      continue;
    }
    let offset = 0;
    g.parts.forEach((p, idx) => {
      const start = spot.start + offset;
      const end = start + p.minutes;
      const kind: MeetingKind = g.parts.length === 2 && idx === 1 ? "lab" : kindOf(p.code, byCode.get(p.code)?.title);
      const ms = spot.days.map((day) => ({ day, start, end, kind }));
      assigned.set(p.code, ms);
      ms.forEach((m) => occ[m.day].push(m));
      offset += p.minutes;
    });
  }

  // Sanity check: report any overlap in this term, including ones involving hand-entered times
  const flat = t.codes.flatMap((c) => (assigned.get(c) ?? []).map((m) => ({ code: c, m })));
  const seen = new Set<string>();
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++) {
      const a = flat[i];
      const b = flat[j];
      if (a.code !== b.code && meetingsOverlap(a.m, b.m)) {
        const key = `${a.code}|${b.code}|${a.m.day}`;
        if (!seen.has(key)) {
          seen.add(key);
          warnings.push(`${label}: CONFLICT, ${a.code} and ${b.code} overlap on ${a.m.day}.`);
        }
      }
    }
}

/* ───────────── public API ───────────── */

/**
 * Returns the same subjects with `days` and `time` filled in wherever they were empty.
 *
 * `assigned` carries times between programs: subjects shared by several programs (CORE101,
 * CORE106, ...) live in one `subjects/{code}` doc, so they can only have one time. Pass the
 * same Map for every program you seed, and later programs will schedule around earlier ones.
 */
export function assignSchedules<T extends CatalogSubject>(
  subjects: T[],
  terms: TermEntry[],
  assigned: Map<string, Meeting[]> = new Map()
): { subjects: T[]; warnings: string[] } {
  const warnings: string[] = [];
  const byCode = new Map(subjects.map((s) => [s.code, s as CatalogSubject]));

  // Hand-entered schedules always win
  for (const s of subjects) {
    const m = parseMeetings(s.days, s.time, s.code, s.title);
    if (m.length && !assigned.has(s.code)) assigned.set(s.code, m);
  }

  for (const t of terms) scheduleTerm(t, byCode, assigned, warnings);

  const out = subjects.map((s) => {
    const ms = assigned.get(s.code);
    if (!ms || (s.days && s.time)) return s;
    return {
      ...s,
      days: DAYS.filter((d) => ms.some((m) => m.day === d)).join("/"),
      time: `${fmtSlot(ms[0].start)} - ${fmtSlot(ms[0].end)}`,
    };
  });

  return { subjects: out, warnings };
}