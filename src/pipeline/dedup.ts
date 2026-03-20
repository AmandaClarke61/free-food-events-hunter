import { ClassifiedEvent } from "@/lib/types";

/** Deduplicate events by fingerprint, merging sources */
export function dedup(events: ClassifiedEvent[]): ClassifiedEvent[] {
  const seen = new Map<string, ClassifiedEvent>();

  for (const event of events) {
    const existing = seen.get(event.fingerprint);
    if (!existing) {
      seen.set(event.fingerprint, event);
    } else {
      // Keep the version with more data (longer description, higher confidence)
      if (
        (event.description?.length ?? 0) > (existing.description?.length ?? 0)
      ) {
        existing.description = event.description;
      }
      if (event.foodConfidence > existing.foodConfidence) {
        existing.hasFreeFood = event.hasFreeFood;
        existing.foodConfidence = event.foodConfidence;
        existing.foodDetails = event.foodDetails || existing.foodDetails;
      }
      if (!existing.location && event.location) {
        existing.location = event.location;
      }
      if (!existing.imageUrl && event.imageUrl) {
        existing.imageUrl = event.imageUrl;
      }
    }
  }

  return Array.from(seen.values());
}
