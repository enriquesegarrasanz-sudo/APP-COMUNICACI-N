import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { TranscriptionProvider, VideoEntry } from "@/types/video";
import { transcribeWithConfiguredAi } from "@/lib/ai-api";
import { downloadDriveFileToPath } from "@/lib/google-drive";
import { PublicError } from "@/lib/security";
import { getAiSettings } from "@/lib/storage";
import { getTranscriptionMediaAbsolutePath } from "@/lib/storage";
import { transcribeWithLocalWhisper } from "@/lib/transcribers/localWhisper";

const transcriptionCacheRoot = path.join(process.cwd(), "data", "transcription-cache");

const videoExtensions = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".m4v"]);

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
    throw new PublicError("La sesion de Drive no tiene archivo disponible para transcribir.");
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

async function extractAudioForWhisper(videoPath: string): Promise<string> {
  const cacheDir = path.join(process.cwd(), "data", "transcription-cache", "audio-extract");
  await fs.mkdir(cacheDir, { recursive: true });

  const baseName = path.basename(videoPath, path.extname(videoPath));
  const audioPath = path.join(cacheDir, `${baseName}.wav`);

  try {
    await fs.access(audioPath);
    const stat = await fs.stat(audioPath);

    if (stat.size > 0) {
      return audioPath;
    }
  } catch {
    // needs extraction
  }

  const ffmpegCommand = process.env.FFMPEG_COMMAND || "ffmpeg";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegCommand, [
      "-y", "-i", videoPath,
      "-vn", "-ac", "1", "-ar", "16000",
      "-c:a", "pcm_s16le",
      audioPath,
    ], { cwd: process.cwd(), windowsHide: true });

    let stderr = "";
    const timeout = setTimeout(() => { child.kill(); reject(new PublicError("FFmpeg tardo demasiado extrayendo audio.")); }, 10 * 60 * 1000);

    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(new PublicError(`No se pudo ejecutar FFmpeg para extraer audio: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) { resolve(); }
      else {
        const detail = stderr.split("\n").filter(Boolean).slice(-2).join(" | ");
        reject(new PublicError(`FFmpeg fallo al extraer audio (codigo ${code}): ${detail.slice(0, 200)}`));
      }
    });
  });

  return audioPath;
}

export async function transcribeEntry(entry: VideoEntry, provider: TranscriptionProvider) {
  let filePath = await getTranscriptionMediaPath(entry);

  try {
    const stat = await fs.stat(filePath);

    if (stat.size === 0) {
      throw new Error("empty");
    }
  } catch (error) {
    const reason = error instanceof Error && error.message === "empty"
      ? "El archivo esta vacio"
      : "No se encontro el archivo de audio/video";
    throw new PublicError(
      `${reason}: ${path.basename(filePath)}. Comprueba que el archivo existe o vuelve a subirlo.`,
    );
  }

  if (videoExtensions.has(path.extname(filePath).toLowerCase())) {
    filePath = await extractAudioForWhisper(filePath);
  }

  const settings = await getAiSettings();

  if (provider === "openai" || provider === "ai-api") {
    return transcribeWithConfiguredAi(filePath, settings);
  }

  return transcribeWithLocalWhisper(filePath, settings);
}
