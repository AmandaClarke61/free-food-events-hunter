import { EventSourceName, RawEvent, School } from "@/lib/types";
import { parseDateAsET, stripHtml } from "@/lib/utils";

export interface IcalSource {
  /** Public .ics feed URL (no auth). */
  icalUrl: string;
  /** Logical source name stored in DB (e.g. "harvard-gazette"). */
  source: EventSourceName;
  /** Which school these events belong to. */
  school: School;
  /** Only keep events starting within this many days from now (default 30). */
  windowDays?: number;
}

const PAST_GRACE_MS = 12 * 60 * 60 * 1000; // keep events that started up to 12h ago

/**
 * Generic iCal collector — works for any standard .ics feed (Trumba, WordPress
 * "The Events Calendar", etc.). Hand-rolled VEVENT parsing mirrors the proven
 * IDSS collector to keep timezone handling consistent across the project.
 */
export async function collectIcalFeed(cfg: IcalSource): Promise<RawEvent[]> {
  const res = await fetch(cfg.icalUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (campus-events-aggregator)" },
  });
  if (!res.ok) throw new Error(`iCal feed ${cfg.source} returned ${res.status}`);

  const text = await res.text();
  const events: RawEvent[] = [];

  const now = Date.now();
  const horizon = now + (cfg.windowDays ?? 30) * 24 * 60 * 60 * 1000;
  const floor = now - PAST_GRACE_MS;

  const veventBlocks = text.split("BEGIN:VEVENT").slice(1);

  for (const block of veventBlocks) {
    const raw = block.split("END:VEVENT")[0];

    const summary = getICalProp(raw, "SUMMARY");
    if (!summary || summary === "TBD") continue;

    const startTime = parseICalDate(raw, "DTSTART");
    if (!startTime) continue;

    // Window filter — drop past and far-future events (feeds like Gazette
    // can return hundreds of events spanning many months).
    const startMs = startTime.getTime();
    if (startMs < floor || startMs > horizon) continue;

    const endTime = parseICalDate(raw, "DTEND");
    const rawDescription = getICalProp(raw, "DESCRIPTION");
    const description = rawDescription
      ? cleanText(rawDescription).slice(0, 2000) || undefined
      : undefined;
    const url = getICalProp(raw, "URL");
    const location = getICalProp(raw, "LOCATION");
    const uid = getICalProp(raw, "UID");

    events.push({
      school: cfg.school,
      title: cleanText(summary),
      description,
      startTime,
      endTime: endTime ?? undefined,
      location: location ? cleanText(location) || undefined : undefined,
      url: url || undefined,
      source: cfg.source,
      sourceId: uid ?? undefined,
    });
  }

  return events;
}

// === Per-source adapters ===

/** Harvard Gazette — university-wide calendar federating events across all schools. */
export async function collectHarvardGazette(): Promise<RawEvent[]> {
  return collectIcalFeed({
    icalUrl: "https://www.trumba.com/calendars/gazette.ics",
    source: "harvard-gazette",
    school: "harvard",
  });
}

/** Harvard T.H. Chan School of Public Health. */
export async function collectHarvardHSPH(): Promise<RawEvent[]> {
  return collectIcalFeed({
    icalUrl: "https://hsph.harvard.edu/events/?ical=1",
    source: "harvard-hsph",
    school: "harvard",
  });
}

/** Harvard Divinity School. */
export async function collectHarvardHDS(): Promise<RawEvent[]> {
  return collectIcalFeed({
    icalUrl: "https://www.trumba.com/calendars/hds-public-events.ics",
    source: "harvard-hds",
    school: "harvard",
  });
}

/** Harvard Graduate School of Education. */
export async function collectHarvardHGSE(): Promise<RawEvent[]> {
  return collectIcalFeed({
    icalUrl:
      "https://www.trumba.com/calendars/harvard-graduate-school-of-education-public-events.ics",
    source: "harvard-hgse",
    school: "harvard",
  });
}

/** Decode common HTML entities (Trumba embeds these in SUMMARY/LOCATION). */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
    .replace(/&quot;|&#0*34;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(parseInt(n, 16)));
}

function safeCodePoint(n: number): string {
  try {
    return Number.isFinite(n) ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

/** Unescape iCal text escapes, decode HTML entities, strip tags, collapse whitespace. */
function cleanText(s: string): string {
  const unescaped = s
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
  return stripHtml(decodeEntities(unescaped));
}

/** Extract a property value from an iCal block, handling line folding. */
function getICalProp(block: string, prop: string): string | undefined {
  const regex = new RegExp(`^${prop}[;:](.*)`, "m");
  const match = block.match(regex);
  if (!match) return undefined;

  let value = match[1];

  // Handle line folding (continuation lines start with space/tab).
  const startIdx = block.indexOf(match[0]);
  const afterMatch = block.slice(startIdx + match[0].length);
  const foldedLines = afterMatch.match(/^[ \t].+/gm) || [];
  for (const line of foldedLines) {
    const lineStart = afterMatch.indexOf(line);
    const before = afterMatch.slice(0, lineStart);
    if (before.replace(/\r?\n/g, "") !== "") break;
    value += line.slice(1);
  }

  return value.trim() || undefined;
}

/** Parse DTSTART or DTEND from iCal, handling TZID, UTC (Z) and VALUE=DATE. */
function parseICalDate(block: string, prop: string): Date | null {
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith(prop)) continue;

    // VALUE=DATE (all-day): 20260410
    if (line.includes("VALUE=DATE")) {
      const dateStr = line.split(":")[1]?.trim();
      if (!dateStr) return null;
      return new Date(
        `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      );
    }

    // Date-time: ...:20260320T110000 (optionally trailing Z for UTC)
    const valueMatch = line.match(/:(\d{8}T\d{6})Z?$/);
    if (valueMatch) {
      const s = valueMatch[1];
      const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`;

      if (valueMatch[0].endsWith("Z")) {
        return new Date(iso + "Z");
      }
      // TZID=America/New_York or floating: treat as Eastern Time with DST.
      return parseDateAsET(iso);
    }
  }
  return null;
}
