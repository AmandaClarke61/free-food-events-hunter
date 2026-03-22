import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    user: {
      ...user,
      plan: sub?.plan === "pro" && sub?.status === "active" ? "pro" : "free",
    },
  });
}
