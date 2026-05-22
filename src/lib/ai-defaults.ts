import type { AiSettings, DriveSettings } from "@/types/video";

export const defaultApplicationContext =
  "APP SPEAKING es una aplicacion para entrenar comunicacion frente a camara con practica diaria. " +
  "DeepSeek recibe una transcripcion ya escrita y debe actuar como coach de oratoria: detectar patrones de claridad, estructura, ritmo, muletillas, repeticiones, cierre e intencion. " +
  "No debe inventar informacion del video ni corregir la transcripcion como si hubiera escuchado el audio. " +
  "Debe devolver consejos breves, concretos y accionables para la siguiente grabacion.";

export const defaultAiSettings: AiSettings = {
  providerKind: "deepseek",
  providerName: "DeepSeek",
  baseUrl: "https://api.deepseek.com",
  chatEndpoint: "chat/completions",
  transcriptionEndpoint: "audio/transcriptions",
  authMode: "bearer",
  apiKeyEnvVar: "DEEPSEEK_API_KEY",
  apiKeyQueryParam: "key",
  transcriptionModel: "whisper-local",
  analysisModel: "deepseek-v4-flash",
  visionModel: "no-disponible",
  transcriptionEnabled: false,
  transcriptAnalysisEnabled: true,
  videoAnalysisEnabled: false,
  historyContextEnabled: true,
  applicationContext: defaultApplicationContext,
};

export const defaultDriveSettings: DriveSettings = {
  enabled: false,
  folderId: "",
  serviceAccountEmailEnvVar: "GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL",
  serviceAccountPrivateKeyEnvVar: "GOOGLE_DRIVE_PRIVATE_KEY",
  compressionCrf: 28,
  audioBitrateKbps: 48,
  deleteOriginalAfterProcessing: true,
};
