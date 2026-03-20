import * as cheerio from "cheerio";
import { RawEvent } from "@/lib/types";

const ANNO_URL = "https://gsc.mit.edu/about/anno/current-anno/";

/**
 * Scrape the GSC weekly ANNO (announcements newsletter).
 * Updated every Monday at 9am ET.
 *
 * Each event has a Google Calendar link with structured data:
 *   dates=START/END, details=DESC, location=LOC
 * And the TOC groups events by category including "Free Food".
 */
export async function collectGSC(): Promise<RawEvent[]> {
  const res = await fetch(ANNO_URL);
  if (!res.ok) throw new Error(`GSC ANNO returned ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // 1) Build set of Free Food event IDs from the TOC
  const freeFoodIds = new Set<string>();
  const ffHeader = $('h4 a[href="#anno-Free Food"], h4 a').filter((_, el) =>
    $(el).text().trim() === "Free Food"
  );
  if (ffHeader.length > 0) {
    const ffSection = ffHeader.closest("h4");
    // The list follows the h4 — get the next <table> which is the two-column list
    const listTable = ffSection.next("table");
    listTable.find("a[href^='#anno-']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const id = href.replace("#anno-", "");
      if (id) freeFoodIds.add(id);
    });
  }

  // 2) Parse each event from anchor targets
  const events: RawEvent[] = [];

  $('a[name^="anno-"]').each((_, el) => {
    const anchor = $(el);
    const id = (anchor.attr("name") ?? "").replace("anno-", "");
    const title = decodeEntities(anchor.text().trim());
    if (!title || !id) return;

    // Find the enclosing event block — walk up to find the wrapping table
    const eventBlock = anchor.closest("table").parent().closest("table").parent();

    // Extract Google Calendar link for structured data
    const gcalLink = eventBlock.find('a[href*="google.com/calendar"]').attr("href") ?? "";
    const gcalParams = parseGCalParams(gcalLink);

    if (!gcalParams.dates) return;

    const { start, end } = parseGCalDates(gcalParams.dates);
    if (!start) return;

    const description = gcalParams.details
      ? decodeURIComponentSafe(gcalParams.details).slice(0, 2000)
      : undefined;
    const location = gcalParams.location
      ? decodeURIComponentSafe(gcalParams.location)
      : undefined;

    // Check for a link in the event body (not the gcal link)
    const bodyLinks = eventBlock.find('a[href^="http"]').not('a[href*="google.com/calendar"]').not('a[href="#"]');
    const eventUrl = bodyLinks.first().attr("href") ?? undefined;

    const isFreeFood = freeFoodIds.has(id);

    events.push({
      title,
      description,
      startTime: start,
      endTime: end ?? undefined,
      location,
      url: eventUrl,
      source: "gsc",
      sourceId: `anno-${id}`,
      freeFoodHint: isFreeFood,
    });
  });

  return events;
}

function parseGCalParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const qIdx = url.indexOf("?");
  if (qIdx < 0) return params;

  const query = url.slice(qIdx + 1).replace(/&amp;/g, "&");
  for (const pair of query.split("&")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const key = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);
    params[key] = value;
  }
  return params;
}

function parseGCalDates(dates: string): { start: Date | null; end: Date | null } {
  // Format: 20260319T233000Z/20260320T020000Z  or  20260223/20260224
  const parts = dates.split("/");
  return {
    start: parseCompactDate(parts[0]),
    end: parts[1] ? parseCompactDate(parts[1]) : null,
  };
}

function parseCompactDate(s: string): Date | null {
  // 20260319T233000Z or 20260319
  if (s.length === 8) {
    // All-day: YYYYMMDD
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  }
  if (s.length >= 15) {
    // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`;
    return new Date(s.endsWith("Z") ? iso + "Z" : iso);
  }
  return null;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s.replace(/\+/g, " ");
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}
