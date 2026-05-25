import type { AiSettings, DriveSettings } from "@/types/video";

export const defaultApplicationContext =
  "APP SPEAKING es una aplicacion para entrenar comunicacion frente a camara con practica diaria. " +
  "La IA recibe una transcripcion ya escrita y datos heuristicos (claridad, muletillas, repeticiones, estructura, diversidad de vocabulario, conectores discursivos, longitud de frases y tono seguridad/vacilacion). " +
  "Debe actuar como coach de oratoria: interpretar las metricas, detectar patrones y priorizar la mejora mas impactante. " +
  "No debe inventar informacion del video ni corregir la transcripcion como si hubiera escuchado el audio. " +
  "Debe devolver consejos breves, concretos y accionables para la siguiente grabacion.";

export const defaultOllamaStartCommand = "ollama serve";
export const defaultWhisperCommand = "whisper";
export const defaultWhisperModel = "small";
export const defaultWhisperLanguage = "Spanish";

export const deepseekAiSettings: AiSettings = {
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
  ollamaStartCommand: defaultOllamaStartCommand,
  whisperCommand: defaultWhisperCommand,
  whisperModel: defaultWhisperModel,
  transcriptionEnabled: false,
  transcriptAnalysisEnabled: true,
  videoAnalysisEnabled: false,
  historyContextEnabled: true,
  applicationContext: defaultApplicationContext,
};

export const ollamaAiSettings: AiSettings = {
  providerKind: "ollama",
  providerName: "Ollama local",
  baseUrl: "http://127.0.0.1:11434",
  chatEndpoint: "api/chat",
  transcriptionEndpoint: "",
  authMode: "none",
  apiKeyEnvVar: "",
  apiKeyQueryParam: "",
  transcriptionModel: "whisper-local",
  analysisModel: "qwen3:14b",
  visionModel: "qwen3-vl:8b",
  ollamaStartCommand: defaultOllamaStartCommand,
  whisperCommand: defaultWhisperCommand,
  whisperModel: defaultWhisperModel,
  transcriptionEnabled: false,
  transcriptAnalysisEnabled: true,
  videoAnalysisEnabled: false,
  historyContextEnabled: true,
  applicationContext: defaultApplicationContext,
};

export const defaultAiSettings: AiSettings = deepseekAiSettings;

export const ollamaAnalysisModels = ["qwen3:14b", "qwen3-vl:8b"] as const;

export const defaultDriveFolderId = "1R4TpxFk7ErNwiXQSLZllnvbQ4eBd5MjC";

export function getAiSettingsPreset(providerKind: AiSettings["providerKind"], analysisModel?: string): AiSettings {
  if (providerKind === "ollama") {
    return {
      ...ollamaAiSettings,
      analysisModel: ollamaAnalysisModels.includes(analysisModel as (typeof ollamaAnalysisModels)[number])
        ? String(analysisModel)
        : ollamaAiSettings.analysisModel,
    };
  }

  return deepseekAiSettings;
}

export const defaultDriveSettings: DriveSettings = {
  enabled: true,
  folderId: defaultDriveFolderId,
  compressionCrf: 28,
  audioBitrateKbps: 48,
  deleteOriginalAfterProcessing: true,
};
