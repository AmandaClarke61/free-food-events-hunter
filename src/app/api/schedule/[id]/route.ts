import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedule = await prisma.schedule.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      event: {
        select: { id: true, title: true, url: true, imageUrl: true, hasFreeFood: true, foodDetails: true },
      },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ schedule });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.schedule.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.startTime !== undefined) data.startTime = new Date(body.startTime);
  if (body.endTime !== undefined) data.endTime = body.endTime ? new Date(body.endTime) : null;
  if (body.location !== undefined) data.location = body.location || null;
  if (body.remindBefore !== undefined) data.remindBefore = body.remindBefore;

  // Reset reminded if time changed
  if (data.startTime || data.remindBefore !== undefined) {
    data.reminded = false;
  }

  const schedule = await prisma.schedule.update({
    where: { id: params.id },
    data,
    include: {
      event: {
        select: { id: true, title: true, url: true, imageUrl: true, hasFreeFood: true, foodDetails: true },
      },
    },
  });

  return NextResponse.json({ schedule });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.schedule.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.schedule.delete({ where: { id: params.id } });

  return NextResponse.json({ deleted: true });
}
