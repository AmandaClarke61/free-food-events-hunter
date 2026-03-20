import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

let cachedTopics: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();
  if (cachedTopics && now - cacheTime < CACHE_TTL) {
    return NextResponse.json({ topics: cachedTopics });
  }

  const events = await prisma.event.findMany({
    where: { topics: { not: null } },
    select: { topics: true },
  });

  const topicSet = new Set<string>();
  for (const e of events) {
    try {
      const parsed = JSON.parse(e.topics!) as string[];
      for (const t of parsed) topicSet.add(t);
    } catch {
      // skip malformed JSON
    }
  }

  cachedTopics = Array.from(topicSet).sort();
  cacheTime = now;

  return NextResponse.json({ topics: cachedTopics });
}
