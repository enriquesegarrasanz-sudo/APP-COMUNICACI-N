import { NextResponse } from "next/server";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { getAiSettingsPreset } from "@/lib/ai-defaults";
import { getAiSettings, getAiSettingsStatus, updateAiSettings } from "@/lib/storage";
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
    const body = await readJsonObject<Partial<AiSettings>>(request);
    const current = await getAiSettings();
    const preset = getAiSettingsPreset(body.providerKind ?? current.providerKind, body.analysisModel);

    await updateAiSettings({
      ...preset,
      analysisModel: typeof body.analysisModel === "string" ? body.analysisModel : preset.analysisModel,
      applicationContext:
        typeof body.applicationContext === "string" ? body.applicationContext : current.applicationContext,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : preset.baseUrl,
      historyContextEnabled:
        typeof body.historyContextEnabled === "boolean"
          ? body.historyContextEnabled
          : preset.historyContextEnabled,
      ollamaStartCommand:
        typeof body.ollamaStartCommand === "string" ? body.ollamaStartCommand : current.ollamaStartCommand,
      transcriptAnalysisEnabled:
        typeof body.transcriptAnalysisEnabled === "boolean"
          ? body.transcriptAnalysisEnabled
          : preset.transcriptAnalysisEnabled,
      videoAnalysisEnabled:
        typeof body.videoAnalysisEnabled === "boolean" ? body.videoAnalysisEnabled : preset.videoAnalysisEnabled,
      whisperCommand: typeof body.whisperCommand === "string" ? body.whisperCommand : current.whisperCommand,
      whisperModel: typeof body.whisperModel === "string" ? body.whisperModel : current.whisperModel,
    });
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
