import { promises as fs } from "node:fs";
import path from "node:path";
import type { AiProviderKind, AiSettings, AiSettingsStatus, AppDatabase, VideoEntry } from "@/types/video";

const dataDir = path.join(process.cwd(), "data");
const uploadDir = path.join(process.cwd(), "public", "uploads");
const appFile = path.join(dataDir, "app.json");

export const defaultApplicationContext =
  "APP SPEAKING es una aplicacion local para entrenar comunicacion frente a camara. " +
  "La IA debe ayudar a transcribir de forma fiel, conservar muletillas y pausas habladas, " +
  "analizar claridad, estructura, ritmo, repeticiones, muletillas, cierre, intencion, " +
  "lenguaje corporal solo cuando existan observaciones o vision conectada, y devolver consejos breves, concretos y accionables.";

export const defaultAiSettings: AiSettings = {
  providerKind: "openai",
  providerName: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiKeyEnvVar: "OPENAI_API_KEY",
  transcriptionModel: "gpt-4o-mini-transcribe",
  analysisModel: "gpt-5-nano",
  visionModel: "gpt-5-nano",
  transcriptionEnabled: true,
  transcriptAnalysisEnabled: true,
  videoAnalysisEnabled: false,
  historyContextEnabled: true,
  applicationContext: defaultApplicationContext,
};

const allowedProviderKinds = new Set<AiProviderKind>([
  "openai",
  "openai-compatible",
  "anthropic",
  "google",
  "mistral",
  "custom",
]);

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });

  try {
    await fs.access(appFile);
  } catch {
    await fs.writeFile(
      appFile,
      JSON.stringify({ videos: [], aiSettings: defaultAiSettings }, null, 2),
      "utf8",
    );
  }
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeAiSettings(value: unknown): AiSettings {
  const input = value && typeof value === "object" ? (value as Partial<AiSettings>) : {};
  const providerKind = allowedProviderKinds.has(input.providerKind as AiProviderKind)
    ? (input.providerKind as AiProviderKind)
    : defaultAiSettings.providerKind;

  return {
    providerKind,
    providerName: stringOrDefault(input.providerName, defaultAiSettings.providerName),
    baseUrl: stringOrDefault(input.baseUrl, defaultAiSettings.baseUrl).replace(/\/+$/, ""),
    apiKeyEnvVar: stringOrDefault(input.apiKeyEnvVar, defaultAiSettings.apiKeyEnvVar),
    transcriptionModel: stringOrDefault(input.transcriptionModel, defaultAiSettings.transcriptionModel),
    analysisModel: stringOrDefault(input.analysisModel, defaultAiSettings.analysisModel),
    visionModel: stringOrDefault(input.visionModel, defaultAiSettings.visionModel),
    transcriptionEnabled: booleanOrDefault(input.transcriptionEnabled, defaultAiSettings.transcriptionEnabled),
    transcriptAnalysisEnabled: booleanOrDefault(
      input.transcriptAnalysisEnabled,
      defaultAiSettings.transcriptAnalysisEnabled,
    ),
    videoAnalysisEnabled: booleanOrDefault(input.videoAnalysisEnabled, defaultAiSettings.videoAnalysisEnabled),
    historyContextEnabled: booleanOrDefault(input.historyContextEnabled, defaultAiSettings.historyContextEnabled),
    applicationContext: stringOrDefault(input.applicationContext, defaultAiSettings.applicationContext),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
  };
}

async function readDatabase(): Promise<AppDatabase> {
  await ensureStore();
  const raw = await fs.readFile(appFile, "utf8");

  try {
    const parsed = JSON.parse(raw) as Partial<AppDatabase>;
    return {
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
      aiSettings: normalizeAiSettings(parsed.aiSettings),
    };
  } catch {
    return { videos: [], aiSettings: defaultAiSettings };
  }
}

async function writeDatabase(database: AppDatabase) {
  await ensureStore();
  await fs.writeFile(appFile, JSON.stringify(database, null, 2), "utf8");
}

function safeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
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

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
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
    apiKeyConfigured: Boolean(settings.apiKeyEnvVar && process.env[settings.apiKeyEnvVar]),
  };
}

export async function updateAiSettings(patch: Partial<AiSettings>) {
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
}

export async function getVideoEntry(id: string) {
  const database = await readDatabase();
  return database.videos.find((video) => video.id === id) ?? null;
}

export function getVideoAbsolutePath(entry: VideoEntry) {
  return path.join(uploadDir, entry.storedFileName);
}

export async function createVideoEntry(formData: FormData) {
  const file = formData.get("video");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona un archivo de video valido.");
  }

  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
    throw new Error("El archivo debe ser de video o audio.");
  }

  await ensureStore();

  const database = await readDatabase();
  const nextNumber = database.videos.reduce((max, video) => Math.max(max, video.numero), 0) + 1;
  const id = crypto.randomUUID();
  const originalFileName = file.name || `video-${nextNumber}`;
  const extension = path.extname(originalFileName) || ".mp4";
  const storedFileName = `${String(nextNumber).padStart(3, "0")}-${id.slice(0, 8)}-${safeFileName(
    path.basename(originalFileName, extension),
  )}${extension.toLowerCase()}`;
  const destination = path.join(uploadDir, storedFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(destination, buffer);

  const now = new Date().toISOString();
  const entry: VideoEntry = {
    id,
    numero: nextNumber,
    titulo: String(formData.get("titulo") || `Video ${nextNumber}`).trim(),
    tema: String(formData.get("tema") || "Sin tema").trim(),
    fecha: normalizeDate(String(formData.get("fecha") || "")),
    etiquetas: parseTags(String(formData.get("etiquetas") || "")),
    videoUrl: `/uploads/${storedFileName}`,
    originalFileName,
    storedFileName,
    mimeType: file.type || "video/mp4",
    size: file.size,
    notasMeGusto: String(formData.get("notasMeGusto") || "").trim(),
    notasMejorar: String(formData.get("notasMejorar") || "").trim(),
    transcript: "",
    transcriptStatus: "idle",
    createdAt: now,
    updatedAt: now,
  };

  database.videos.push(entry);
  await writeDatabase(database);
  return entry;
}

export async function updateVideoEntry(id: string, patch: Partial<VideoEntry>) {
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
}

export async function deleteVideoEntry(id: string) {
  const database = await readDatabase();
  const entry = database.videos.find((video) => video.id === id);

  if (!entry) {
    return false;
  }

  database.videos = database.videos.filter((video) => video.id !== id);
  await writeDatabase(database);

  try {
    await fs.unlink(getVideoAbsolutePath(entry));
  } catch {
    // The record can be removed even if the local upload is already missing.
  }

  return true;
}
