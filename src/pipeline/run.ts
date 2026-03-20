import { prisma } from "@/lib/db";
import { RawEvent } from "@/lib/types";
import { collectLocalist } from "@/collectors/localist";
import { collectCampusGroups, collectSloanGroups } from "@/collectors/campusgroups";
import { collectGSC } from "@/collectors/gsc-anno";
import { collectCSAIL } from "@/collectors/csail";
import { collectIDSS } from "@/collectors/idss";
import { collectMediaLab } from "@/collectors/medialab";
import { collectMITSloan } from "@/collectors/mitsloan";
import { collectBCS } from "@/collectors/bcs";
import { normalizeAndClassify } from "./normalize";
import { dedup } from "./dedup";

type Collector = {
  name: string;
  fn: () => Promise<RawEvent[]>;
};

const COLLECTORS: Collector[] = [
  { name: "localist", fn: collectLocalist },
  { name: "campusgroups", fn: collectCampusGroups },
  { name: "sloangroups", fn: collectSloanGroups },
  { name: "gsc", fn: collectGSC },
  { name: "csail", fn: collectCSAIL },
  { name: "idss", fn: collectIDSS },
  { name: "medialab", fn: collectMediaLab },
  { name: "mitsloan", fn: collectMITSloan },
  { name: "bcs", fn: collectBCS },
];

export async function runPipeline(sourceFilter?: string) {
  const collectors = sourceFilter
    ? COLLECTORS.filter((c) => c.name === sourceFilter)
    : COLLECTORS;

  const allRawEvents: RawEvent[] = [];

  // Clean up stale LLM cache entries (older than 14 days)
  await prisma.llmCache.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
  }).catch((err) => console.error("[pipeline] LLM cache cleanup failed:", err));

  for (const collector of collectors) {
    const run = await prisma.pipelineRun.create({
      data: { source: collector.name, status: "running" },
    });

    try {
      console.log(`[pipeline] Collecting from ${collector.name}...`);
      const events = await collector.fn();
      console.log(`[pipeline] Got ${events.length} events from ${collector.name}`);

      allRawEvents.push(...events);

      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: "success",
          eventsFound: events.length,
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[pipeline] Error collecting from ${collector.name}:`, errMsg);

      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: "error",
          error: errMsg.slice(0, 1000),
          finishedAt: new Date(),
        },
      });
    }
  }

  // Normalize, classify, and dedup
  console.log(`[pipeline] Classifying ${allRawEvents.length} events...`);
  const classified = await normalizeAndClassify(allRawEvents);
  const deduped = dedup(classified);
  console.log(`[pipeline] ${deduped.length} unique events after dedup`);

  // Upsert into database
  let newCount = 0;
  for (const event of deduped) {
    const eventData = {
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      url: event.url,
      imageUrl: event.imageUrl,
      hasFreeFood: event.hasFreeFood,
      foodConfidence: event.foodConfidence,
      foodDetails: event.foodDetails,
      topics: JSON.stringify(event.topics),
    };

    const upserted = await prisma.event.upsert({
      where: { fingerprint: event.fingerprint },
      update: eventData,
      create: { ...eventData, fingerprint: event.fingerprint },
    });

    // Track if this was a new insert (createdAt ~ updatedAt means new)
    if (
      Math.abs(upserted.createdAt.getTime() - upserted.updatedAt.getTime()) <
      1000
    ) {
      newCount++;
    }

    // Link source — skip if sourceId is missing, otherwise upsert
    if (event.sourceId) {
      const existing = await prisma.eventSource.findFirst({
        where: { source: event.source, sourceId: event.sourceId },
      });
      if (!existing) {
        await prisma.eventSource.create({
          data: {
            eventId: upserted.id,
            source: event.source,
            sourceId: event.sourceId,
            rawData: event.rawData
              ? JSON.stringify(event.rawData)
              : undefined,
          },
        });
      }
    }
  }

  console.log(`[pipeline] Stored ${newCount} new events, updated ${deduped.length - newCount}`);
  return { total: deduped.length, new: newCount };
}
