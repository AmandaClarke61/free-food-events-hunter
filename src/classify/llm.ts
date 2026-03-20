import crypto from "crypto";
import OpenAI from "openai";
import { prisma } from "@/lib/db";

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

/** Compute a cache fingerprint from the text sent to the LLM */
function cacheFingerprint(e: EventInput): string {
  const text = `${e.title}|${(e.description ?? "").slice(0, 300)}|${e.location ?? ""}`;
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Retry a function with exponential backoff */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Batch-classify events using gpt-4o-mini.
 * Uses cache to skip previously classified events and retries on failure.
 */
export async function classifyWithLLM(
  events: EventInput[]
): Promise<LLMClassification[]> {
  if (events.length === 0) return [];

  const neutralResult = (): LLMClassification => ({
    hasFreeFood: false,
    confidence: 0.5,
    topics: [],
  });

  if (!process.env.OPENAI_API_KEY) {
    return events.map(() => neutralResult());
  }

  // Compute fingerprints and check cache
  const fingerprints = events.map(cacheFingerprint);
  const cached = await prisma.llmCache.findMany({
    where: {
      fingerprint: { in: fingerprints },
      createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  const cacheMap = new Map(cached.map((c) => [c.fingerprint, c.result]));

  // Separate hits from misses
  const results: LLMClassification[] = new Array(events.length);
  const missIndices: number[] = [];

  for (let i = 0; i < events.length; i++) {
    const cachedResult = cacheMap.get(fingerprints[i]);
    if (cachedResult) {
      results[i] = JSON.parse(cachedResult);
    } else {
      missIndices.push(i);
    }
  }

  if (missIndices.length === 0) return results;

  // Call OpenAI for cache misses only
  const missEvents = missIndices.map((i) => events[i]);
  const eventList = missEvents
    .map(
      (e, i) =>
        `[${i}] Title: ${e.title}\nDescription: ${(e.description ?? "").slice(0, 300)}\nLocation: ${e.location ?? "N/A"}`
    )
    .join("\n\n");

  let llmResults: LLMClassification[];
  try {
    const response = await retryWithBackoff(() =>
      openai.chat.completions.create({
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
            content: `Classify these ${missEvents.length} events:\n\n${eventList}`,
          },
        ],
      })
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      llmResults = missEvents.map(() => neutralResult());
    } else {
      const parsed = JSON.parse(content) as {
        results: Array<{
          hasFreeFood: boolean;
          confidence: number;
          foodDetails?: string | null;
          topics: string[];
        }>;
      };
      llmResults = parsed.results.map((r) => ({
        hasFreeFood: r.hasFreeFood,
        confidence: r.confidence,
        foodDetails: r.foodDetails ?? undefined,
        topics: r.topics ?? [],
      }));
    }
  } catch (err) {
    console.error("[llm] All retries failed:", err);
    llmResults = missEvents.map(() => neutralResult());
  }

  // Store results in cache and fill in the results array
  const cacheWrites: Promise<unknown>[] = [];
  for (let j = 0; j < missIndices.length; j++) {
    const idx = missIndices[j];
    results[idx] = llmResults[j] ?? neutralResult();

    cacheWrites.push(
      prisma.llmCache
        .upsert({
          where: { fingerprint: fingerprints[idx] },
          update: { result: JSON.stringify(results[idx]), createdAt: new Date() },
          create: { fingerprint: fingerprints[idx], result: JSON.stringify(results[idx]) },
        })
        .catch((err) => console.error("[llm] Cache write failed:", err))
    );
  }
  await Promise.allSettled(cacheWrites);

  return results;
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

  if (topics.length === 0) topics.push("community");
  return topics.slice(0, 3);
}
