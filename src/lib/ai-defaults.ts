import type { AiSettings, DriveSettings } from "@/types/video";

export const defaultApplicationContext =
  "APP SPEAKING es una aplicacion local para entrenar comunicacion frente a camara. " +
  "La IA debe ayudar a transcribir de forma fiel, conservar muletillas y pausas habladas, " +
  "analizar claridad, estructura, ritmo, repeticiones, muletillas, cierre, intencion, " +
  "lenguaje corporal solo cuando existan observaciones o vision conectada, y devolver consejos breves, concretos y accionables.";

export const defaultAiSettings: AiSettings = {
  providerKind: "openai",
  providerName: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  chatEndpoint: "chat/completions",
  transcriptionEndpoint: "audio/transcriptions",
  authMode: "bearer",
  apiKeyEnvVar: "OPENAI_API_KEY",
  apiKeyQueryParam: "key",
  transcriptionModel: "gpt-4o-mini-transcribe",
  analysisModel: "gpt-5-nano",
  visionModel: "gpt-5-nano",
  transcriptionEnabled: true,
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
