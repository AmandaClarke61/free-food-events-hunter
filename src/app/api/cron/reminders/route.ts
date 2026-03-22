import { NextRequest, NextResponse } from "next/server";
import { processReminders, sendDailySummary } from "@/lib/reminder";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const action = request.nextUrl.searchParams.get("action");

  try {
    if (action === "daily-summary") {
      const result = await sendDailySummary();
      return NextResponse.json({ ok: true, ...result });
    }

    // Default: process reminders
    const result = await processReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/reminders] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
