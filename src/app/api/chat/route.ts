import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { processMessage } from "@/lib/ai-agent";
import { isProUser } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isProUser(user.id))) {
    return NextResponse.json(
      { error: "Pro subscription required. Upgrade at /pricing to use the AI assistant." },
      { status: 403 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI assistant is not configured" },
      { status: 503 }
    );
  }

  const { message, history } = await request.json();

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 }
    );
  }

  try {
    const result = await processMessage(user.id, message, history || []);
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
