import crypto from "crypto";

/** Create a dedup fingerprint from title + start date */
export function makeFingerprint(title: string, startTime: Date): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 80);
  const dateStr = startTime.toISOString().slice(0, 10); // YYYY-MM-DD
  return crypto
    .createHash("sha256")
    .update(`${normalized}|${dateStr}`)
    .digest("hex")
    .slice(0, 16);
}

/** Strip HTML tags from a string */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Safely parse a date, returning null on failure */
export function safeDate(input: unknown): Date | null {
  if (!input) return null;
  const d = new Date(input as string);
  return isNaN(d.getTime()) ? null : d;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * Parse a date string that represents Eastern Time and return a proper UTC Date.
 * Handles EDT (UTC-4, Mar–Nov) vs EST (UTC-5, Nov–Mar) based on the date itself.
 *
 * Supports formats:
 *   - ISO: "2026-03-19", "2026-03-19T11:00:00"
 *   - US text: "March 19, 2026", "Mar 20, 2026 3:00 PM", "Mar 20, 2026 11 AM"
 *   - With day-of-week prefix: "Fri, Mar 20, 2026 11 AM"
 *
 * All are interpreted as America/New_York with proper DST handling.
 */
export function parseDateAsET(dateStr: string): Date | null {
  const s = dateStr.trim();
  let year: number, month: number, day: number;
  let hours = 0, minutes = 0, seconds = 0;

  // Try ISO format: "2026-03-19" or "2026-03-19T11:00:00"
  const isoMatch = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (isoMatch) {
    year = parseInt(isoMatch[1]);
    month = parseInt(isoMatch[2]) - 1;
    day = parseInt(isoMatch[3]);
    if (isoMatch[4]) hours = parseInt(isoMatch[4]);
    if (isoMatch[5]) minutes = parseInt(isoMatch[5]);
    if (isoMatch[6]) seconds = parseInt(isoMatch[6]);
  } else {
    // Try US text format: optional "Day, " prefix, then "Month DD, YYYY" with optional time
    const textMatch = s.match(
      /(?:\w{3,},?\s+)?(\w{3,})\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?\s*([AP]M?))?/i
    );
    if (!textMatch) return null;

    const monthName = textMatch[1].toLowerCase();
    month = MONTH_MAP[monthName];
    if (month === undefined) return null;
    day = parseInt(textMatch[2]);
    year = parseInt(textMatch[3]);

    if (textMatch[4]) {
      hours = parseInt(textMatch[4]);
      minutes = textMatch[5] ? parseInt(textMatch[5]) : 0;
      const ampm = (textMatch[6] || "").toUpperCase();
      if (ampm.startsWith("P") && hours < 12) hours += 12;
      if (ampm.startsWith("A") && hours === 12) hours = 0;
    }
  }

  // Determine if this date falls in EDT or EST
  const isDST = isEasternDST(year, month, day, hours);
  const offsetHours = isDST ? 4 : 5;

  // Construct UTC date by adding the ET→UTC offset
  const utc = new Date(
    Date.UTC(year, month, day, hours + offsetHours, minutes, seconds)
  );
  return isNaN(utc.getTime()) ? null : utc;
}

/** Check if a given date/time falls within Eastern Daylight Time */
function isEasternDST(
  year: number,
  month: number,
  day: number,
  hour: number
): boolean {
  // DST starts: second Sunday of March at 2:00 AM
  // DST ends: first Sunday of November at 2:00 AM
  const marchFirst = new Date(year, 2, 1);
  const dstStart = 14 - marchFirst.getDay(); // second Sunday
  const novFirst = new Date(year, 10, 1);
  const dstEnd = novFirst.getDay() === 0 ? 1 : 8 - novFirst.getDay(); // first Sunday

  if (month > 2 && month < 10) return true; // Apr–Oct always DST
  if (month < 2 || month > 10) return false; // Jan–Feb, Dec always EST
  if (month === 2) {
    // March
    if (day > dstStart) return true;
    if (day === dstStart) return hour >= 2;
    return false;
  }
  // month === 10, November
  if (day < dstEnd) return true;
  if (day === dstEnd) return hour < 2;
  return false;
}
