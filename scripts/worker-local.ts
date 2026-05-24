import { loadEnvConfig } from "@next/env";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAiCoachNotes } from "@/lib/ai-api";
import { analyzeTranscript } from "@/lib/analysis";
import { downloadDriveFileToPath, upsertFileToDriveFolder } from "@/lib/google-drive";
import { processUploadedMedia } from "@/lib/media-processing";
import { publicErrorMessage } from "@/lib/security";
import {
  getAiSettings,
  getDriveSettings,
  getVideoEntry,
  listPendingDriveWorkerJobs,
  updateDriveWorkerSessionEntry,
  writeDriveWorkerJobStatus,
  type DriveWorkerJob,
} from "@/lib/storage";
import { transcribeWithLocalWhisper } from "@/lib/transcribers/localWhisper";
import type { AiSettings, VideoEntry } from "@/types/video";

loadEnvConfig(process.cwd());
process.env.APP_STORAGE_DRIVER = "drive";

const audioExtensions = new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav"]);
const cacheRoot = path.resolve(process.cwd(), process.env.APP_WORKER_CACHE_DIR || path.join("data", "worker-cache"));

type CliOptions = {
  force: boolean;
  limit: number;
  once: boolean;
  pollMs: number;
  skipTranscription: boolean;
};

type ProcessedArtifacts = {
  analysisPath?: string;
  audioPath: string;
  compressedPath?: string;
  transcriptPath?: string;
};

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const valueAfter = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const limit = Number(valueAfter("--limit") ?? 20);
  const pollSeconds = Number(valueAfter("--poll-seconds") ?? 60);

  return {
    force: args.includes("--force"),
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20,
    once: args.includes("--once"),
    pollMs: (Number.isFinite(pollSeconds) && pollSeconds > 0 ? pollSeconds : 60) * 1000,
    skipTranscription: args.includes("--skip-transcription"),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionForEntry(entry: VideoEntry) {
  const sourceName = entry.driveFileName || entry.sourceFileName || entry.originalFileName || "original.mp4";
  const extension = path.extname(sourceName).toLowerCase();

  if (extension) {
    return extension;
  }

  return entry.mimeType.startsWith("audio/") ? ".m4a" : ".mp4";
}

function isVideoEntry(entry: VideoEntry) {
  const extension = extensionForEntry(entry);
  return !entry.mimeType.startsWith("audio/") && !audioExtensions.has(extension);
}

function ensureCacheDir(sessionId: string) {
  const sessionCache = path.resolve(cacheRoot, sessionId);

  if (!sessionCache.startsWith(`${cacheRoot}${path.sep}`)) {
    throw new Error("Ruta de cache del worker invalida.");
  }

  return sessionCache;
}

async function resetCacheDir(sessionId: string) {
  const sessionCache = ensureCacheDir(sessionId);
  await fs.rm(sessionCache, { recursive: true, force: true });
  await fs.mkdir(sessionCache, { recursive: true });
  return sessionCache;
}

function shouldSkip(entry: VideoEntry, force: boolean) {
  if (force) {
    return false;
  }

  return entry.workerStatus === "done" && entry.processingStatus === "ready";
}

function shouldRunAiCoach(settings: AiSettings) {
  if (!settings.transcriptAnalysisEnabled) {
    return false;
  }

  if (settings.providerKind === "ollama" || settings.authMode === "none") {
    return true;
  }

  return Boolean(settings.apiKeyEnvVar && process.env[settings.apiKeyEnvVar]);
}

async function writeTextFile(filePath: string, content: string) {
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

async function uploadArtifacts({
  artifacts,
  folderId,
}: {
  artifacts: ProcessedArtifacts;
  folderId: string;
}) {
  const [compressed, audio, transcript, analysis] = await Promise.all([
    artifacts.compressedPath
      ? upsertFileToDriveFolder({
          fileName: "compressed.mp4",
          filePath: artifacts.compressedPath,
          mimeType: "video/mp4",
          parentId: folderId,
        })
      : Promise.resolve(null),
    upsertFileToDriveFolder({
      fileName: "audio.m4a",
      filePath: artifacts.audioPath,
      mimeType: "audio/mp4",
      parentId: folderId,
    }),
    artifacts.transcriptPath
      ? upsertFileToDriveFolder({
          fileName: "transcript.txt",
          filePath: artifacts.transcriptPath,
          mimeType: "text/plain",
          parentId: folderId,
        })
      : Promise.resolve(null),
    artifacts.analysisPath
      ? upsertFileToDriveFolder({
          fileName: "analysis.json",
          filePath: artifacts.analysisPath,
          mimeType: "application/json",
          parentId: folderId,
        })
      : Promise.resolve(null),
  ]);

  return { analysis, audio, compressed, transcript };
}

async function processJob(job: DriveWorkerJob, options: CliOptions) {
  const entry = await getVideoEntry(job.id);

  if (!entry) {
    await writeDriveWorkerJobStatus({
      error: "Sesion no encontrada.",
      id: job.id,
      status: "error",
    });
    console.warn(`[worker] ${job.id}: sesion no encontrada`);
    return;
  }

  if (shouldSkip(entry, options.force)) {
    await writeDriveWorkerJobStatus({
      id: entry.id,
      originalFileId: job.originalFileId || entry.driveOriginalFileId || entry.driveFileId,
      sessionFolderId: job.sessionFolderId || entry.driveFolderId,
      status: "done",
    });
    console.log(`[worker] ${entry.id}: ya estaba lista`);
    return;
  }

  const originalFileId = job.originalFileId || entry.driveOriginalFileId || entry.driveFileId;
  const sessionFolderId = job.sessionFolderId || entry.driveFolderId;

  if (!originalFileId || !sessionFolderId) {
    throw new Error("Falta el ID del original o de la carpeta de sesion en Drive.");
  }

  const now = new Date().toISOString();
  await updateDriveWorkerSessionEntry(entry.id, {
    processingError: undefined,
    processingStatus: "pending",
    transcriptError: "",
    transcriptStatus: options.skipTranscription ? "idle" : "processing",
    workerError: undefined,
    workerStatus: "processing",
    workerUpdatedAt: now,
  });
  await writeDriveWorkerJobStatus({
    id: entry.id,
    originalFileId,
    sessionFolderId,
    status: "processing",
  });

  try {
    const cacheDir = await resetCacheDir(entry.id);
    const originalPath = path.join(cacheDir, `original${extensionForEntry(entry)}`);
    const driveSettings = await getDriveSettings();
    const aiSettings = await getAiSettings();

    console.log(`[worker] ${entry.id}: descargando original`);
    await downloadDriveFileToPath({ fileId: originalFileId, filePath: originalPath });

    console.log(`[worker] ${entry.id}: procesando media con FFmpeg`);
    const isVideo = isVideoEntry(entry);
    const processed = await processUploadedMedia({
      audioFileName: "audio.m4a",
      isVideo,
      settings: driveSettings,
      sourceFileName: path.basename(originalPath),
      sourcePath: originalPath,
      uploadDir: cacheDir,
      videoFileName: "compressed.mp4",
    });

    if (processed.processingStatus !== "ready") {
      throw new Error(processed.processingError || "FFmpeg no pudo procesar la sesion.");
    }

    const audioPath = path.join(cacheDir, "audio.m4a");
    const compressedPath = isVideo ? path.join(cacheDir, "compressed.mp4") : undefined;
    let transcript = entry.transcript;
    let transcriptPath: string | undefined;
    let analysisPath: string | undefined;
    let aiCoachNotes = entry.aiCoachNotes;
    let aiError: string | undefined;

    if (!options.skipTranscription) {
      console.log(`[worker] ${entry.id}: transcribiendo con Whisper local`);
      transcript = await transcribeWithLocalWhisper(audioPath);
      transcriptPath = await writeTextFile(path.join(cacheDir, "transcript.txt"), `${transcript}\n`);
    }

    const analysis = transcript.trim() ? analyzeTranscript(transcript) : entry.analysis;

    if (analysis && transcript.trim()) {
      if (shouldRunAiCoach(aiSettings)) {
        try {
          console.log(`[worker] ${entry.id}: analizando con ${aiSettings.providerName}`);
          aiCoachNotes =
            (await getAiCoachNotes({ ...entry, transcript }, analysis, aiSettings)) ?? aiCoachNotes;
        } catch (error) {
          aiError = publicErrorMessage(error, "No se pudo completar el analisis IA local/API.");
          console.warn(`[worker] ${entry.id}: ${aiError}`);
        }
      }

      analysisPath = await writeTextFile(
        path.join(cacheDir, "analysis.json"),
        `${JSON.stringify({ analysis, aiCoachNotes: aiCoachNotes ?? null }, null, 2)}\n`,
      );
    }

    console.log(`[worker] ${entry.id}: subiendo artifacts a Drive`);
    const uploaded = await uploadArtifacts({
      artifacts: { analysisPath, audioPath, compressedPath, transcriptPath },
      folderId: sessionFolderId,
    });
    const completedAt = new Date().toISOString();

    await updateDriveWorkerSessionEntry(entry.id, {
      aiCoachNotes,
      analysis,
      audioFileName: "audio.m4a",
      audioSize: processed.audioSize || undefined,
      audioUrl: uploaded.audio.webViewLink,
      compressedSize: processed.compressedSize,
      driveAnalysisFileId: uploaded.analysis?.fileId,
      driveAudioFileId: uploaded.audio.fileId,
      driveCompressedFileId: uploaded.compressed?.fileId,
      driveError: undefined,
      driveFileId: uploaded.compressed?.fileId ?? uploaded.audio.fileId,
      driveFileName: uploaded.compressed?.fileName ?? uploaded.audio.fileName,
      driveStatus: "uploaded",
      driveTranscriptFileId: uploaded.transcript?.fileId,
      driveWebViewLink: uploaded.compressed?.webViewLink ?? uploaded.audio.webViewLink ?? entry.driveWebViewLink,
      processingError: undefined,
      processingStatus: "ready",
      sourceFileName: entry.sourceFileName || entry.driveFileName || entry.originalFileName,
      storedFileName: isVideo ? "compressed.mp4" : "audio.m4a",
      transcript,
      transcriptError: aiError,
      transcriptProvider: options.skipTranscription ? entry.transcriptProvider : "local",
      transcriptStatus: transcript.trim() ? "ready" : "idle",
      workerError: aiError,
      workerStatus: "done",
      workerUpdatedAt: completedAt,
    });
    await writeDriveWorkerJobStatus({
      id: entry.id,
      originalFileId,
      sessionFolderId,
      status: "done",
    });

    console.log(`[worker] ${entry.id}: listo`);
  } catch (error) {
    const message = publicErrorMessage(
      error,
      error instanceof Error ? error.message : "No se pudo procesar la sesion.",
    );

    await updateDriveWorkerSessionEntry(entry.id, {
      processingError: message,
      processingStatus: "error",
      transcriptError: message,
      transcriptStatus: "error",
      workerError: message,
      workerStatus: "error",
      workerUpdatedAt: new Date().toISOString(),
    });
    await writeDriveWorkerJobStatus({
      error: message,
      id: entry.id,
      originalFileId,
      sessionFolderId,
      status: "error",
    });
    console.error(`[worker] ${entry.id}: ${message}`);
  }
}

async function runOnce(options: CliOptions) {
  const jobs = await listPendingDriveWorkerJobs();
  const runnable = jobs.filter((job) =>
    options.force ? true : ["pending-processing", "pending", "processing"].includes(job.status),
  );
  const selected = runnable.slice(0, options.limit);

  if (selected.length === 0) {
    console.log("[worker] no hay jobs pendientes");
    return;
  }

  console.log(`[worker] ${selected.length} job(s) pendiente(s)`);

  for (const job of selected) {
    await processJob(job, options);
  }
}

async function main() {
  const options = parseCliOptions();

  do {
    await runOnce(options);

    if (options.once) {
      break;
    }

    await sleep(options.pollMs);
  } while (true);
}

main().catch((error) => {
  console.error(publicErrorMessage(error, error instanceof Error ? error.message : "Worker local fallido."));
  process.exitCode = 1;
});
