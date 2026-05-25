import { promises as fs } from "node:fs";
import path from "node:path";
import {
  defaultAiSettings,
  defaultDriveSettings,
  defaultOllamaStartCommand,
  defaultWhisperCommand,
  defaultWhisperModel,
  getAiSettingsPreset,
} from "@/lib/ai-defaults";
import {
  createDriveResumableUploadSession,
  deleteDriveFile,
  driveFolderMimeType,
  driveJsonMimeType,
  ensureDriveFolder,
  findDriveChild,
  getDriveFileMetadata,
  listDriveChildren,
  readDriveJsonFile,
  readDriveJsonFileByName,
  upsertDriveJsonFile,
  uploadFileToDrive,
} from "@/lib/google-drive";
import { getGoogleDriveAuthStatus } from "@/lib/google-drive-auth";
import { processUploadedMedia } from "@/lib/media-processing";
import { PublicError } from "@/lib/security";
import type {
  AiSettings,
  AiSettingsStatus,
  AppDatabase,
  DriveSettings,
  DriveSettingsStatus,
  StorageDriverName,
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
  localCommand: 260,
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
const driveSettingsCacheTtlMs = 30_000;
const driveVideoEntriesCacheTtlMs = 15_000;

type DriveIndex = {
  sessions: Array<{ id: string; numero: number; updatedAt: string }>;
  updatedAt: string;
};

type DriveSettingsFile = {
  aiSettings: AiSettings;
  driveSettings: DriveSettings;
  updatedAt: string;
};

type DriveStructure = {
  appDbFolderId: string;
  sessionsFolderId: string;
  jobsFolderId: string;
  pendingJobsFolderId: string;
  doneJobsFolderId: string;
};

type DriveSettingsRead = {
  settingsFile: DriveSettingsFile;
  structure: DriveStructure;
};

type TimedPromiseCache<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

let driveSettingsFileCache: TimedPromiseCache<DriveSettingsRead> | null = null;
let driveVideoEntriesCache: TimedPromiseCache<VideoEntry[]> | null = null;

export type DriveWorkerJob = {
  id: string;
  jobFileId: string;
  originalFileId?: string;
  sessionFolderId?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
};

export type DriveWorkerJobStatus = "pending-processing" | "processing" | "done" | "error";

export type PendingDriveUploadInput = {
  fecha?: string;
  titulo?: string;
  tema?: string;
  etiquetas?: string;
  notasMeGusto?: string;
  notasMejorar?: string;
  originalFileName: string;
  mimeType: string;
  size: number;
};

export type FinalizeDriveUploadInput =
  | {
      id: string;
      status: "uploaded";
      fileId?: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
      webViewLink?: string;
    }
  | {
      id: string;
      status: "error";
      error: string;
    };

function defaultDatabase(): AppDatabase {
  return { videos: [], aiSettings: defaultAiSettings, driveSettings: defaultDriveSettings };
}

export function getStorageDriverName(): StorageDriverName {
  return process.env.APP_STORAGE_DRIVER === "drive" ? "drive" : "local";
}

export function isDriveStorageDriver() {
  return getStorageDriverName() === "drive";
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

function invalidateDriveReadCaches({
  settings = false,
  videos = false,
  structure = false,
}: {
  settings?: boolean;
  videos?: boolean;
  structure?: boolean;
} = {}) {
  if (settings) {
    driveSettingsFileCache = null;
  }

  if (videos) {
    driveVideoEntriesCache = null;
  }

  if (structure) {
    driveStructureCache = null;
  }
}

async function cachedDriveRead<T>({
  cache,
  fresh,
  load,
  ttlMs,
  update,
}: {
  cache: TimedPromiseCache<T> | null;
  fresh?: boolean;
  load: () => Promise<T>;
  ttlMs: number;
  update: (next: TimedPromiseCache<T> | null) => void;
}) {
  const now = Date.now();

  if (!fresh && cache && cache.expiresAt > now) {
    return cache.promise;
  }

  const next: TimedPromiseCache<T> = {
    expiresAt: now + ttlMs,
    promise: load(),
  };

  update(next);

  try {
    return await next.promise;
  } catch (error) {
    update(null);
    throw error;
  }
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

function normalizeAiSettings(value: unknown): AiSettings {
  const input = value && typeof value === "object" ? (value as Partial<AiSettings>) : {};
  const preset = getAiSettingsPreset(input.providerKind ?? defaultAiSettings.providerKind, input.analysisModel);

  return {
    ...preset,
    providerName: boundedStringOrDefault(input.providerName, preset.providerName, textLimits.providerName, "Proveedor IA"),
    baseUrl: boundedStringOrDefault(input.baseUrl, preset.baseUrl, textLimits.baseUrl, "URL del proveedor"),
    chatEndpoint: boundedStringOrDefault(input.chatEndpoint, preset.chatEndpoint, textLimits.endpoint, "Endpoint de chat"),
    transcriptionEndpoint: boundedStringOrDefault(
      input.transcriptionEndpoint,
      preset.transcriptionEndpoint,
      textLimits.endpoint,
      "Endpoint de transcripcion",
    ),
    authMode: input.authMode ?? preset.authMode,
    apiKeyEnvVar: boundedStringOrDefault(input.apiKeyEnvVar, preset.apiKeyEnvVar, textLimits.envVar, "Variable API key"),
    apiKeyQueryParam: boundedStringOrDefault(
      input.apiKeyQueryParam,
      preset.apiKeyQueryParam,
      textLimits.queryParam,
      "Parametro API key",
    ),
    transcriptionModel: boundedStringOrDefault(
      input.transcriptionModel,
      preset.transcriptionModel,
      textLimits.model,
      "Modelo de transcripcion",
    ),
    analysisModel: boundedStringOrDefault(input.analysisModel, preset.analysisModel, textLimits.model, "Modelo de analisis"),
    visionModel: boundedStringOrDefault(input.visionModel, preset.visionModel, textLimits.model, "Modelo de vision"),
    ollamaStartCommand: boundedStringOrDefault(
      input.ollamaStartCommand,
      defaultOllamaStartCommand,
      textLimits.localCommand,
      "Comando de Ollama",
    ),
    whisperCommand: boundedStringOrDefault(
      input.whisperCommand,
      process.env.WHISPER_COMMAND || defaultWhisperCommand,
      textLimits.localCommand,
      "Comando de Whisper",
    ),
    whisperModel: boundedStringOrDefault(
      input.whisperModel,
      process.env.WHISPER_MODEL || defaultWhisperModel,
      textLimits.model,
      "Modelo de Whisper",
    ),
    transcriptionEnabled: booleanOrDefault(input.transcriptionEnabled, preset.transcriptionEnabled),
    transcriptAnalysisEnabled: booleanOrDefault(input.transcriptAnalysisEnabled, preset.transcriptAnalysisEnabled),
    videoAnalysisEnabled: booleanOrDefault(input.videoAnalysisEnabled, preset.videoAnalysisEnabled),
    historyContextEnabled: booleanOrDefault(input.historyContextEnabled, preset.historyContextEnabled),
    applicationContext: boundedStringOrDefault(
      input.applicationContext,
      preset.applicationContext,
      textLimits.applicationContext,
      "Contexto de aplicacion",
    ),
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

function driveRootFolderId(settings: DriveSettings) {
  return (
    process.env.APP_DRIVE_ROOT_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
    settings.folderId
  ).trim();
}

async function getDriveBootstrapSettings() {
  const localDatabase = await readDatabase();
  const folderId = driveRootFolderId(localDatabase.driveSettings || defaultDriveSettings);

  if (!folderId) {
    throw new PublicError("Falta APP_DRIVE_ROOT_FOLDER_ID o el ID de carpeta Drive.");
  }

  return normalizeDriveSettings({
    ...defaultDriveSettings,
    ...localDatabase.driveSettings,
    enabled: true,
    folderId,
  });
}

const driveStructureCacheTtlMs = 5 * 60_000;
let driveStructureCache: TimedPromiseCache<DriveStructure> | null = null;

async function ensureDriveStructure(settings?: DriveSettings): Promise<DriveStructure> {
  const now = Date.now();

  if (driveStructureCache && driveStructureCache.expiresAt > now) {
    return driveStructureCache.promise;
  }

  const promise = buildDriveStructure(settings);
  driveStructureCache = { expiresAt: now + driveStructureCacheTtlMs, promise };

  try {
    return await promise;
  } catch (error) {
    driveStructureCache = null;
    throw error;
  }
}

async function buildDriveStructure(settings?: DriveSettings): Promise<DriveStructure> {
  const bootstrap = settings ?? (await getDriveBootstrapSettings());
  const rootFolderId = driveRootFolderId(bootstrap);

  if (!rootFolderId) {
    throw new PublicError("Falta el ID de carpeta raiz de Google Drive.");
  }

  const appDbFolder = await ensureDriveFolder({ parentId: rootFolderId, name: "app-db" });
  const [sessionsFolder, jobsFolder] = await Promise.all([
    ensureDriveFolder({ parentId: appDbFolder.fileId, name: "sessions" }),
    ensureDriveFolder({ parentId: appDbFolder.fileId, name: "jobs" }),
  ]);
  const [pendingJobsFolder, doneJobsFolder] = await Promise.all([
    ensureDriveFolder({ parentId: jobsFolder.fileId, name: "pending" }),
    ensureDriveFolder({ parentId: jobsFolder.fileId, name: "done" }),
  ]);

  return {
    appDbFolderId: appDbFolder.fileId,
    sessionsFolderId: sessionsFolder.fileId,
    jobsFolderId: jobsFolder.fileId,
    pendingJobsFolderId: pendingJobsFolder.fileId,
    doneJobsFolderId: doneJobsFolder.fileId,
  };
}

function defaultDriveIndex(): DriveIndex {
  return { sessions: [], updatedAt: new Date().toISOString() };
}

function normalizeDriveIndex(value: unknown): DriveIndex {
  const input = value && typeof value === "object" ? (value as Partial<DriveIndex>) : {};
  const sessions = Array.isArray(input.sessions)
    ? input.sessions
        .map((session) => ({
          id: typeof session.id === "string" ? session.id : "",
          numero: numberOrDefault(session.numero, 0),
          updatedAt: typeof session.updatedAt === "string" ? session.updatedAt : "",
        }))
        .filter((session) => session.id && session.numero > 0)
    : [];

  return {
    sessions,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
  };
}

async function readDriveIndex(structure: DriveStructure) {
  const stored = await readDriveJsonFileByName<DriveIndex>({
    parentId: structure.appDbFolderId,
    name: "index.json",
  });

  if (!stored) {
    const index = defaultDriveIndex();
    await upsertDriveJsonFile({ parentId: structure.appDbFolderId, name: "index.json", value: index });
    return index;
  }

  return normalizeDriveIndex(stored.value);
}

async function writeDriveIndex(structure: DriveStructure, index: DriveIndex) {
  await upsertDriveJsonFile({
    parentId: structure.appDbFolderId,
    name: "index.json",
    value: { ...index, updatedAt: new Date().toISOString() },
  });
  invalidateDriveReadCaches({ videos: true });
}

function defaultDriveSettingsFile(settings: DriveSettings): DriveSettingsFile {
  return {
    aiSettings: defaultAiSettings,
    driveSettings: settings,
    updatedAt: new Date().toISOString(),
  };
}

async function loadDriveSettingsFile(): Promise<DriveSettingsRead> {
  const bootstrap = await getDriveBootstrapSettings();
  const structure = await ensureDriveStructure(bootstrap);
  const stored = await readDriveJsonFileByName<Partial<DriveSettingsFile>>({
    parentId: structure.appDbFolderId,
    name: "settings.json",
  });

  if (!stored) {
    const settingsFile = defaultDriveSettingsFile(bootstrap);
    await upsertDriveJsonFile({ parentId: structure.appDbFolderId, name: "settings.json", value: settingsFile });
    return { settingsFile, structure };
  }

  const settingsFile: DriveSettingsFile = {
    aiSettings: normalizeAiSettings(stored.value.aiSettings),
    driveSettings: normalizeDriveSettings({
      ...bootstrap,
      ...stored.value.driveSettings,
      enabled: true,
      folderId: driveRootFolderId((stored.value.driveSettings as DriveSettings | undefined) ?? bootstrap),
    }),
    updatedAt: typeof stored.value.updatedAt === "string" ? stored.value.updatedAt : new Date().toISOString(),
  };

  return { settingsFile, structure };
}

async function readDriveSettingsFile(options: { fresh?: boolean } = {}) {
  return cachedDriveRead({
    cache: driveSettingsFileCache,
    fresh: options.fresh,
    load: loadDriveSettingsFile,
    ttlMs: driveSettingsCacheTtlMs,
    update: (next) => {
      driveSettingsFileCache = next;
    },
  });
}

async function writeDriveSettingsFile(patch: {
  aiSettings?: Partial<AiSettings>;
  driveSettings?: Partial<DriveSettings>;
}) {
  const { settingsFile, structure } = await readDriveSettingsFile();
  const next: DriveSettingsFile = {
    aiSettings: patch.aiSettings ? normalizeAiSettings(patch.aiSettings) : settingsFile.aiSettings,
    driveSettings: patch.driveSettings
      ? normalizeDriveSettings({ ...settingsFile.driveSettings, ...patch.driveSettings, enabled: true }, true)
      : settingsFile.driveSettings,
    updatedAt: new Date().toISOString(),
  };

  await upsertDriveJsonFile({ parentId: structure.appDbFolderId, name: "settings.json", value: next });
  invalidateDriveReadCaches({ settings: true, videos: true });
  return next;
}

async function ensureDriveSessionFolder(structure: DriveStructure, id: string) {
  return ensureDriveFolder({ parentId: structure.sessionsFolderId, name: id });
}

async function readDriveSessionById(id: string, knownStructure?: DriveStructure): Promise<VideoEntry | null> {
  const structure = knownStructure ?? (await readDriveSettingsFile()).structure;
  const folder = await findDriveChild({
    parentId: structure.sessionsFolderId,
    name: id,
    mimeType: driveFolderMimeType,
  });

  if (!folder) {
    return null;
  }

  const stored = await readDriveJsonFileByName<VideoEntry>({ parentId: folder.fileId, name: "session.json" });

  if (!stored) {
    return null;
  }

  return {
    ...stored.value,
    driveFolderId: stored.value.driveFolderId ?? folder.fileId,
    driveSessionFolderId: folder.fileId,
    driveSessionJsonFileId: stored.file.fileId,
    storageDriver: "drive" as const,
  };
}

function normalizeDriveWorkerJob(file: { fileId: string }, value: unknown): DriveWorkerJob | null {
  const input = value && typeof value === "object" ? (value as Partial<DriveWorkerJob>) : {};
  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : "";

  if (!id) {
    return null;
  }

  return {
    id,
    jobFileId: file.fileId,
    originalFileId: typeof input.originalFileId === "string" ? input.originalFileId : undefined,
    sessionFolderId: typeof input.sessionFolderId === "string" ? input.sessionFolderId : undefined,
    status: typeof input.status === "string" ? input.status : "pending-processing",
    createdAt: typeof input.createdAt === "string" ? input.createdAt : undefined,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
    error: typeof input.error === "string" ? input.error : undefined,
  };
}

export async function listPendingDriveWorkerJobs() {
  if (!isDriveStorageDriver()) {
    throw new PublicError("El worker local necesita APP_STORAGE_DRIVER=drive.");
  }

  const { structure } = await readDriveSettingsFile();
  const files = await listDriveChildren({
    parentId: structure.pendingJobsFolderId,
    mimeType: driveJsonMimeType,
  });
  const jobs = await Promise.all(
    files.map(async (file) => {
      try {
        const value = await readDriveJsonFile<unknown>({ fileId: file.fileId });
        return normalizeDriveWorkerJob(file, value);
      } catch {
        return null;
      }
    }),
  );

  return jobs.filter((job): job is DriveWorkerJob => Boolean(job));
}

export async function writeDriveWorkerJobStatus({
  error,
  id,
  originalFileId,
  sessionFolderId,
  status,
}: {
  error?: string;
  id: string;
  originalFileId?: string;
  sessionFolderId?: string;
  status: DriveWorkerJobStatus;
}) {
  if (!isDriveStorageDriver()) {
    throw new PublicError("El worker local necesita APP_STORAGE_DRIVER=drive.");
  }

  const { structure } = await readDriveSettingsFile();
  const now = new Date().toISOString();
  const value = {
    id,
    originalFileId,
    sessionFolderId,
    status,
    error,
    updatedAt: now,
  };

  if (status === "done") {
    await upsertDriveJsonFile({
      parentId: structure.doneJobsFolderId,
      name: `${id}.json`,
      value,
    });
    const pending = await findDriveChild({
      parentId: structure.pendingJobsFolderId,
      name: `${id}.json`,
      mimeType: driveJsonMimeType,
    });

    if (pending) {
      await deleteDriveFile(pending.fileId);
    }

    return;
  }

  await upsertDriveJsonFile({
    parentId: structure.pendingJobsFolderId,
    name: `${id}.json`,
    value,
  });
}

export async function updateDriveWorkerSessionEntry(id: string, patch: Partial<VideoEntry>) {
  if (!isDriveStorageDriver()) {
    throw new PublicError("El worker local necesita APP_STORAGE_DRIVER=drive.");
  }

  const { structure } = await readDriveSettingsFile();
  const previous = await readDriveSessionById(id);

  if (!previous) {
    return null;
  }

  const next: VideoEntry = {
    ...previous,
    ...patch,
    id: previous.id,
    numero: previous.numero,
    storageDriver: "drive",
    updatedAt: new Date().toISOString(),
  };

  await writeDriveSession(next, structure, next.driveFolderId);
  await upsertDriveIndexEntry(next, structure);
  return next;
}

async function writeDriveSession(entry: VideoEntry, structure: DriveStructure, sessionFolderId?: string) {
  const folderId = sessionFolderId ?? entry.driveFolderId;

  if (!folderId) {
    throw new PublicError("Falta la carpeta Drive de la sesion.");
  }

  await upsertDriveJsonFile({
    parentId: folderId,
    name: "session.json",
    value: {
      ...entry,
      driveFolderId: folderId,
      driveSessionFolderId: folderId,
      storageDriver: "drive",
    },
  });
  invalidateDriveReadCaches({ videos: true });
}

async function upsertDriveIndexEntry(entry: VideoEntry, structure: DriveStructure) {
  const index = await readDriveIndex(structure);
  const nextSessions = index.sessions.filter((session) => session.id !== entry.id);
  nextSessions.push({ id: entry.id, numero: entry.numero, updatedAt: entry.updatedAt });
  nextSessions.sort((a, b) => a.numero - b.numero);
  await writeDriveIndex(structure, { sessions: nextSessions, updatedAt: new Date().toISOString() });
}

async function loadDriveVideoEntries(): Promise<VideoEntry[]> {
  const { structure } = await readDriveSettingsFile();
  const index = await readDriveIndex(structure);
  const entries = await Promise.all(index.sessions.map((session) => readDriveSessionById(session.id, structure)));

  return entries
    .filter((entry): entry is VideoEntry => Boolean(entry))
    .toSorted((a, b) => b.numero - a.numero);
}

async function listDriveVideoEntries(options: { fresh?: boolean } = {}): Promise<VideoEntry[]> {
  return cachedDriveRead({
    cache: driveVideoEntriesCache,
    fresh: options.fresh,
    load: loadDriveVideoEntries,
    ttlMs: driveVideoEntriesCacheTtlMs,
    update: (next) => {
      driveVideoEntriesCache = next;
    },
  });
}

function originalDriveFileName(originalFileName: string, mimeType: string) {
  const fallbackExtension = mimeType.startsWith("audio/") ? ".m4a" : ".mp4";
  const extension = path.extname(originalFileName).toLowerCase() || fallbackExtension;
  return `original${allowedMediaExtensions.has(extension) ? extension : fallbackExtension}`;
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
  assertAllowedMediaMetadata({
    mimeType: file.type,
    originalFileName,
    size: file.size,
  });
}

function assertAllowedMediaMetadata({
  mimeType,
  originalFileName,
  size,
}: {
  mimeType: string;
  originalFileName: string;
  size: number;
}) {
  const extension = path.extname(originalFileName).toLowerCase();
  const mimeAllowed = mimeType.startsWith("video/") || mimeType.startsWith("audio/");
  const extensionAllowed = !extension || allowedMediaExtensions.has(extension);

  if (!mimeAllowed && !extensionAllowed) {
    throw new PublicError("El archivo debe ser de video o audio.");
  }

  if (!extensionAllowed) {
    throw new PublicError("La extension del archivo no esta permitida.");
  }

  const maxBytes = maxUploadSizeBytes();

  if (size > maxBytes) {
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
  if (isDriveStorageDriver()) {
    return listDriveVideoEntries();
  }

  const database = await readDatabase();
  return database.videos.toSorted((a, b) => b.numero - a.numero);
}

export async function getAiSettings() {
  if (isDriveStorageDriver()) {
    const { settingsFile } = await readDriveSettingsFile();
    return settingsFile.aiSettings;
  }

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
  if (isDriveStorageDriver()) {
    const { settingsFile } = await readDriveSettingsFile();
    return writeDriveSettingsFile({
      aiSettings: {
        ...settingsFile.aiSettings,
        ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
        updatedAt: new Date().toISOString(),
      },
    }).then((next) => next.aiSettings);
  }

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
  if (isDriveStorageDriver()) {
    const { settingsFile } = await readDriveSettingsFile();
    return settingsFile.driveSettings;
  }

  const database = await readDatabase();
  return database.driveSettings;
}

export async function getDriveSettingsStatus(): Promise<DriveSettingsStatus> {
  const settings = await getDriveSettings();
  const authStatus = await getGoogleDriveAuthStatus();

  return {
    ...settings,
    oauthConnected: authStatus.connected,
    authMode: authStatus.mode,
    writable: authStatus.writable,
    ready: settings.enabled && authStatus.writable && settings.folderId.trim().length > 0,
  };
}

export async function updateDriveSettings(patch: Partial<DriveSettings>) {
  if (isDriveStorageDriver()) {
    const next = await writeDriveSettingsFile({ driveSettings: patch });
    return next.driveSettings;
  }

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
  if (isDriveStorageDriver()) {
    return readDriveSessionById(id);
  }

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
  if (isDriveStorageDriver()) {
    throw new PublicError("En modo Drive, sube el archivo con la subida directa resumible.", 409);
  }

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

export async function createPendingDriveVideoEntry(input: PendingDriveUploadInput) {
  if (!isDriveStorageDriver()) {
    throw new PublicError("El storage local usa la subida clasica.", 409);
  }

  const nextFallbackName = "video";
  const rawFileName = String(input.originalFileName || nextFallbackName).trim();
  const originalFileName = requiredText(rawFileName, nextFallbackName, textLimits.fileName, "Nombre del archivo");
  const mimeType = input.mimeType || (path.extname(originalFileName).toLowerCase() === ".mp3" ? "audio/mpeg" : "video/mp4");
  const size = Number.isFinite(input.size) ? input.size : 0;

  if (size <= 0) {
    throw new PublicError("El archivo esta vacio.");
  }

  assertAllowedMediaMetadata({ mimeType, originalFileName, size });

  return withDatabaseLock(async () => {
    const { structure } = await readDriveSettingsFile();
    const videos = await listDriveVideoEntries({ fresh: true });
    const nextNumber = videos.reduce((max, video) => Math.max(max, video.numero), 0) + 1;
    const id = crypto.randomUUID();
    const sessionFolder = await ensureDriveSessionFolder(structure, id);
    const driveFileName = originalDriveFileName(originalFileName, mimeType);
    const uploadUrl = await createDriveResumableUploadSession({
      fileName: driveFileName,
      mimeType,
      parentId: sessionFolder.fileId,
      size,
    });
    const now = new Date().toISOString();
    const entry: VideoEntry = {
      id,
      numero: nextNumber,
      titulo: requiredText(input.titulo, `Video ${nextNumber}`, textLimits.title, "Titulo"),
      tema: requiredText(input.tema, "Sin tema", textLimits.topic, "Tema"),
      fecha: normalizeDate(input.fecha ?? ""),
      etiquetas: parseTags(input.etiquetas ?? ""),
      videoUrl: "",
      originalFileName,
      storedFileName: driveFileName,
      sourceFileName: driveFileName,
      mimeType,
      size,
      processingStatus: "pending",
      driveStatus: "uploading",
      driveFolderId: sessionFolder.fileId,
      driveSessionFolderId: sessionFolder.fileId,
      driveFileName,
      storageDriver: "drive",
      workerStatus: "pending",
      workerUpdatedAt: now,
      notasMeGusto: optionalText(input.notasMeGusto, textLimits.notes, "Notas de fortalezas"),
      notasMejorar: optionalText(input.notasMejorar, textLimits.notes, "Notas de mejora"),
      transcript: "",
      transcriptStatus: "idle",
      createdAt: now,
      updatedAt: now,
    };

    await writeDriveSession(entry, structure, sessionFolder.fileId);
    await upsertDriveIndexEntry(entry, structure);
    await upsertDriveJsonFile({
      parentId: structure.pendingJobsFolderId,
      name: `${id}.json`,
      value: {
        id,
        sessionFolderId: sessionFolder.fileId,
        status: "pending-upload",
        createdAt: now,
      },
    });

    return { entry, uploadUrl, uploadFileName: driveFileName };
  });
}

export async function finalizeDriveUpload(input: FinalizeDriveUploadInput) {
  if (!isDriveStorageDriver()) {
    throw new PublicError("La finalizacion directa solo aplica al storage Drive.", 409);
  }

  return withDatabaseLock(async () => {
    const { structure } = await readDriveSettingsFile();
    const entry = await readDriveSessionById(input.id);

    if (!entry) {
      return null;
    }

    const now = new Date().toISOString();
    let next: VideoEntry;

    if (input.status === "error") {
      next = {
        ...entry,
        driveStatus: "error",
        driveError: optionalText(input.error, 1000, "Error de subida") || "La subida directa a Drive fallo.",
        workerStatus: "error",
        workerUpdatedAt: now,
        updatedAt: now,
      };
    } else {
      const metadata = input.fileId
        ? await getDriveFileMetadata(input.fileId)
        : entry.driveFolderId && entry.driveFileName
          ? await findDriveChild({ parentId: entry.driveFolderId, name: entry.driveFileName })
          : null;

      if (!metadata) {
        throw new PublicError("La subida termino, pero no se encontro el archivo en la carpeta de Drive.");
      }

      next = {
        ...entry,
        driveStatus: "uploaded",
        driveError: undefined,
        driveFileId: metadata.fileId,
        driveOriginalFileId: metadata.fileId,
        driveFileName: input.fileName || metadata.fileName || entry.driveFileName,
        driveWebViewLink: input.webViewLink || metadata.webViewLink,
        driveUploadedAt: now,
        mimeType: input.mimeType || metadata.mimeType || entry.mimeType,
        size: input.size || metadata.size || entry.size,
        processingStatus: "pending",
        workerStatus: "pending",
        workerUpdatedAt: now,
        updatedAt: now,
      };
    }

    await writeDriveSession(next, structure, next.driveFolderId);
    await upsertDriveIndexEntry(next, structure);
    await upsertDriveJsonFile({
      parentId: structure.pendingJobsFolderId,
      name: `${next.id}.json`,
      value: {
        id: next.id,
        originalFileId: next.driveOriginalFileId,
        sessionFolderId: next.driveFolderId,
        status: input.status === "uploaded" ? "pending-processing" : "upload-error",
        updatedAt: now,
      },
    });

    return next;
  });
}

type UpdateVideoOptions = {
  ifUnmodifiedSince?: string;
};

function assertNoVideoConflict(previous: VideoEntry, options?: UpdateVideoOptions) {
  if (options?.ifUnmodifiedSince && previous.updatedAt !== options.ifUnmodifiedSince) {
    throw new PublicError("La sesion cambio en otro dispositivo. Refresca antes de guardar de nuevo.", 409);
  }
}

export async function updateVideoEntry(id: string, patch: Partial<VideoEntry>, options?: UpdateVideoOptions) {
  if (isDriveStorageDriver()) {
    return withDatabaseLock(async () => {
      const { structure } = await readDriveSettingsFile();
      const previous = await readDriveSessionById(id);

      if (!previous) {
        return null;
      }

      assertNoVideoConflict(previous, options);

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

      await writeDriveSession(next, structure, next.driveFolderId);
      await upsertDriveIndexEntry(next, structure);
      return next;
    });
  }

  return withDatabaseLock(async () => {
    const database = await readDatabase();
    const index = database.videos.findIndex((video) => video.id === id);

    if (index === -1) {
      return null;
    }

    const previous = database.videos[index];
    assertNoVideoConflict(previous, options);

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
  if (isDriveStorageDriver()) {
    return withDatabaseLock(async () => {
      const { structure } = await readDriveSettingsFile();
      const entry = await readDriveSessionById(id);

      if (!entry) {
        return false;
      }

      const index = await readDriveIndex(structure);
      await writeDriveIndex(structure, {
        sessions: index.sessions.filter((session) => session.id !== id),
        updatedAt: new Date().toISOString(),
      });

      return true;
    });
  }

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
