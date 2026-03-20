import { RawEvent, ClassifiedEvent } from "@/lib/types";
import { makeFingerprint } from "@/lib/utils";
import { detectFreeFoodByRules } from "@/classify/rules";
import { classifyWithLLM, extractTopicsByRules } from "@/classify/llm";

/** Normalize raw events: classify free food, extract topics, generate fingerprints */
export async function normalizeAndClassify(
  rawEvents: RawEvent[]
): Promise<ClassifiedEvent[]> {
  const classified: ClassifiedEvent[] = [];
  const ambiguous: { index: number; event: RawEvent }[] = [];

  // First pass: rule-based classification
  for (const event of rawEvents) {
    const ruleResult = detectFreeFoodByRules(event.title, event.description);
    const topics = extractTopicsByRules(event.title, event.description);

    const ce: ClassifiedEvent = {
      ...event,
      hasFreeFood: event.freeFoodHint || ruleResult.hasFreeFood,
      foodConfidence: event.freeFoodHint
        ? Math.max(0.9, ruleResult.confidence)
        : ruleResult.confidence,
      foodDetails: ruleResult.foodDetails,
      topics,
      fingerprint: makeFingerprint(event.title, event.startTime),
    };

    classified.push(ce);

    if (ruleResult.isAmbiguous && !event.freeFoodHint) {
      ambiguous.push({ index: classified.length - 1, event });
    }
  }

  // Second pass: LLM for ambiguous events
  if (ambiguous.length > 0) {
    const llmResults = await classifyWithLLM(
      ambiguous.map((a) => ({
        title: a.event.title,
        description: a.event.description,
        location: a.event.location,
      }))
    );

    for (let i = 0; i < ambiguous.length; i++) {
      const idx = ambiguous[i].index;
      const llm = llmResults[i];
      classified[idx].hasFreeFood = llm.hasFreeFood;
      classified[idx].foodConfidence = llm.confidence;
      classified[idx].foodDetails = llm.foodDetails;
      if (llm.topics.length > 0) {
        classified[idx].topics = llm.topics;
      }
    }
  }

  return classified;
}
