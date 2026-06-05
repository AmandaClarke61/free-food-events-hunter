import { EventSourceName, RawEvent, School } from "@/lib/types";
import { stripHtml, safeDate } from "@/lib/utils";

interface LocalistEvent {
  event: {
    id: number;
    title: string;
    description_text?: string;
    description?: string;
    location_name?: string;
    url?: string;
    localist_url?: string;
    photo_url?: string;
    free?: boolean;
    event_instances: Array<{
      event_instance: {
        start: string;
        end?: string;
      };
    }>;
  };
}

export interface LocalistSource {
  /** Base URL up to and including `/api/2/events`. */
  apiUrl: string;
  /** Logical source name stored in DB (e.g. "localist", "harvard-hbs"). */
  source: EventSourceName;
  /** Which school these events belong to. */
  school: School;
}

/** Generic Localist collector — works for any Localist-powered calendar. */
export async function collectLocalistFeed(cfg: LocalistSource): Promise<RawEvent[]> {
  const events: RawEvent[] = [];
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    const url = `${cfg.apiUrl}?days=14&pp=50&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Localist API ${cfg.source} returned ${res.status}`);

    const data = await res.json();
    const items: LocalistEvent[] = data.events ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const e = item.event;
      const instances = e.event_instances ?? [];
      if (instances.length === 0) continue;

      const baseUrl = e.localist_url || e.url || undefined;
      const description = e.description_text || (e.description ? stripHtml(e.description) : undefined);

      for (let idx = 0; idx < instances.length; idx++) {
        const instance = instances[idx].event_instance;
        const startTime = safeDate(instance?.start);
        if (!startTime) continue;

        events.push({
          school: cfg.school,
          title: e.title,
          description,
          startTime,
          endTime: safeDate(instance?.end) ?? undefined,
          location: e.location_name ?? undefined,
          url: baseUrl,
          imageUrl: e.photo_url ?? undefined,
          source: cfg.source,
          sourceId: `${e.id}-${idx}`,
          rawData: e as unknown as Record<string, unknown>,
        });
      }
    }

    page++;
  }

  return events;
}

// === Per-school adapters ===

/** MIT main calendar (legacy entry point, kept for backward compat). */
export async function collectLocalist(): Promise<RawEvent[]> {
  return collectLocalistFeed({
    apiUrl: "https://calendar.mit.edu/api/2/events",
    source: "localist",
    school: "mit",
  });
}

/** Harvard College central calendar — federates many FAS / department events. */
export async function collectHarvardCollege(): Promise<RawEvent[]> {
  return collectLocalistFeed({
    apiUrl: "https://calendar.college.harvard.edu/api/2/events",
    source: "harvard-college",
    school: "harvard",
  });
}

/** Harvard Business School. */
export async function collectHarvardHBS(): Promise<RawEvent[]> {
  return collectLocalistFeed({
    apiUrl: "https://events.hbs.edu/api/2/events",
    source: "harvard-hbs",
    school: "harvard",
  });
}

/** Harvard SEAS (Engineering) — also federates GSD events. */
export async function collectHarvardSEAS(): Promise<RawEvent[]> {
  return collectLocalistFeed({
    apiUrl: "https://events.seas.harvard.edu/api/2/events",
    source: "harvard-seas",
    school: "harvard",
  });
}
