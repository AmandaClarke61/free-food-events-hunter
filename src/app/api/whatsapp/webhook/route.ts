import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { processMessage } from "@/lib/ai-agent";
import { isProUser } from "@/lib/stripe";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "mit-events-verify";

// In-memory conversation store (per phone number)
// In production, use Redis or DB
const conversations = new Map<string, { history: unknown[]; lastActive: number }>();

// Webhook verification (Meta sends GET to verify)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Receive messages
export async function POST(request: NextRequest) {
  const body = await request.json();

  // WhatsApp sends a specific structure
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.[0]) {
    // Status update or other non-message webhook
    return NextResponse.json({ status: "ok" });
  }

  const message = value.messages[0];
  const from = message.from; // Phone number
  const text = message.text?.body;

  if (!text) {
    return NextResponse.json({ status: "ok" });
  }

  // Find user by WhatsApp binding
  const binding = await prisma.whatsAppBinding.findUnique({
    where: { phoneNumber: from, verified: true },
  });

  if (!binding) {
    await sendWhatsAppMessage(
      from,
      "Your phone number is not linked to an MIT Events account. Please link it at the website settings page first."
    );
    return NextResponse.json({ status: "ok" });
  }

  // Check Pro subscription
  if (!(await isProUser(binding.userId))) {
    await sendWhatsAppMessage(
      from,
      "The WhatsApp AI assistant requires a Pro subscription. Visit the pricing page on the website to upgrade."
    );
    return NextResponse.json({ status: "ok" });
  }

  // Get or create conversation
  let conv = conversations.get(from);
  if (!conv || Date.now() - conv.lastActive > 30 * 60 * 1000) {
    // Reset after 30 min inactivity
    conv = { history: [], lastActive: Date.now() };
  }
  conv.lastActive = Date.now();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await processMessage(binding.userId, text, conv.history as any[]);
    conv.history = result.history;
    conversations.set(from, conv);

    await sendWhatsAppMessage(from, result.reply);
  } catch (err) {
    console.error("WhatsApp AI error:", err);
    await sendWhatsAppMessage(from, "Sorry, I had trouble processing that. Please try again.");
  }

  return NextResponse.json({ status: "ok" });
}
