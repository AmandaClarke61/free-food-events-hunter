import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
