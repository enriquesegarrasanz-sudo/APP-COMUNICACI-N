import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultAiSettings, defaultDriveSettings, getAiSettingsPreset } from "@/lib/ai-defaults";
import { uploadFileToDrive } from "@/lib/google-drive";
import { processUploadedMedia } from "@/lib/media-processing";
import { PublicError } from "@/lib/security";
import type {
  AiSettings,
  AiSettingsStatus,
  AppDatabase,
  DriveSettings,
  DriveSettingsStatus,
  VideoEntry,
} from "@/types/video";

const dataDir = path.join(process.cwd(), "data");
const uploadDir = path.join(process.cwd(), "public", "uploads");
const appFile = path.join(dataDir, "app.json");
const uploadRoot = path.resolve(uploadDir);

const textLimits = {
  title: 120,
  topic: 180,
  notes: 5000,
  transcript: 200000,
  tag: 40,
  tagsRaw: 500,
  fileName: 180,
  providerName: 80,
  baseUrl: 300,
  endpoint: 160,
  model: 120,
  envVar: 64,
  queryParam: 80,
  applicationContext: 4000,
  driveFolderId: 180,
};

const allowedMediaExtensions = new Set([
  ".aac",
  ".avi",
  ".m4a",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".wav",
  ".webm",
]);

const audioExtensions = new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav"]);

let databaseQueue = Promise.resolve();

function defaultDatabase(): AppDatabase {
  return { videos: [], aiSettings: defaultAiSettings, driveSettings: defaultDriveSettings };
}

function isStoreUnavailableError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return code === "ENOENT" || code === "EROFS" || code === "EACCES" || code === "EPERM";
}

function withDatabaseLock<T>(operation: () => Promise<T>) {
  const queued = databaseQueue.then(operation, operation);
  databaseQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

async function ensureDatabaseFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(appFile);
  } catch {
    await fs.writeFile(appFile, JSON.stringify(defaultDatabase(), null, 2), "utf8");
  }
}

async function ensureStore() {
  await ensureDatabaseFile();
  await fs.mkdir(uploadDir, { recursive: true });
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = numberOrDefault(value, fallback);
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function validationError(message: string, strict: boolean) {
  if (strict) {
    throw new PublicError(message);
  }
}

function boundedStringOrDefault(
  value: unknown,
  fallback: string,
  maxLength: number,
  fieldName: string,
  strict = false,
) {
  const text = stringOrDefault(value, fallback);

  if (text.length > maxLength) {
    validationError(`${fieldName} debe tener ${maxLength} caracteres o menos.`, strict);
    return fallback;
  }

  return text;
}

function requiredText(value: unknown, fallback: string, maxLength: number, fieldName: string) {
  const text = String(value || fallback).trim();

  if (text.length > maxLength) {
    throw new PublicError(`${fieldName} debe tener ${maxLength} caracteres o menos.`);
  }

  return text || fallback;
}

function optionalText(value: unknown, maxLength: number, fieldName: string) {
  const text = typeof value === "string" ? value.trim() : "";

  if (text.length > maxLength) {
    throw new PublicError(`${fieldName} debe tener ${maxLength} caracteres o menos.`);
  }

  return text;
}

function normalizeEnvVar(value: unknown, fallback: string, fieldName: string, strict = false) {
  const text = boundedStringOrDefault(value, fallback, textLimits.envVar, fieldName, strict);

  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(text)) {
    validationError(`${fieldName} debe ser un nombre de variable de entorno valido.`, strict);
    return fallback;
  }

  return text;
}

function normalizeAiSettings(value: unknown): AiSettings {
  const input = value && typeof value === "object" ? (value as Partial<AiSettings>) : {};
  const preset = getAiSettingsPreset(input.providerKind ?? defaultAiSettings.providerKind, input.analysisModel);

  return {
    ...preset,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
  };
}

