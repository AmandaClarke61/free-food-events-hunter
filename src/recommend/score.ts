/** Simple weighted scoring for event recommendations (Phase 2 foundation) */

interface ScoringInput {
  hasFreeFood: boolean;
  foodConfidence: number;
  topics: string[];
  startTime: Date;
}

interface UserPreferences {
  interests: string[];
  prefersFreeFood: boolean;
}

export function scoreEvent(
  event: ScoringInput,
  prefs: UserPreferences
): number {
  let score = 0;

  // Free food bonus
  if (event.hasFreeFood && prefs.prefersFreeFood) {
    score += 30 * event.foodConfidence;
  }

  // Topic match
  const topicOverlap = event.topics.filter((t) =>
    prefs.interests.includes(t)
  ).length;
  score += topicOverlap * 20;

  // Recency bonus: events sooner get a boost (max 20 points)
  const hoursAway =
    (event.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursAway > 0 && hoursAway < 48) {
    score += Math.max(0, 20 - hoursAway * 0.4);
  }

  return Math.round(score);
}
