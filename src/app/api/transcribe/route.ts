import { NextResponse } from "next/server";
import { analyzeTranscript } from "@/lib/analysis";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import { getVideoEntry, updateVideoEntry } from "@/lib/storage";
import { transcribeEntry } from "@/lib/transcribers";
import type { TranscriptionProvider } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  let body: { id?: string; provider?: TranscriptionProvider };

  try {
    body = await readJsonObject<{ id?: string; provider?: TranscriptionProvider }>(request);
  } catch (error) {
    logUnexpectedError("transcribe.request", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo leer la peticion.") },
      { status: publicErrorStatus(error, 400) },
    );
  }

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
    logUnexpectedError("transcribe", error);
    const message = publicErrorMessage(error, "No se pudo transcribir. Revisa la configuracion y el archivo.");
    const updated = await updateVideoEntry(id, {
      transcriptStatus: "error",
      transcriptProvider: provider,
      transcriptError: message,
    });

    return NextResponse.json({ error: message, entry: updated }, { status: 500 });
  }
}
