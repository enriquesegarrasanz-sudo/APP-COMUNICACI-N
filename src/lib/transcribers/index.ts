import { promises as fs } from "node:fs";
import path from "node:path";
import type { TranscriptionProvider, VideoEntry } from "@/types/video";
import { transcribeWithConfiguredAi } from "@/lib/ai-api";
import { downloadDriveFileToPath } from "@/lib/google-drive";
import { getAiSettings } from "@/lib/storage";
import { getTranscriptionMediaAbsolutePath } from "@/lib/storage";
import { transcribeWithLocalWhisper } from "@/lib/transcribers/localWhisper";

const transcriptionCacheRoot = path.join(process.cwd(), "data", "transcription-cache");

function extensionForTranscription(entry: VideoEntry, preferAudio: boolean) {
  if (preferAudio) {
    return ".m4a";
  }

  const sourceName = entry.driveFileName || entry.sourceFileName || entry.originalFileName || entry.storedFileName;
  const extension = path.extname(sourceName).toLowerCase();

  if (extension) {
    return extension;
  }

  return entry.mimeType.startsWith("audio/") ? ".m4a" : ".mp4";
}

async function getDriveTranscriptionMediaPath(entry: VideoEntry) {
  const fileId = entry.driveAudioFileId || entry.driveOriginalFileId || entry.driveFileId;

  if (!fileId) {
    throw new Error("La sesion de Drive no tiene archivo disponible para transcribir.");
  }

  const preferAudio = Boolean(entry.driveAudioFileId);
  const cacheDir = path.resolve(transcriptionCacheRoot, entry.id);
  const cacheRoot = path.resolve(transcriptionCacheRoot);

  if (!cacheDir.startsWith(`${cacheRoot}${path.sep}`)) {
    throw new Error("Ruta de cache de transcripcion invalida.");
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${preferAudio ? "audio" : "original"}${extensionForTranscription(entry, preferAudio)}`);

  try {
    await fs.access(filePath);
  } catch {
    await downloadDriveFileToPath({ fileId, filePath });
  }

  return filePath;
}

async function getTranscriptionMediaPath(entry: VideoEntry) {
  if (entry.storageDriver === "drive" || entry.driveOriginalFileId || entry.driveAudioFileId) {
    return getDriveTranscriptionMediaPath(entry);
  }

  return getTranscriptionMediaAbsolutePath(entry);
}

export async function transcribeEntry(entry: VideoEntry, provider: TranscriptionProvider) {
  const filePath = await getTranscriptionMediaPath(entry);
  const settings = await getAiSettings();

  if (provider === "openai" || provider === "ai-api") {
    return transcribeWithConfiguredAi(filePath, settings);
  }

  return transcribeWithLocalWhisper(filePath, settings);
}
