export type TranscriptStatus = "idle" | "processing" | "ready" | "error";

export type TranscriptionProvider = "local" | "openai" | "ai-api";

export type AiProviderKind = "openai" | "openai-compatible" | "anthropic" | "google" | "mistral" | "custom";

export type AiSettings = {
  providerKind: AiProviderKind;
  providerName: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  transcriptionModel: string;
  analysisModel: string;
  visionModel: string;
  transcriptionEnabled: boolean;
  transcriptAnalysisEnabled: boolean;
  videoAnalysisEnabled: boolean;
  historyContextEnabled: boolean;
  applicationContext: string;
  updatedAt?: string;
};

export type AiSettingsStatus = AiSettings & {
  apiKeyConfigured: boolean;
};

export type FillerCount = {
  phrase: string;
  count: number;
  perThousandWords: number;
};

export type RepeatedTerm = {
  term: string;
  count: number;
};

export type StructureSignal = {
  name: string;
  count: number;
  examples: string[];
};

export type AnalysisResult = {
  wordCount: number;
  sentenceCount: number;
  fillerTotal: number;
  fillerRate: number;
  topFillers: FillerCount[];
  repeatedTerms: RepeatedTerm[];
  repeatedPhrases: RepeatedTerm[];
  structureSignals: StructureSignal[];
  clarityScore: number;
  recommendations: string[];
  generatedAt: string;
};

export type VideoEntry = {
  id: string;
  numero: number;
  titulo: string;
  tema: string;
  fecha: string;
  etiquetas: string[];
  videoUrl: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  notasMeGusto: string;
  notasMejorar: string;
  transcript: string;
  transcriptStatus: TranscriptStatus;
  transcriptProvider?: TranscriptionProvider;
  transcriptError?: string;
  analysis?: AnalysisResult;
  aiCoachNotes?: string[];
  createdAt: string;
  updatedAt: string;
};

export type AppDatabase = {
  videos: VideoEntry[];
  aiSettings: AiSettings;
};
