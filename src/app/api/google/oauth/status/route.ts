import { NextResponse } from "next/server";
import { getGoogleDriveAuthStatus } from "@/lib/google-drive-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getGoogleDriveAuthStatus();
  return NextResponse.json(status);
}
