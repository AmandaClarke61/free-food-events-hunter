import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { interests } = body;

  // Validate: array of non-empty strings, max 10 items, max 50 chars each
  if (!Array.isArray(interests)) {
    return NextResponse.json(
      { error: "interests must be an array" },
      { status: 400 }
    );
  }
  if (interests.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 interests allowed" },
      { status: 400 }
    );
  }
  for (const item of interests) {
    if (typeof item !== "string" || item.trim().length === 0 || item.length > 50) {
      return NextResponse.json(
        { error: "Each interest must be a non-empty string (max 50 chars)" },
        { status: 400 }
      );
    }
  }

  const trimmed = interests.map((i: string) => i.trim());

  await prisma.user.update({
    where: { id: user.id },
    data: { interests: JSON.stringify(trimmed) },
  });

  return NextResponse.json({ interests: trimmed });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { interests: true },
  });

  const interests = dbUser?.interests
    ? (JSON.parse(dbUser.interests) as string[])
    : [];

  return NextResponse.json({ interests });
}
