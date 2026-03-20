import * as cheerio from "cheerio";
import { RawEvent } from "@/lib/types";
import { parseDateAsET } from "@/lib/utils";

const BASE_URL = "https://mitsloan.mit.edu/events";
const MAX_PAGES = 6;

export async function collectMITSloan(): Promise<RawEvent[]> {
  const events: RawEvent[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = page === 0 ? BASE_URL : `${BASE_URL}?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (page === 0) throw new Error(`MIT Sloan events returned ${res.status}`);
      break; // No more pages
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const articles = $("article.search-result--event");

    if (articles.length === 0) break;

    articles.each((_, el) => {
      const article = $(el);

      const title = article
        .find("h3.search-result--title a.search-result--title_link")
        .text()
        .trim();
      if (!title) return;

      const rawHref =
        article
          .find("a.search-result--title_link")
          .attr("href") || undefined;
      const eventUrl = rawHref
        ? rawHref.startsWith("http") ? rawHref : `https://mitsloan.mit.edu${rawHref}`
        : undefined;

      // Dates from <time datetime="...">
      // MIT Sloan uses date-only strings like "2026-02-23" which
      // new Date() parses as UTC midnight — use parseDateAsET instead
      const timeElements = article.find("time[datetime]");
      const startDateStr = timeElements.first().attr("datetime");
      if (!startDateStr) return;

      const startTime = parseDateAsET(startDateStr);
      if (!startTime) return;

      let endTime: Date | undefined;
      if (timeElements.length > 1) {
        const endDateStr = timeElements.eq(1).attr("datetime");
        if (endDateStr) {
          endTime = parseDateAsET(endDateStr) ?? undefined;
        }
      }

      // Category
      const category = article
        .find("span.search-result--eyebrow")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      // Description
      const description = article
        .find("p.search-result--description")
        .text()
        .trim();

      const fullDescription = category
        ? `[${category}] ${description}`
        : description;

      events.push({
        title,
        description: fullDescription?.slice(0, 2000) || undefined,
        startTime,
        endTime,
        url: eventUrl,
        source: "mitsloan",
        sourceId: eventUrl ?? `sloan-${title.slice(0, 30)}`,
      });
    });
  }

  return events;
}
