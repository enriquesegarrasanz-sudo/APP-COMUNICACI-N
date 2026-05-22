import { NextResponse } from "next/server";
import { getAiCoachNotes } from "@/lib/ai-api";
import { analyzeTranscript } from "@/lib/analysis";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { getAiSettings, getVideoEntry, updateVideoEntry } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  let body: { id?: string; useAi?: boolean };

  try {
    body = await readJsonObject<{ id?: string; useAi?: boolean }>(request);
  } catch (error) {
    logUnexpectedError("analyze.request", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo leer la peticion.") },
      { status: publicErrorStatus(error, 400) },
    );
  }

  if (!body.id) {
    return NextResponse.json({ error: "Falta el id del video." }, { status: 400 });
  }

  const entry = await getVideoEntry(body.id);

  if (!entry) {
    return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
  }

  if (!entry.transcript.trim()) {
    return NextResponse.json({ error: "No hay transcripcion para analizar." }, { status: 400 });
  }

  try {
    const analysis = analyzeTranscript(entry.transcript);
    const settings = await getAiSettings();
    const aiCoachNotes = body.useAi ? await getAiCoachNotes(entry, analysis, settings) : entry.aiCoachNotes;
    const updated = await updateVideoEntry(entry.id, {
      analysis,
      aiCoachNotes: aiCoachNotes ?? entry.aiCoachNotes,
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    logUnexpectedError("analyze", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo analizar.") },
      { status: publicErrorStatus(error, 500) },
    );
  }
}
