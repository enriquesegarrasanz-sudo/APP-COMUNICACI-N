import { NextResponse } from "next/server";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { defaultAiSettings } from "@/lib/ai-defaults";
import { getAiSettingsStatus, updateAiSettings } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getAiSettingsStatus();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  try {
    await readJsonObject(request);
    await updateAiSettings(defaultAiSettings);
    const settings = await getAiSettingsStatus();
    return NextResponse.json({ settings });
  } catch (error) {
    logUnexpectedError("settings.ai", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo guardar la configuracion de IA.") },
      { status: publicErrorStatus(error, 400) },
    );
  }
}