function normalizeDriveSettings(value: unknown, strict = false): DriveSettings {
  const input = value && typeof value === "object" ? (value as Partial<DriveSettings>) : {};

  return {
    enabled: booleanOrDefault(input.enabled, defaultDriveSettings.enabled),
    folderId: boundedStringOrDefault(
      input.folderId,
      defaultDriveSettings.folderId,
      textLimits.driveFolderId,
      "ID de carpeta Drive",
      strict,
    ),
    serviceAccountEmailEnvVar: normalizeEnvVar(
      input.serviceAccountEmailEnvVar,
      defaultDriveSettings.serviceAccountEmailEnvVar,
      "Variable del email de service account",
      strict,
    ),
    serviceAccountPrivateKeyEnvVar: normalizeEnvVar(
      input.serviceAccountPrivateKeyEnvVar,
      defaultDriveSettings.serviceAccountPrivateKeyEnvVar,
      "Variable de private key de service account",
      strict,
    ),
    compressionCrf: numberInRange(input.compressionCrf, defaultDriveSettings.compressionCrf, 18, 35),
    audioBitrateKbps: numberInRange(input.audioBitrateKbps, defaultDriveSettings.audioBitrateKbps, 24, 160),
    deleteOriginalAfterProcessing: booleanOrDefault(
      input.deleteOriginalAfterProcessing,
      defaultDriveSettings.deleteOriginalAfterProcessing,
    ),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
  };
}

async function readDatabase(): Promise<AppDatabase> {
  try {
    await ensureDatabaseFile();
  } catch (error) {
    if (isStoreUnavailableError(error)) {
      return defaultDatabase();
    }

    throw error;
  }

  let raw: string;

  try {
    raw = await fs.readFile(appFile, "utf8");
  } catch (error) {
    if (isStoreUnavailableError(error)) {
      return defaultDatabase();
    }

    throw error;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppDatabase>;
    return {
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
      aiSettings: normalizeAiSettings(parsed.aiSettings),
      driveSettings: normalizeDriveSettings(parsed.driveSettings),
    };
  } catch {
    return defaultDatabase();
  }
}

async function writeDatabase(database: AppDatabase) {
  try {
    await ensureDatabaseFile();
    await fs.writeFile(appFile, JSON.stringify(database, null, 2), "utf8");
  } catch (error) {
    if (isStoreUnavailableError(error)) {
      throw new PublicError("No se pudo guardar en el almacenamiento local de esta ejecucion.");
    }

    throw error;
  }
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120)
    .toLowerCase();

  return cleaned || "media";
}

function normalizeDate(value: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date().toISOString().slice(0, 10);
}

function parseTags(value: string | null) {
  if (!value) {
    return [];
  }

  if (value.length > textLimits.tagsRaw) {
    throw new PublicError(`Etiquetas debe tener ${textLimits.tagsRaw} caracteres o menos.`);
  }

  return value
    .split(",")
    .map((tag) => tag.trim().slice(0, textLimits.tag))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizePatchTags(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((tag) => String(tag).trim().slice(0, textLimits.tag))
    .filter(Boolean)
    .slice(0, 8);
}

function maxUploadSizeBytes() {
  const configuredMb = Number(process.env.APP_MAX_UPLOAD_MB);
  const safeMb = Number.isFinite(configuredMb) && configuredMb > 0 ? Math.min(configuredMb, 5120) : 1024;
  return safeMb * 1024 * 1024;
}

function uploadLimitMessage(maxBytes: number) {
  return `${Math.round(maxBytes / (1024 * 1024))} MB`;
}

function assertAllowedMedia(file: File, originalFileName: string) {
  const extension = path.extname(originalFileName).toLowerCase();
  const mimeAllowed = file.type.startsWith("video/") || file.type.startsWith("audio/");
  const extensionAllowed = !extension || allowedMediaExtensions.has(extension);

  if (!mimeAllowed && !extensionAllowed) {
    throw new PublicError("El archivo debe ser de video o audio.");
  }

  if (!extensionAllowed) {
    throw new PublicError("La extension del archivo no esta permitida.");
  }

  const maxBytes = maxUploadSizeBytes();

  if (file.size > maxBytes) {
    throw new PublicError(`El archivo supera el limite de ${uploadLimitMessage(maxBytes)}.`);
  }
}

function safeUploadPath(fileName: string) {
  if (!fileName || fileName !== path.basename(fileName)) {
    throw new PublicError("Nombre de archivo local invalido.");
  }

  const resolved = path.resolve(uploadDir, fileName);

  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new PublicError("Ruta de archivo local invalida.");
  }

  return resolved;
}

export function sanitizeVideoPatch(body: Partial<VideoEntry>): Partial<VideoEntry> {
  const patch: Partial<VideoEntry> = {};

  if (typeof body.titulo === "string") {
    patch.titulo = optionalText(body.titulo, textLimits.title, "Titulo");
  }

  if (typeof body.tema === "string") {
    patch.tema = optionalText(body.tema, textLimits.topic, "Tema");
  }

  if (typeof body.fecha === "string") {
    patch.fecha = normalizeDate(body.fecha);
  }

  const etiquetas = normalizePatchTags(body.etiquetas);

  if (etiquetas) {
    patch.etiquetas = etiquetas;
  }

  if (typeof body.notasMeGusto === "string") {
    patch.notasMeGusto = optionalText(body.notasMeGusto, textLimits.notes, "Notas de fortalezas");
  }

  if (typeof body.notasMejorar === "string") {
    patch.notasMejorar = optionalText(body.notasMejorar, textLimits.notes, "Notas de mejora");
  }

  if (typeof body.transcript === "string") {
    patch.transcript = optionalText(body.transcript, textLimits.transcript, "Transcripcion");
  }

  return patch;
}

