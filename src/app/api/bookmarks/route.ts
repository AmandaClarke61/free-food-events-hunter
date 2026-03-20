import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    include: {
      event: {
        include: { sources: { select: { source: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const events = bookmarks.map((b) => ({
    ...b.event,
    topics: JSON.parse(b.event.topics ?? "[]") as string[],
    sources: b.event.sources.map((s) => s.source),
    isBookmarked: true,
  }));

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await request.json();
  if (!eventId) {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  // Toggle: delete if exists, create if not
  const existing = await prisma.bookmark.findUnique({
    where: { userId_eventId: { userId: user.id, eventId } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return NextResponse.json({ bookmarked: false });
  } else {
    await prisma.bookmark.create({
      data: { userId: user.id, eventId },
    });
    return NextResponse.json({ bookmarked: true });
  }
}
