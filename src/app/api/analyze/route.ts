import { NextResponse } from "next/server";
import { getAiCoachNotes } from "@/lib/ai-api";
import { analyzeTranscript } from "@/lib/analysis";
import { getAiSettings, getVideoEntry, updateVideoEntry } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; useAi?: boolean };

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar." },
      { status: 500 },
    );
  }
}
