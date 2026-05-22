import { NextResponse } from "next/server";
import { analyzeTranscript } from "@/lib/analysis";
import { getVideoEntry, updateVideoEntry } from "@/lib/storage";
import { transcribeEntry } from "@/lib/transcribers";
import type { TranscriptionProvider } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; provider?: TranscriptionProvider };
  const id = body.id;
  const provider = body.provider === "openai" || body.provider === "ai-api" ? "ai-api" : "local";

  if (!id) {
    return NextResponse.json({ error: "Falta el id del video." }, { status: 400 });
  }

  const entry = await getVideoEntry(id);

  if (!entry) {
    return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
  }

  await updateVideoEntry(id, {
    transcriptStatus: "processing",
    transcriptProvider: provider,
    transcriptError: "",
  });

  try {
    const transcript = await transcribeEntry(entry, provider);
    const analysis = analyzeTranscript(transcript);
    const updated = await updateVideoEntry(id, {
      transcript,
      transcriptStatus: "ready",
      transcriptProvider: provider,
      transcriptError: "",
      analysis,
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo transcribir.";
    const updated = await updateVideoEntry(id, {
      transcriptStatus: "error",
      transcriptProvider: provider,
      transcriptError: message,
    });

    return NextResponse.json({ error: message, entry: updated }, { status: 500 });
  }
}
