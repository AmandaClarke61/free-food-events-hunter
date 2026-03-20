import * as cheerio from "cheerio";
import { RawEvent } from "@/lib/types";
import { parseDateAsET } from "@/lib/utils";

const BCS_URL = "https://bcs.mit.edu/events";
const BCS_BASE = "https://bcs.mit.edu";

export async function collectBCS(): Promise<RawEvent[]> {
  const res = await fetch(BCS_URL);
  if (!res.ok) throw new Error(`BCS events returned ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];

  $(".view-content .views-row").each((_, el) => {
    const row = $(el);

    // Title and URL from h4.faux-full-title > a
    const titleLink = row.find("h4.faux-full-title a");
    const title = titleLink.text().trim();
    if (!title) return;

    const relUrl = titleLink.attr("href");
    const url = relUrl ? `${BCS_BASE}${relUrl}` : undefined;

    // Dates from <time datetime="..."> elements
    // BCS Drupal puts local ET times with a misleading "Z" suffix,
    // so strip the Z and treat as America/New_York
    const timeEls = row.find(".field--name-field-event-date time.datetime");
    const startAttr = timeEls.eq(0).attr("datetime")?.replace(/Z$/i, "");
    if (!startAttr) return;

    const startTime = parseDateAsET(startAttr);
    if (!startTime) return;

    const endAttr = timeEls.eq(1).attr("datetime")?.replace(/Z$/i, "");
    const endTime = endAttr ? parseDateAsET(endAttr) ?? undefined : undefined;

    // Location from add-to-calendar var.atc_location
    const location =
      row.find("var.atc_location").text().trim() || undefined;

    // Organization
    const org =
      row.find(".field--name-field-organization").text().trim() || undefined;

    events.push({
      title,
      description: org,
      startTime,
      endTime: endTime ?? undefined,
      location,
      url,
      source: "bcs",
      sourceId: relUrl ?? undefined,
    });
  });

  return events;
}
