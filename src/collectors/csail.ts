import * as cheerio from "cheerio";
import { RawEvent } from "@/lib/types";
import { parseDateAsET } from "@/lib/utils";

const CSAIL_URL = "https://www.csail.mit.edu/events";

export async function collectCSAIL(): Promise<RawEvent[]> {
  const res = await fetch(CSAIL_URL);
  if (!res.ok) throw new Error(`CSAIL events returned ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];

  $("article .event-card.card-container").each((_, el) => {
    const card = $(el);

    // Title and URL
    const titleLink = card.find("a.title-link");
    const title = titleLink.find("span.field--name-title").text().trim();
    if (!title) return;

    const relUrl = titleLink.attr("href");
    const url = relUrl ? `https://www.csail.mit.edu${relUrl}` : undefined;

    // Machine-readable dates from add-to-calendar widget
    const atcEvent = card.find("var.atc_event");
    const startStr = atcEvent.find("var.atc_date_start").text().trim();
    const endStr = atcEvent.find("var.atc_date_end").text().trim();
    if (!startStr) return;
    const startTime = parseDateAsET(startStr);
    if (!startTime) return;
    const endTime = endStr ? parseDateAsET(endStr) ?? undefined : undefined;

    // Description from atc_description
    const description = atcEvent.find("var.atc_description").text().trim() || undefined;

    // Location
    const location =
      card.find("div.location a.room-popup").text().trim() ||
      card.find("div.location span.room").text().trim() ||
      atcEvent.find("var.atc_location").text().trim() ||
      undefined;

    // Speaker info
    const speaker = card.find("div.field--name-field-speaker-name").text().trim();
    const affiliation = card.find("div.field--name-field-speaker-affiliation").text().trim();
    const speakerInfo = [speaker, affiliation].filter(Boolean).join(", ");

    const fullDescription = speakerInfo
      ? `${speakerInfo}\n\n${description ?? ""}`
      : description;

    events.push({
      title,
      description: fullDescription?.slice(0, 2000),
      startTime,
      endTime,
      location,
      url,
      source: "csail",
      sourceId: relUrl ?? undefined,
    });
  });

  return events;
}

