import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = { userId: user.id };
  if (from || to) {
    where.startTime = {};
    if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
    if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          url: true,
          imageUrl: true,
          hasFreeFood: true,
          foodDetails: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({ schedules });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, startTime, endTime, location, eventId, remindBefore } = body;

  if (!title || !startTime) {
    return NextResponse.json(
      { error: "title and startTime are required" },
      { status: 400 }
    );
  }

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;

  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
  }

  // If linking to an event, verify it exists
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
  }

  // Conflict detection: find overlapping schedules
  const conflicts = await findConflicts(user.id, start, end, null);

  const schedule = await prisma.schedule.create({
    data: {
      userId: user.id,
      title,
      description: description || null,
      startTime: start,
      endTime: end,
      location: location || null,
      eventId: eventId || null,
      remindBefore: typeof remindBefore === "number" ? remindBefore : 30,
    },
    include: {
      event: {
        select: { id: true, title: true, url: true, imageUrl: true, hasFreeFood: true, foodDetails: true },
      },
    },
  });

  return NextResponse.json({
    schedule,
    conflicts: conflicts.map((c) => ({
      id: c.id,
      title: c.title,
      startTime: c.startTime,
      endTime: c.endTime,
    })),
  });
}

async function findConflicts(
  userId: string,
  start: Date,
  end: Date | null,
  excludeId: string | null
) {
  // Default duration: 1 hour if no end time
  const effectiveEnd = end || new Date(start.getTime() + 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    userId,
    // Overlap: existing.start < new.end AND existing.effectiveEnd > new.start
    startTime: { lt: effectiveEnd },
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const candidates = await prisma.schedule.findMany({
    where,
    orderBy: { startTime: "asc" },
  });

  // Filter for actual overlap (accounting for items without endTime)
  return candidates.filter((s) => {
    const sEnd = s.endTime || new Date(s.startTime.getTime() + 60 * 60 * 1000);
    return sEnd > start;
  });
}
