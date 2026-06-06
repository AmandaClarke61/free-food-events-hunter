import { EventSourceName, RawEvent, School } from "@/lib/types";
import { stripHtml } from "@/lib/utils";

export interface WpEventRssSource {
  /** WordPress event-archive RSS feed URL (pubDate carries the EVENT date). */
  feedUrl: string;
  source: EventSourceName;
  school: School;
  /** Drop events further out than this many days (default 90). */
  windowDays?: number;
}

const PAST_GRACE_MS = 12 * 60 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Collector for WordPress event archives whose RSS feed re-purposes <pubDate>
 * as the event start time (e.g. Harvard Law School's `/calendar/feed/`).
 *
 * The feed is capped at WordPress's `posts_per_rss` (~10 nearest upcoming
 * events), but daily runs accumulate events into the DB as they roll into the
 * window, so coverage grows over time.
 */
export async function collectWpEventRss(cfg: WpEventRssSource): Promise<RawEvent[]> {
  const res = await fetch(cfg.feedUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`WP RSS ${cfg.source} returned ${res.status}`);

  const xml = await res.text();
  const events: RawEvent[] = [];

  const now = Date.now();
  const horizon = now + (cfg.windowDays ?? 90) * 24 * 60 * 60 * 1000;
  const floor = now - PAST_GRACE_MS;

  const items = xml.split("<item>").slice(1);
  for (const chunk of items) {
    const block = chunk.split("</item>")[0];

    const title = cleanText(getTag(block, "title"));
    if (!title) continue;

    const pub = getTag(block, "pubDate");
    if (!pub) continue;
    const startTime = new Date(pub);
    if (isNaN(startTime.getTime())) continue;

    const startMs = startTime.getTime();
    if (startMs < floor || startMs > horizon) continue;

    const link = getTag(block, "link") || undefined;
    const guid = getTag(block, "guid") || undefined;
    const rawDesc = getTag(block, "description");
    const description = rawDesc ? cleanText(rawDesc).slice(0, 2000) || undefined : undefined;
    const imageUrl = getTag(block, "image") || undefined;

    events.push({
      school: cfg.school,
      title,
      description,
      startTime,
      location: undefined,
      url: link,
      imageUrl,
      source: cfg.source,
      sourceId: guid,
    });
  }

  return events;
}

/** Harvard Law School — WordPress `event` post type, RSS at /calendar/feed/. */
export async function collectHarvardLaw(): Promise<RawEvent[]> {
  return collectWpEventRss({
    feedUrl: "https://hls.harvard.edu/calendar/feed/",
    source: "harvard-law",
    school: "harvard",
  });
}

/** Read a single-level RSS/XML tag value, unwrapping CDATA. */
function getTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return undefined;
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1].trim();
  return v || undefined;
}

/** Decode HTML entities, strip tags, collapse whitespace. */
function cleanText(s: string | undefined): string {
  if (!s) return "";
  const decoded = s
    .replace(/&amp;/gi, "&")
    .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
    .replace(/&quot;|&#0*34;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(parseInt(n, 16)));
  return stripHtml(decoded);
}

function safeCodePoint(n: number): string {
  try {
    return Number.isFinite(n) ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}
