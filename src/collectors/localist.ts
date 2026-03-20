import { RawEvent } from "@/lib/types";
import { stripHtml, safeDate } from "@/lib/utils";

const BASE_URL = "https://calendar.mit.edu/api/2/events";

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

export async function collectLocalist(): Promise<RawEvent[]> {
  const events: RawEvent[] = [];
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    const url = `${BASE_URL}?days=14&pp=50&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Localist API returned ${res.status}`);

    const data = await res.json();
    const items: LocalistEvent[] = data.events ?? [];

    if (items.length === 0) break;

    for (const item of items) {
      const e = item.event;
      const instances = e.event_instances ?? [];
      if (instances.length === 0) continue;

      const baseUrl = e.localist_url || e.url || undefined;
      const description = e.description_text || (e.description ? stripHtml(e.description) : undefined);

      // Expand each instance into a separate event so recurring events get individual dates
      for (let idx = 0; idx < instances.length; idx++) {
        const instance = instances[idx].event_instance;
        const startTime = safeDate(instance?.start);
        if (!startTime) continue;

        events.push({
          title: e.title,
          description,
          startTime,
          endTime: safeDate(instance?.end) ?? undefined,
          location: e.location_name ?? undefined,
          url: baseUrl,
          imageUrl: e.photo_url ?? undefined,
          source: "localist",
          sourceId: `${e.id}-${idx}`,
          rawData: e as unknown as Record<string, unknown>,
        });
      }
    }

    page++;
  }

  return events;
}