export async function listVideoEntries() {
  const database = await readDatabase();
  return database.videos.toSorted((a, b) => b.numero - a.numero);
}

export async function getAiSettings() {
  const database = await readDatabase();
  return database.aiSettings;
}

export async function getAiSettingsStatus(): Promise<AiSettingsStatus> {
  const settings = await getAiSettings();

  return {
    ...settings,
    apiKeyConfigured: settings.authMode === "none" || Boolean(settings.apiKeyEnvVar && process.env[settings.apiKeyEnvVar]),
  };
}

export async function updateAiSettings(patch: Partial<AiSettings>) {
  return withDatabaseLock(async () => {
    const database = await readDatabase();
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<AiSettings>;
    const next = normalizeAiSettings({
      ...database.aiSettings,
      ...definedPatch,
      updatedAt: new Date().toISOString(),
    });

    database.aiSettings = next;
    await writeDatabase(database);
    return next;
  });
}

export async function getDriveSettings() {
  const database = await readDatabase();
  return database.driveSettings;
}

export async function getDriveSettingsStatus(): Promise<DriveSettingsStatus> {
  const settings = await getDriveSettings();
  const credentialsConfigured = Boolean(
    settings.serviceAccountEmailEnvVar &&
      process.env[settings.serviceAccountEmailEnvVar] &&
      settings.serviceAccountPrivateKeyEnvVar &&
      process.env[settings.serviceAccountPrivateKeyEnvVar],
  );

  return {
    ...settings,
    credentialsConfigured,
    ready: settings.enabled && credentialsConfigured && settings.folderId.trim().length > 0,
  };
}

export async function updateDriveSettings(patch: Partial<DriveSettings>) {
  return withDatabaseLock(async () => {
    const database = await readDatabase();
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<DriveSettings>;
    const next = normalizeDriveSettings(
      {
        ...database.driveSettings,
        ...definedPatch,
        updatedAt: new Date().toISOString(),
      },
      true,
    );

    database.driveSettings = next;
    await writeDatabase(database);
    return next;
  });
}

export async function getVideoEntry(id: string) {
  const database = await readDatabase();
  return database.videos.find((video) => video.id === id) ?? null;
}

export function getVideoAbsolutePath(entry: VideoEntry) {
  return safeUploadPath(entry.storedFileName);
}

export function getTranscriptionMediaAbsolutePath(entry: VideoEntry) {
  return safeUploadPath(entry.audioFileName || entry.storedFileName);
}

