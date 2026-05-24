import { NextResponse } from "next/server";
import { getAiSettingsPreset } from "@/lib/ai-defaults";
import { checkWhisperCommand, ensureOllamaAvailable } from "@/lib/local-processes";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { getAiSettings } from "@/lib/storage";
import type { AiSettings } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalToolAction = "ollama" | "whisper";

type LocalToolRequest = {
  action?: LocalToolAction;
  settings?: Partial<AiSettings>;
};

function candidateSettings(current: AiSettings, patch: Partial<AiSettings> = {}): AiSettings {
  const preset = getAiSettingsPreset(patch.providerKind ?? current.providerKind, patch.analysisModel);

  return {
    ...current,
    ...preset,
    analysisModel: typeof patch.analysisModel === "string" ? patch.analysisModel : preset.analysisModel,
    baseUrl: typeof patch.baseUrl === "string" ? patch.baseUrl : preset.baseUrl,
    ollamaStartCommand:
      typeof patch.ollamaStartCommand === "string" ? patch.ollamaStartCommand : current.ollamaStartCommand,
    whisperCommand: typeof patch.whisperCommand === "string" ? patch.whisperCommand : current.whisperCommand,
    whisperModel: typeof patch.whisperModel === "string" ? patch.whisperModel : current.whisperModel,
  };
}

export async function POST(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  try {
    const body = await readJsonObject<LocalToolRequest>(request);
    const current = await getAiSettings();
    const settings = candidateSettings(current, body.settings);

    if (body.action === "ollama") {
      const result = await ensureOllamaAvailable(settings);
      return NextResponse.json({ result });
    }

    if (body.action === "whisper") {
      const result = await checkWhisperCommand(settings);
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "Accion local no reconocida." }, { status: 400 });
  } catch (error) {
    logUnexpectedError("settings.ai.local-tools", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo comprobar la herramienta local.") },
      { status: publicErrorStatus(error, 400) },
    );
  }
}
