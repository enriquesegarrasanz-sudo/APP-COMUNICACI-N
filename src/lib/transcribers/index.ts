import type { TranscriptionProvider, VideoEntry } from "@/types/video";
import { getVideoAbsolutePath } from "@/lib/storage";
import { transcribeWithLocalWhisper } from "@/lib/transcribers/localWhisper";
import { transcribeWithOpenAI } from "@/lib/transcribers/openai";

export async function transcribeEntry(entry: VideoEntry, provider: TranscriptionProvider) {
  const filePath = getVideoAbsolutePath(entry);

  if (provider === "openai") {
    return transcribeWithOpenAI(filePath);
  }

  return transcribeWithLocalWhisper(filePath);
}

