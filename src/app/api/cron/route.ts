import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/pipeline/run";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron or manual trigger)
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    // Allow in development
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const source = request.nextUrl.searchParams.get("source") ?? undefined;

  try {
    const result = await runPipeline(source);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron] Pipeline error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
