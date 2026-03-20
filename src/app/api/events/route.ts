import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { scoreEvent } from "@/recommend/score";

/** Convert a YYYY-MM-DD date string to a UTC Date representing midnight ET */
function dateToET(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  // Determine EDT (UTC-4) vs EST (UTC-5) for this date
  const month = d.getMonth();
  const day = d.getDate();
  const year = d.getFullYear();

  let isDST = false;
  if (month > 2 && month < 10) {
    isDST = true; // Apr–Oct
  } else if (month === 2) {
    // March: DST starts second Sunday at 2 AM
    const marchFirst = new Date(year, 2, 1);
    const dstStart = 14 - marchFirst.getDay();
    isDST = day > dstStart || (day === dstStart);
  } else if (month === 10) {
    // November: DST ends first Sunday at 2 AM
    const novFirst = new Date(year, 10, 1);
    const dstEnd = novFirst.getDay() === 0 ? 1 : 8 - novFirst.getDay();
    isDST = day < dstEnd;
  }

  const offsetHours = isDST ? 4 : 5;
  return new Date(Date.UTC(year, month, day, offsetHours, 0, 0));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const freeFood = params.get("freeFood") === "true" ? true : undefined;
  const topic = params.get("topic") ?? undefined;
  const search = params.get("search") ?? undefined;
  const limit = Math.min(parseInt(params.get("limit") ?? "50"), 100);
  const offset = parseInt(params.get("offset") ?? "0");
  const upcoming = params.get("upcoming") !== "false"; // default true
  const dateFrom = params.get("dateFrom") ?? undefined;
  const dateTo = params.get("dateTo") ?? undefined;
  const forYou = params.get("forYou") === "true";

  // --- forYou branch: score all upcoming events and return sorted ---
  if (forYou) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch user interests
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { interests: true },
    });
    const explicitInterests: string[] = dbUser?.interests
      ? JSON.parse(dbUser.interests)
      : [];

    // 2. Build implicit interests from bookmarked events
    const bookmarkedEvents = await prisma.bookmark.findMany({
      where: { userId: user.id },
      include: { event: { select: { topics: true } } },
    });
    const implicitInterests: Record<string, number> = {};
    for (const b of bookmarkedEvents) {
      const topics: string[] = JSON.parse(b.event.topics ?? "[]");
      for (const t of topics) {
        implicitInterests[t] = (implicitInterests[t] ?? 0) + 1;
      }
    }

    // 3. Fetch all upcoming events (with optional filters)
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) range.gte = dateToET(dateFrom);
      if (dateTo) range.lt = dateToET(dateTo);
      where.startTime = range;
    } else {
      where.startTime = { gte: new Date() };
    }
    if (freeFood) where.hasFreeFood = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } },
      ];
    }
    // topic filter is ignored for forYou (multi-topic by nature)

    const allEvents = await prisma.event.findMany({
      where,
      include: { sources: { select: { source: true } } },
    });

    // 4. Score and sort
    const prefs = { explicitInterests, implicitInterests };
    const scored = allEvents
      .map((e) => {
        const topics = JSON.parse(e.topics ?? "[]") as string[];
        return {
          event: e,
          topics,
          score: scoreEvent(
            {
              hasFreeFood: e.hasFreeFood,
              foodConfidence: e.foodConfidence,
              topics,
              startTime: e.startTime,
            },
            prefs
          ),
        };
      })
      .sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : a.event.startTime.getTime() - b.event.startTime.getTime()
      );

    // 5. In-memory pagination
    const total = scored.length;
    const page = scored.slice(offset, offset + limit);

    // 6. Attach bookmark status
    const eventIds = page.map((s) => s.event.id);
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id, eventId: { in: eventIds } },
      select: { eventId: true },
    });
    const bookmarkedIds = new Set(bookmarks.map((b) => b.eventId));

    const formatted = page.map((s) => ({
      id: s.event.id,
      title: s.event.title,
      description: s.event.description,
      startTime: s.event.startTime,
      endTime: s.event.endTime,
      location: s.event.location,
      url: s.event.url,
      imageUrl: s.event.imageUrl,
      hasFreeFood: s.event.hasFreeFood,
      foodDetails: s.event.foodDetails,
      topics: s.topics,
      sources: s.event.sources.map((src) => src.source),
      isBookmarked: bookmarkedIds.has(s.event.id),
      score: s.score,
    }));

    return NextResponse.json({ events: formatted, total, limit, offset });
  }

  const where: Record<string, unknown> = {};

  if (freeFood) {
    where.hasFreeFood = true;
  }

  if (dateFrom || dateTo) {
    // Interpret dates as Eastern Time so filtering matches the displayed date
    const range: Record<string, Date> = {};
    if (dateFrom) range.gte = dateToET(dateFrom);
    if (dateTo) range.lt = dateToET(dateTo);
    where.startTime = range;
  } else if (upcoming) {
    where.startTime = { gte: new Date() };
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { location: { contains: search } },
    ];
  }

  if (topic) {
    where.topics = { contains: topic };
  }

  const [events, total, user] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startTime: "asc" },
      take: limit,
      skip: offset,
      include: { sources: { select: { source: true } } },
    }),
    prisma.event.count({ where }),
    getCurrentUser().catch(() => null),
  ]);

  // If user is logged in, attach bookmark status
  let bookmarkedIds = new Set<string>();
  if (user && events.length > 0) {
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: user.id,
        eventId: { in: events.map((e) => e.id) },
      },
      select: { eventId: true },
    });
    bookmarkedIds = new Set(bookmarks.map((b) => b.eventId));
  }

  const formatted = events.map((e) => ({
    ...e,
    topics: JSON.parse(e.topics ?? "[]") as string[],
    sources: e.sources.map((s) => s.source),
    isBookmarked: bookmarkedIds.has(e.id),
  }));

  return NextResponse.json({ events: formatted, total, limit, offset });
}
