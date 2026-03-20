import { NextResponse } from "next/server";
import { clearTokenCookie } from "@/lib/auth";

export async function POST() {
  clearTokenCookie();
  return NextResponse.json({ message: "Logged out" });
}
