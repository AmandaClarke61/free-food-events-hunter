import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, setTokenCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, code } = await request.json();

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 }
    );
  }

  const record = await prisma.verificationCode.findFirst({
    where: { email, code },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return NextResponse.json(
      { error: "Invalid verification code" },
      { status: 400 }
    );
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Verification code has expired" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { email },
    data: { verified: true },
  });

  // Clean up used codes
  await prisma.verificationCode.deleteMany({ where: { email } });

  const token = signToken({ id: user.id, email: user.email });
  setTokenCookie(token);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
