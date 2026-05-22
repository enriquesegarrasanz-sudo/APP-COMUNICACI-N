import { NextResponse } from "next/server";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { getAiSettingsPreset } from "@/lib/ai-defaults";
import { getAiSettingsStatus, updateAiSettings } from "@/lib/storage";
import type { AiSettings } from "@/types/video";

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
    const body = await readJsonObject<{ providerKind?: AiSettings["providerKind"]; analysisModel?: string }>(request);
    await updateAiSettings(getAiSettingsPreset(body.providerKind ?? "deepseek", body.analysisModel));
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
