import { NextResponse } from "next/server";
import { getAiSettingsStatus, updateAiSettings } from "@/lib/storage";
import type { AiSettings } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeSettings(body: Partial<AiSettings>): Partial<AiSettings> {
  return {
    providerKind: body.providerKind,
    providerName: typeof body.providerName === "string" ? body.providerName : undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    apiKeyEnvVar: typeof body.apiKeyEnvVar === "string" ? body.apiKeyEnvVar : undefined,
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
  try {
    const body = (await request.json()) as Partial<AiSettings>;
    await updateAiSettings(sanitizeSettings(body));
    const settings = await getAiSettingsStatus();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la configuracion de IA." },
      { status: 400 },
    );
  }
}
