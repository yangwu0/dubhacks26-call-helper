export type FreeWindow = { start: string; end: string };

export type BusyInterval = { starts_at: string; ends_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const SLOT_MS = 30 * 60 * 1000;
const MAX_DAYS = 14;
const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 18 * 60;

type LocalDate = { year: number; month: number; day: number };

type ZonedParts = LocalDate & {
  hour: number;
  minute: number;
  weekday: string;
};

function partsInZone(date: Date, timeZone: string): ZonedParts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of formatted) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: map.weekday,
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = partsInZone(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
  );
  return asUtc - date.getTime();
}

export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    utc =
      Date.UTC(year, month - 1, day, hour, minute, 0) -
      zoneOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}

function formatLocal(date: Date, timeZone: string): string {
  const parts = partsInZone(date, timeZone);
  const offset = zoneOffsetMs(date, timeZone);
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  const hours = String(Math.floor(absolute / 3_600_000)).padStart(2, "0");
  const minutes = String(Math.floor((absolute % 3_600_000) / 60_000)).padStart(
    2,
    "0",
  );
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:00${sign}${hours}:${minutes}`;
}

export function localDate(value: string, timeZone: string): LocalDate {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return { year, month, day };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid date: ${value}`);
  }
  const parts = partsInZone(parsed, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function dateKey(date: LocalDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function overlaps(start: Date, end: Date, busy: BusyInterval[]): boolean {
  return busy.some((event) => {
    const eventStart = new Date(event.starts_at);
    const eventEnd = new Date(event.ends_at);
    return eventStart < end && eventEnd > start;
  });
}

export function freeWindows(input: {
  timeZone: string;
  dateFrom: string;
  dateTo: string;
  events: BusyInterval[];
}): FreeWindow[] {
  const timeZone = input.timeZone || "America/Los_Angeles";
  let cursor = localDate(input.dateFrom, timeZone);
  const last = localDate(input.dateTo, timeZone);
  const windows: FreeWindow[] = [];
  let days = 0;

  while (dateKey(cursor) <= dateKey(last) && days < MAX_DAYS) {
    days++;
    const noon = zonedLocalToUtc(
      cursor.year,
      cursor.month,
      cursor.day,
      12,
      0,
      timeZone,
    );
    const weekday = partsInZone(noon, timeZone).weekday;
    if (weekday !== "Sat" && weekday !== "Sun") {
      let slotStart = zonedLocalToUtc(
        cursor.year,
        cursor.month,
        cursor.day,
        9,
        0,
        timeZone,
      );
      const dayEnd = zonedLocalToUtc(
        cursor.year,
        cursor.month,
        cursor.day,
        18,
        0,
        timeZone,
      );
      let openStart: Date | null = null;
      let openEnd: Date | null = null;
      while (slotStart.getTime() + SLOT_MS <= dayEnd.getTime() + 1000) {
        const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
        if (slotEnd > dayEnd) break;
        if (overlaps(slotStart, slotEnd, input.events)) {
          if (openStart && openEnd) {
            windows.push({
              start: formatLocal(openStart, timeZone),
              end: formatLocal(openEnd, timeZone),
            });
          }
          openStart = null;
          openEnd = null;
        } else if (!openStart) {
          openStart = slotStart;
          openEnd = slotEnd;
        } else {
          openEnd = slotEnd;
        }
        slotStart = slotEnd;
      }
      if (openStart && openEnd) {
        windows.push({
          start: formatLocal(openStart, timeZone),
          end: formatLocal(openEnd, timeZone),
        });
      }
    }
    cursor = addDays(cursor, 1);
    if (days > MAX_DAYS) break;
  }

  return windows;
}

function minutes(parts: ZonedParts): number {
  return parts.hour * 60 + parts.minute;
}

export function withinOfficeHours(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): boolean {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  if (end <= start) return false;
  if (end.getTime() - start.getTime() > DAY_MS) return false;
  const startParts = partsInZone(start, timeZone);
  const endParts = partsInZone(end, timeZone);
  if (startParts.weekday === "Sat" || startParts.weekday === "Sun") return false;
  if (
    startParts.year !== endParts.year ||
    startParts.month !== endParts.month ||
    startParts.day !== endParts.day
  ) {
    return false;
  }
  return (
    minutes(startParts) >= OPEN_MINUTES && minutes(endParts) <= CLOSE_MINUTES
  );
}

export function slotIsFree(
  startsAt: string,
  endsAt: string,
  events: BusyInterval[],
): boolean {
  return !overlaps(new Date(startsAt), new Date(endsAt), events);
}
