import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { logUnexpectedError, publicErrorMessage } from "@/lib/security";
import type { DriveSettings, VideoProcessingStatus } from "@/types/video";

type ProcessUploadedMediaInput = {
  audioFileName: string;
  isVideo: boolean;
  settings: DriveSettings;
  sourceFileName: string;
  sourcePath: string;
  uploadDir: string;
  videoFileName: string;
};

type ProcessedMedia = {
  audioFileName: string;
  audioSize: number;
  compressedSize?: number;
  processingError?: string;
  processingStatus: VideoProcessingStatus;
  sourceFileName?: string;
  storedFileName: string;
};

function splitCommand(command: string) {
  const parts: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(command)) !== null) {
    parts.push(match[1] || match[2] || match[3]);
  }

  return parts;
}

function numberInRange(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

async function runFfmpeg(args: string[]) {
  const commandParts = splitCommand(process.env.FFMPEG_COMMAND || "ffmpeg");

  if (commandParts.length === 0) {
    throw new Error("Configura FFMPEG_COMMAND en .env.local.");
  }

  return new Promise<void>((resolve, reject) => {
    const child = spawn(commandParts[0], [...commandParts.slice(1), ...args], {
      cwd: process.cwd(),
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("FFmpeg ha tardado demasiado y se ha cancelado."));
    }, 45 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || stdout || `FFmpeg termino con codigo ${code}.`));
      }
    });
  });
}

async function fileSize(filePath: string) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

async function removeIfExists(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // Temporary processing files may already be gone.
  }
}

async function transcodeAudio(sourcePath: string, audioPath: string, settings: DriveSettings) {
  const bitrate = numberInRange(settings.audioBitrateKbps, 48, 24, 160);

  await runFfmpeg([
    "-y",
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "aac",
    "-b:a",
    `${bitrate}k`,
    audioPath,
  ]);
}

async function compressVideo(sourcePath: string, videoPath: string, settings: DriveSettings) {
  const crf = numberInRange(settings.compressionCrf, 28, 18, 35);

  await runFfmpeg([
    "-y",
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(crf),
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    videoPath,
  ]);
}

export async function processUploadedMedia({
  audioFileName,
  isVideo,
  settings,
  sourceFileName,
  sourcePath,
  uploadDir,
  videoFileName,
}: ProcessUploadedMediaInput): Promise<ProcessedMedia> {
  const audioPath = path.join(uploadDir, audioFileName);
  const videoPath = path.join(uploadDir, videoFileName);

  try {
    await transcodeAudio(sourcePath, audioPath, settings);

    if (!isVideo) {
      const audioSize = await fileSize(audioPath);

      if (settings.deleteOriginalAfterProcessing) {
        await removeIfExists(sourcePath);
      }

      return {
        audioFileName,
        audioSize,
        processingStatus: "ready",
        sourceFileName: settings.deleteOriginalAfterProcessing ? undefined : sourceFileName,
        storedFileName: audioFileName,
      };
    }

    await compressVideo(sourcePath, videoPath, settings);

    const [audioSize, compressedSize] = await Promise.all([fileSize(audioPath), fileSize(videoPath)]);

    if (settings.deleteOriginalAfterProcessing) {
      await removeIfExists(sourcePath);
    }

    return {
      audioFileName,
      audioSize,
      compressedSize,
      processingStatus: "ready",
      sourceFileName: settings.deleteOriginalAfterProcessing ? undefined : sourceFileName,
      storedFileName: videoFileName,
    };
  } catch (error) {
    logUnexpectedError("media-processing", error);
    await Promise.all([removeIfExists(audioPath), removeIfExists(videoPath)]);

    return {
      audioFileName,
      audioSize: 0,
      processingError: publicErrorMessage(
        error,
        "No se pudo procesar el archivo con FFmpeg. Revisa el formato del archivo y la configuracion local.",
      ),
      processingStatus: "error",
      sourceFileName,
      storedFileName: sourceFileName,
    };
  }
}
