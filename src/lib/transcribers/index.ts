import type { TranscriptionProvider, VideoEntry } from "@/types/video";
import { transcribeWithConfiguredAi } from "@/lib/ai-api";
import { getAiSettings } from "@/lib/storage";
import { getTranscriptionMediaAbsolutePath } from "@/lib/storage";
import { transcribeWithLocalWhisper } from "@/lib/transcribers/localWhisper";

export async function transcribeEntry(entry: VideoEntry, provider: TranscriptionProvider) {
  const filePath = getTranscriptionMediaAbsolutePath(entry);

  if (provider === "openai" || provider === "ai-api") {
    const settings = await getAiSettings();
    return transcribeWithConfiguredAi(filePath, settings);
  }

  return transcribeWithLocalWhisper(filePath);
}
