import { RawEvent } from "@/lib/types";
import { parseDateAsET } from "@/lib/utils";

/**
 * Generic CampusGroups collector — works for both engage.mit.edu and sloangroups.mit.edu
 * since they use the same mobile_ws/v17 API with positional fields (p0, p1, ...).
 *
 * Key mappings:
 *   p1 = eventId, p3 = eventName, p4 = dates HTML, p5 = category,
 *   p6 = location, p11 = imagePath, p18 = eventUrl
 */

interface CGItem {
  listingSeparator?: string | null;
  p1?: string;
  p3?: string;
  p4?: string;
  p6?: string;
  p11?: string;
  p18?: string;
  [key: string]: unknown;
}

interface CGSiteConfig {
  baseUrl: string;
  siteOrigin: string;
  sourceName: "campusgroups" | "sloangroups";
  /** Detail page path template — if set, we scrape detail pages to detect food */
  detailPathTemplate?: string;
}

const SITES: CGSiteConfig[] = [
  {
    baseUrl: "https://engage.mit.edu/mobile_ws/v17/mobile_events_list",
    siteOrigin: "https://engage.mit.edu",
    sourceName: "campusgroups",
  },
  {
    baseUrl: "https://sloangroups.mit.edu/mobile_ws/v17/mobile_events_list",
    siteOrigin: "https://sloangroups.mit.edu",
    sourceName: "sloangroups",
    detailPathTemplate: "/peopleandorganizations/rsvp_boot?id={id}",
  },
];

async function collectFromSite(site: CGSiteConfig): Promise<RawEvent[]> {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    range: "0",
    limit: "100",
    filter4_contains: "OR",
    filter4_notcontains: "OR",
    order: "undefined",
    search_word: "",
    startDate: formatDate(now),
    endDate: formatDate(twoWeeksLater),
  });

  const res = await fetch(`${site.baseUrl}?${params}`);
  if (!res.ok)
    throw new Error(`${site.sourceName} API returned ${res.status}`);

  const items: CGItem[] = await res.json();
  const events: RawEvent[] = [];

  for (const item of items) {
    if (item.listingSeparator === "true") continue;

    const title = item.p3;
    if (!title) continue;

    const dateText = stripHtmlTags(item.p4 ?? "");
    const startTime = parseDateFromText(dateText);
    if (!startTime) continue;

    const parts = dateText.split(/\s*[–-]\s*/);
    const endTime =
      parts.length > 1 ? parseDateFromText(parts[1]) : undefined;

    const location = stripHtmlTags(item.p6 ?? "");
    const eventId = item.p1;
    const eventUrl = item.p18
      ? `${site.siteOrigin}${item.p18}`
      : undefined;
    const imageUrl = item.p11 ?? undefined;

    events.push({
      title,
      startTime,
      endTime: endTime ?? undefined,
      location: location || undefined,
      url: eventUrl,
      imageUrl: imageUrl
        ? imageUrl.startsWith("http")
          ? imageUrl
          : `${site.siteOrigin}${imageUrl}`
        : undefined,
      source: site.sourceName,
      sourceId: eventId ?? undefined,
    });
  }

  // If this site has detail pages with food info, scrape them
  if (site.detailPathTemplate) {
    await enrichWithFoodInfo(events, site);
  }

  return events;
}

/**
 * Scrape detail pages to detect the "Food Provided" field (mdi-food icon).
 * Uses concurrency of 5 to avoid hammering the server.
 */
async function enrichWithFoodInfo(
  events: RawEvent[],
  site: CGSiteConfig
): Promise<void> {
  const CONCURRENCY = 5;

  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (event) => {
        if (!event.sourceId || !site.detailPathTemplate) return;
        try {
          const detailPath = site.detailPathTemplate.replace(
            "{id}",
            event.sourceId
          );
          const res = await fetch(`${site.siteOrigin}${detailPath}`);
          if (!res.ok) return;
          const html = await res.text();

          // The detail page has <!-- Food Provided --> + mdi-food icon when food is offered
          if (html.includes("mdi-food")) {
            event.freeFoodHint = true;
          }

          // Also try to extract description from detail page if we don't have one
          if (!event.description) {
            const descMatch = html.match(
              /<!-- Event Description -->([\s\S]*?)(?:<!-- Event|<\/div>\s*<\/div>\s*<\/div>)/
            );
            if (descMatch) {
              const text = descMatch[1]
                .replace(/<[^>]*>/g, " ")
                .replace(/&\w+;/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              if (text.length > 20) {
                event.description = text.slice(0, 2000);
              }
            }
          }
        } catch {
          // Silently skip failed detail page fetches
        }
      })
    );
  }
}

export async function collectCampusGroups(): Promise<RawEvent[]> {
  return collectFromSite(SITES[0]);
}

export async function collectSloanGroups(): Promise<RawEvent[]> {
  return collectFromSite(SITES[1]);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateFromText(text: string): Date | null {
  const cleaned = text.replace(/&ndash;/g, "-").trim();

  // Try to extract "Day, Month DD, YYYY HH:MM AM/PM" or "Month DD, YYYY HH AM/PM"
  // parseDateAsET handles this pattern natively
  const parsed = parseDateAsET(cleaned);
  if (parsed) return parsed;

  // If direct parse fails (e.g., text has extra content like "– 12:30 PM"),
  // try to extract just the start date+time portion
  const match = cleaned.match(
    /(\w{3,},?\s+)?(\w{3,}\s+\d{1,2},?\s+\d{4})(?:\s+(\d{1,2}(?::\d{2})?\s*[AP]M?))?/i
  );
  if (match) {
    const dateWithTime = match[3] ? `${match[2]} ${match[3]}` : match[2];
    return parseDateAsET(dateWithTime);
  }

  return null;
}
