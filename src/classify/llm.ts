import OpenAI from "openai";

const openai = new OpenAI();

interface LLMClassification {
  hasFreeFood: boolean;
  confidence: number;
  foodDetails?: string;
  topics: string[];
}

interface EventInput {
  title: string;
  description?: string;
  location?: string;
}

/**
 * Batch-classify events using gpt-4o-mini.
 * Batches up to 15 events per call for efficiency.
 */
export async function classifyWithLLM(
  events: EventInput[]
): Promise<LLMClassification[]> {
  if (events.length === 0) return [];
  if (!process.env.OPENAI_API_KEY) {
    // Return neutral results if no API key configured
    return events.map(() => ({
      hasFreeFood: false,
      confidence: 0.5,
      topics: [],
    }));
  }

  const eventList = events
    .map(
      (e, i) =>
        `[${i}] Title: ${e.title}\nDescription: ${(e.description ?? "").slice(0, 300)}\nLocation: ${e.location ?? "N/A"}`
    )
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You analyze MIT campus events. For each event, determine:
1. Whether free food is available (hasFreeFood: boolean)
2. Confidence level 0-1 (foodConfidence: number)
3. Food details if applicable (foodDetails: string or null)
4. 1-3 topic tags from: [academics, social, career, research, workshop, sports, arts, health, diversity, technology, entrepreneurship, community, seminar, networking] (topics: string[])

Respond with JSON: {"results": [{"hasFreeFood": bool, "confidence": float, "foodDetails": str|null, "topics": [str]}]}`,
      },
      {
        role: "user",
        content: `Classify these ${events.length} events:\n\n${eventList}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return events.map(() => ({
      hasFreeFood: false,
      confidence: 0.5,
      topics: [],
    }));
  }

  const parsed = JSON.parse(content) as {
    results: Array<{
      hasFreeFood: boolean;
      confidence: number;
      foodDetails?: string | null;
      topics: string[];
    }>;
  };

  return parsed.results.map((r) => ({
    hasFreeFood: r.hasFreeFood,
    confidence: r.confidence,
    foodDetails: r.foodDetails ?? undefined,
    topics: r.topics ?? [],
  }));
}

/** Extract topics using simple keyword matching (no LLM needed) */
export function extractTopicsByRules(title: string, description?: string): string[] {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const topics: string[] = [];

  const topicPatterns: Record<string, RegExp> = {
    academics: /\b(lecture|class|course|seminar|thesis|dissertation|academic)\b/,
    career: /\b(career|job|intern|recruit|hiring|resume|interview|employer)\b/,
    research: /\b(research|paper|study|lab|poster|phd|thesis)\b/,
    workshop: /\b(workshop|hands-on|tutorial|training|bootcamp|hackathon)\b/,
    social: /\b(social|mixer|party|hangout|game\s*night|movie|trivia|karaoke)\b/,
    sports: /\b(sports|fitness|yoga|run|marathon|basketball|soccer|gym|intramural)\b/,
    arts: /\b(art|music|concert|performance|theater|theatre|gallery|dance|film)\b/,
    health: /\b(health|wellness|mental\s*health|meditation|counseling|mindful)\b/,
    diversity: /\b(diversity|inclusion|dei|equity|cultural|heritage|pride|lgbtq)\b/,
    technology: /\b(tech|software|coding|programming|ai|machine\s*learning|data\s*science|robotics|cyber)\b/,
    entrepreneurship: /\b(startup|entrepreneur|venture|pitch|founder|innovation|business\s*plan)\b/,
    community: /\b(community|volunteer|service|outreach|charity|fundrais)\b/,
    networking: /\b(networking|connect|meetup|meet\s*and\s*greet|alumni)\b/,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(text)) topics.push(topic);
  }

  // Default topic if none matched
  if (topics.length === 0) topics.push("community");

  return topics.slice(0, 3);
}
