import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!email.endsWith("@mit.edu")) {
      return NextResponse.json(
        { error: "Only @mit.edu email addresses are allowed" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.verified) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Rate limit: check for recent verification code
    const recentCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recentCode) {
      return NextResponse.json(
        { error: "Verification code already sent. Please check your email or wait 5 minutes." },
        { status: 429 }
      );
    }

    if (!existing) {
      const passwordHash = await hashPassword(password);
      await prisma.user.create({
        data: { email, passwordHash, name: name || null },
      });
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete any existing codes for this email
    await prisma.verificationCode.deleteMany({ where: { email } });
    await prisma.verificationCode.create({
      data: { email, code, expiresAt },
    });

    try {
      await sendVerificationEmail(email, code);
    } catch (err) {
      console.error("Failed to send verification email:", err);
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Verification code sent to your email" });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
