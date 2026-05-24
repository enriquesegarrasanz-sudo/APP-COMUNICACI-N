import { NextResponse } from "next/server";
import { requireLocalWriteRequest } from "@/lib/security";
import { deleteTokens } from "@/lib/google-oauth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  await deleteTokens();
  return NextResponse.json({ disconnected: true });
}
