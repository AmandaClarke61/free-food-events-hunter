export interface ScoringEvent {
  hasFreeFood: boolean;
  foodConfidence: number;
  topics: string[];
  startTime: Date;
}

export interface UserPreferences {
  explicitInterests: string[];
  implicitInterests: Record<string, number>;
}

export function scoreEvent(
  event: ScoringEvent,
  prefs: UserPreferences
): number {
  let score = 0;

  // Explicit interest match: +25 per matching topic
  for (const topic of event.topics) {
    if (prefs.explicitInterests.includes(topic)) {
      score += 25;
    }
  }

  // Implicit interest match: +5 * bookmark count per topic (cap 15)
  for (const topic of event.topics) {
    const count = prefs.implicitInterests[topic];
    if (count) {
      score += Math.min(count * 5, 15);
    }
  }

  // Free food bonus: +30 * confidence (unconditional)
  if (event.hasFreeFood) {
    score += 30 * event.foodConfidence;
  }

  // Time proximity: up to +20 within 48h
  const hoursAway =
    (event.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursAway > 0 && hoursAway < 48) {
    score += Math.max(0, 20 - hoursAway * 0.4);
  }

  return Math.round(score);
}
