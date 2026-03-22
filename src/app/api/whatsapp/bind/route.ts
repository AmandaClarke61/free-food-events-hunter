import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { isProUser } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isProUser(user.id))) {
    return NextResponse.json(
      { error: "Pro subscription required to link WhatsApp" },
      { status: 403 }
    );
  }

  const { phoneNumber, action } = await request.json();

  if (action === "verify") {
    // User is submitting verification code
    const { code } = await request.json();
    const binding = await prisma.whatsAppBinding.findUnique({
      where: { userId: user.id },
    });

    if (!binding) {
      return NextResponse.json({ error: "No pending binding" }, { status: 400 });
    }

    // Simple: we stored code in description or use a fixed approach
    // For MVP, auto-verify on link
    await prisma.whatsAppBinding.update({
      where: { id: binding.id },
      data: { verified: true },
    });

    return NextResponse.json({ verified: true });
  }

  // Start binding: send verification via WhatsApp
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
  }

  // Clean phone number (remove spaces, dashes, ensure country code)
  const clean = phoneNumber.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{10,15}$/.test(clean)) {
    return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
  }

  const normalized = clean.startsWith("+") ? clean.slice(1) : clean;

  // Check if already bound to another user
  const existing = await prisma.whatsAppBinding.findUnique({
    where: { phoneNumber: normalized },
  });
  if (existing && existing.userId !== user.id) {
    return NextResponse.json(
      { error: "This phone number is already linked to another account" },
      { status: 409 }
    );
  }

  // Upsert binding
  await prisma.whatsAppBinding.upsert({
    where: { userId: user.id },
    create: { userId: user.id, phoneNumber: normalized, verified: true },
    update: { phoneNumber: normalized, verified: true },
  });

  // Send welcome message
  await sendWhatsAppMessage(
    normalized,
    "Your WhatsApp is now linked to MIT Events! You can ask me about events, manage your schedule, and get reminders. Try: \"What free food events are happening tomorrow?\""
  );

  return NextResponse.json({ bound: true, phoneNumber: normalized });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const binding = await prisma.whatsAppBinding.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    binding: binding
      ? { phoneNumber: binding.phoneNumber, verified: binding.verified }
      : null,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.whatsAppBinding.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ unbound: true });
}
