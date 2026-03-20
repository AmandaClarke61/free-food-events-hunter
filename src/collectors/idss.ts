import { RawEvent } from "@/lib/types";
import { parseDateAsET } from "@/lib/utils";

const ICAL_URL = "https://idss.mit.edu/calendar/?ical=1";

export async function collectIDSS(): Promise<RawEvent[]> {
  const res = await fetch(ICAL_URL);
  if (!res.ok) throw new Error(`IDSS iCal feed returned ${res.status}`);

  const text = await res.text();
  const events: RawEvent[] = [];

  // Parse VEVENT blocks manually (avoids ical.js complexity with timezones)
  const veventBlocks = text.split("BEGIN:VEVENT").slice(1);

  for (const block of veventBlocks) {
    const raw = block.split("END:VEVENT")[0];

    const summary = getICalProp(raw, "SUMMARY");
    if (!summary || summary === "TBD") continue;

    const startTime = parseICalDate(raw, "DTSTART");
    if (!startTime) continue;

    const endTime = parseICalDate(raw, "DTEND");
    const description = getICalProp(raw, "DESCRIPTION")
      ?.replace(/\\n/g, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\\\/g, "\\")
      .slice(0, 2000);
    const url = getICalProp(raw, "URL");
    const location = getICalProp(raw, "LOCATION")?.replace(/\\,/g, ",");
    const uid = getICalProp(raw, "UID");

    events.push({
      title: summary.replace(/\\,/g, ","),
      description: description || undefined,
      startTime,
      endTime: endTime ?? undefined,
      location: location || undefined,
      url: url || undefined,
      source: "idss",
      sourceId: uid ?? undefined,
    });
  }

  return events;
}

/** Extract a property value from an iCal block, handling line folding */
function getICalProp(block: string, prop: string): string | undefined {
  // iCal properties can be like PROP:value or PROP;PARAM=x:value
  const regex = new RegExp(`^${prop}[;:](.*)`, "m");
  const match = block.match(regex);
  if (!match) return undefined;

  // Handle the property parameters (e.g., DTSTART;TZID=...:value)
  let value = match[1];
  if (value.includes(":") && !prop.startsWith("DT")) {
    // For non-date props with params, take everything after the last ':'
  }

  // Handle line folding (continuation lines start with space/tab)
  const startIdx = block.indexOf(match[0]);
  const afterMatch = block.slice(startIdx + match[0].length);
  const foldedLines = afterMatch.match(/^[ \t].+/gm) || [];
  for (const line of foldedLines) {
    // Check that this folded line immediately follows
    const lineStart = afterMatch.indexOf(line);
    const before = afterMatch.slice(0, lineStart);
    if (before.replace(/\r?\n/g, "") !== "") break;
    value += line.slice(1); // Remove leading space
  }

  return value.trim() || undefined;
}

/** Parse DTSTART or DTEND from iCal, handling TZID and VALUE=DATE */
function parseICalDate(block: string, prop: string): Date | null {
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith(prop)) continue;

    // VALUE=DATE format: 20260410
    if (line.includes("VALUE=DATE")) {
      const dateStr = line.split(":")[1]?.trim();
      if (!dateStr) return null;
      return new Date(
        `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      );
    }

    // TZID format: DTSTART;TZID=America/New_York:20260320T110000
    const valueMatch = line.match(/:(\d{8}T\d{6})Z?$/);
    if (valueMatch) {
      const s = valueMatch[1];
      const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`;

      if (valueMatch[0].endsWith("Z")) {
        return new Date(iso + "Z");
      }
      // TZID=America/New_York or default: treat as ET with DST awareness
      return parseDateAsET(iso);
    }
  }
  return null;
}
