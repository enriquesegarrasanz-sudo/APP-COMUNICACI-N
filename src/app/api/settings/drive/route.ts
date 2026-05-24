import { NextResponse } from "next/server";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { getDriveSettingsStatus, updateDriveSettings } from "@/lib/storage";
import type { DriveSettings } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeSettings(body: Partial<DriveSettings>): Partial<DriveSettings> {
  return {
    audioBitrateKbps: typeof body.audioBitrateKbps === "number" ? body.audioBitrateKbps : undefined,
    compressionCrf: typeof body.compressionCrf === "number" ? body.compressionCrf : undefined,
    deleteOriginalAfterProcessing:
      typeof body.deleteOriginalAfterProcessing === "boolean" ? body.deleteOriginalAfterProcessing : undefined,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    folderId: typeof body.folderId === "string" ? body.folderId : undefined,
  };
}

export async function GET() {
  const settings = await getDriveSettingsStatus();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  try {
    const body = await readJsonObject<Partial<DriveSettings>>(request);
    await updateDriveSettings(sanitizeSettings(body));
    const settings = await getDriveSettingsStatus();
    return NextResponse.json({ settings });
  } catch (error) {
    logUnexpectedError("settings.drive", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo guardar la conexion Drive.") },
      { status: publicErrorStatus(error, 400) },
    );
  }
}