export async function createVideoEntry(formData: FormData) {
  const file = formData.get("video");

  if (!(file instanceof File) || file.size === 0) {
    throw new PublicError("Selecciona un archivo de video valido.");
  }

  const nextFallbackName = "video";
  const rawFileName = String(file.name || nextFallbackName).trim();
  const originalFileName = requiredText(rawFileName, nextFallbackName, textLimits.fileName, "Nombre del archivo");
  assertAllowedMedia(file, originalFileName);

  await ensureStore();

  return withDatabaseLock(async () => {
    const database = await readDatabase();
    const nextNumber = database.videos.reduce((max, video) => Math.max(max, video.numero), 0) + 1;
    const id = crypto.randomUUID();
    const extension = path.extname(originalFileName).toLowerCase() || (file.type.startsWith("audio/") ? ".m4a" : ".mp4");
    const fileNameBase = `${String(nextNumber).padStart(3, "0")}-${id.slice(0, 8)}-${safeFileName(
      path.basename(originalFileName, extension),
    )}`;
    const sourceFileName = `${fileNameBase}-source${extension}`;
    const videoFileName = `${fileNameBase}-compressed.mp4`;
    const audioFileName = `${fileNameBase}-audio.m4a`;
    const destination = safeUploadPath(sourceFileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(destination, buffer);

    const isAudio = file.type.startsWith("audio/") || audioExtensions.has(extension);
    const isVideo = !isAudio;
    const processed = await processUploadedMedia({
      audioFileName,
      isVideo,
      settings: database.driveSettings,
      sourceFileName,
      sourcePath: destination,
      uploadDir,
      videoFileName,
    });
    let driveStatus: VideoEntry["driveStatus"] = database.driveSettings.enabled ? "skipped" : "disabled";
    let driveFileId: string | undefined;
    let driveFileName: string | undefined;
    let driveWebViewLink: string | undefined;
    let driveError: string | undefined;
    let driveUploadedAt: string | undefined;

    if (!isVideo) {
      driveStatus = "skipped";
    } else if (database.driveSettings.enabled && processed.processingStatus !== "ready") {
      driveStatus = "error";
      driveError = "No se subio a Drive porque fallo el procesamiento local.";
    } else if (database.driveSettings.enabled) {
      try {
        const driveFile = await uploadFileToDrive({
          fileName: processed.storedFileName,
          filePath: safeUploadPath(processed.storedFileName),
          mimeType: "video/mp4",
          settings: database.driveSettings,
        });

        driveStatus = "uploaded";
        driveFileId = driveFile.fileId;
        driveFileName = driveFile.fileName;
        driveWebViewLink = driveFile.webViewLink;
        driveUploadedAt = new Date().toISOString();
      } catch (error) {
        driveStatus = "error";
        driveError = error instanceof Error ? error.message : "No se pudo subir a Google Drive.";
      }
    }

    const now = new Date().toISOString();
    const entry: VideoEntry = {
      id,
      numero: nextNumber,
      titulo: requiredText(formData.get("titulo"), `Video ${nextNumber}`, textLimits.title, "Titulo"),
      tema: requiredText(formData.get("tema"), "Sin tema", textLimits.topic, "Tema"),
      fecha: normalizeDate(String(formData.get("fecha") || "")),
      etiquetas: parseTags(String(formData.get("etiquetas") || "")),
      videoUrl: `/uploads/${processed.storedFileName}`,
      originalFileName,
      storedFileName: processed.storedFileName,
      sourceFileName: processed.sourceFileName,
      audioFileName: processed.processingStatus === "ready" ? processed.audioFileName : undefined,
      audioUrl: processed.processingStatus === "ready" ? `/uploads/${processed.audioFileName}` : undefined,
      mimeType: file.type || (isVideo ? "video/mp4" : "audio/m4a"),
      size: file.size,
      compressedSize: processed.compressedSize,
      audioSize: processed.audioSize || undefined,
      processingStatus: processed.processingStatus,
      processingError: processed.processingError,
      driveStatus,
      driveFileId,
      driveFileName,
      driveWebViewLink,
      driveError,
      driveUploadedAt,
      notasMeGusto: optionalText(formData.get("notasMeGusto"), textLimits.notes, "Notas de fortalezas"),
      notasMejorar: optionalText(formData.get("notasMejorar"), textLimits.notes, "Notas de mejora"),
      transcript: "",
      transcriptStatus: "idle",
      createdAt: now,
      updatedAt: now,
    };

    database.videos.push(entry);
    await writeDatabase(database);
    return entry;
  });
}

export async function updateVideoEntry(id: string, patch: Partial<VideoEntry>) {
  return withDatabaseLock(async () => {
    const database = await readDatabase();
    const index = database.videos.findIndex((video) => video.id === id);

    if (index === -1) {
      return null;
    }

    const previous = database.videos[index];
    const next: VideoEntry = {
      ...previous,
      ...patch,
      id: previous.id,
      numero: previous.numero,
      videoUrl: previous.videoUrl,
      originalFileName: previous.originalFileName,
      storedFileName: previous.storedFileName,
      updatedAt: new Date().toISOString(),
    };

    if (patch.transcript && patch.transcript.trim().length > 0 && !patch.transcriptStatus) {
      next.transcriptStatus = "ready";
    }

    database.videos[index] = next;
    await writeDatabase(database);
    return next;
  });
}

export async function deleteVideoEntry(id: string) {
  return withDatabaseLock(async () => {
    const database = await readDatabase();
    const entry = database.videos.find((video) => video.id === id);

    if (!entry) {
      return false;
    }

    database.videos = database.videos.filter((video) => video.id !== id);
    await writeDatabase(database);

    const localFiles = new Set(
      [entry.storedFileName, entry.audioFileName, entry.sourceFileName].filter(
        (fileName): fileName is string => Boolean(fileName),
      ),
    );

    await Promise.all(
      [...localFiles].map(async (fileName) => {
        try {
          await fs.unlink(safeUploadPath(fileName));
        } catch {
          // The record can be removed even if a local media file is already missing.
        }
      }),
    );

    return true;
  });
}
