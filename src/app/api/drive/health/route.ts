import { NextResponse } from "next/server";
import { getGoogleDriveAuthStatus } from "@/lib/google-drive-auth";
import { getGoogleDriveAccessToken } from "@/lib/google-drive-auth";
import { requireLocalWriteRequest } from "@/lib/security";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = requireLocalWriteRequest(request);
  if (blocked) return blocked;

  const authStatus = await getGoogleDriveAuthStatus();

  if (!authStatus.connected) {
    return NextResponse.json({
      ok: false,
      error: "Google Drive no esta conectado.",
      auth: authStatus,
    });
  }

  try {
    const token = await getGoogleDriveAccessToken();
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota(usage,limit)",
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({
        ok: false,
        error: `Drive API respondio HTTP ${response.status}: ${text.slice(0, 200)}`,
        auth: authStatus,
      });
    }

    const about = (await response.json()) as {
      user?: { displayName?: string; emailAddress?: string };
      storageQuota?: { usage?: string; limit?: string };
    };

    return NextResponse.json({
      ok: true,
      user: about.user,
      quota: about.storageQuota
        ? {
            usedMb: Math.round(Number(about.storageQuota.usage || 0) / (1024 * 1024)),
            limitMb: about.storageQuota.limit
              ? Math.round(Number(about.storageQuota.limit) / (1024 * 1024))
              : null,
          }
        : null,
      auth: authStatus,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido al conectar con Drive.",
      auth: authStatus,
    });
  }
}
