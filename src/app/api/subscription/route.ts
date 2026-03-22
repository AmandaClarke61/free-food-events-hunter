import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
        }
      : { plan: "free", status: "active" },
  });
}
