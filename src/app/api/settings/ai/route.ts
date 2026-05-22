import { NextResponse } from "next/server";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { getAiSettingsStatus, updateAiSettings } from "@/lib/storage";
import type { AiSettings } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeSettings(body: Partial<AiSettings>): Partial<AiSettings> {
  return {
    providerKind: body.providerKind,
    providerName: typeof body.providerName === "string" ? body.providerName : undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    chatEndpoint: typeof body.chatEndpoint === "string" ? body.chatEndpoint : undefined,
    transcriptionEndpoint: typeof body.transcriptionEndpoint === "string" ? body.transcriptionEndpoint : undefined,
    authMode: body.authMode,
    apiKeyEnvVar: typeof body.apiKeyEnvVar === "string" ? body.apiKeyEnvVar : undefined,
    apiKeyQueryParam: typeof body.apiKeyQueryParam === "string" ? body.apiKeyQueryParam : undefined,
    transcriptionModel: typeof body.transcriptionModel === "string" ? body.transcriptionModel : undefined,
    analysisModel: typeof body.analysisModel === "string" ? body.analysisModel : undefined,
    visionModel: typeof body.visionModel === "string" ? body.visionModel : undefined,
    transcriptionEnabled:
      typeof body.transcriptionEnabled === "boolean" ? body.transcriptionEnabled : undefined,
    transcriptAnalysisEnabled:
      typeof body.transcriptAnalysisEnabled === "boolean" ? body.transcriptAnalysisEnabled : undefined,
    videoAnalysisEnabled: typeof body.videoAnalysisEnabled === "boolean" ? body.videoAnalysisEnabled : undefined,
    historyContextEnabled: typeof body.historyContextEnabled === "boolean" ? body.historyContextEnabled : undefined,
    applicationContext: typeof body.applicationContext === "string" ? body.applicationContext : undefined,
  };
}

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
    await updateAiSettings(sanitizeSettings(body));
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
