import * as cheerio from "cheerio";
import { RawEvent } from "@/lib/types";
import { parseDateAsET } from "@/lib/utils";

const MEDIALAB_URL = "https://www.media.mit.edu/events/";

export async function collectMediaLab(): Promise<RawEvent[]> {
  const res = await fetch(MEDIALAB_URL);
  if (!res.ok) throw new Error(`Media Lab events returned ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];

  $("div.container-item.module").each((_, el) => {
    const card = $(el);

    const title = card.find("h2.module-title").text().trim();
    if (!title) return;

    const relUrl =
      card.attr("data-href") ||
      card.find("a.module-content-guard").attr("href");
    const url = relUrl ? `https://www.media.mit.edu${relUrl}` : undefined;

    // Date parsing
    const startDateText = card.find("div.event-start-date").text().trim();
    const endDateText = card.find("div.event-end-date").text().trim();
    const startTimeText = card
      .find("span.event-start-time")
      .text()
      .replace("—", "")
      .trim();
    const endTimeText = card
      .find("span.event-end-time")
      .contents()
      .first()
      .text()
      .trim();

    if (!startDateText) return;

    const startTime = parseMediaLabDate(startDateText, startTimeText);
    if (!startTime) return;

    const endTime = endDateText
      ? parseMediaLabDate(endDateText, endTimeText)
      : endTimeText
        ? parseMediaLabDate(startDateText, endTimeText)
        : undefined;

    // Description
    const description = card.find("div.module-excerpt p").text().trim() || undefined;

    // Image
    const styleAttr = card.find("div.module-head").attr("style") || "";
    const imgMatch = styleAttr.match(/url\(["']?([^"')]+)["']?\)/);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    events.push({
      title,
      description: description?.slice(0, 2000),
      startTime,
      endTime: endTime ?? undefined,
      url,
      imageUrl,
      source: "medialab",
      sourceId: relUrl ?? undefined,
    });
  });

  return events;
}

function parseMediaLabDate(
  dateStr: string,
  timeStr?: string
): Date | null {
  // dateStr: "March 19, 2026", timeStr: "4:00pm"
  let combined = dateStr;
  if (timeStr) {
    // Normalize time: "4:00pm" -> "4:00 PM"
    const normalized = timeStr
      .replace(/([ap])m/i, " $1M")
      .toUpperCase();
    combined += ` ${normalized}`;
  }
  return parseDateAsET(combined);
}
