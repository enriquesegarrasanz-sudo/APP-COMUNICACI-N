export type TranscriptStatus = "idle" | "processing" | "ready" | "error";

export type TranscriptionProvider = "local" | "openai" | "ai-api";

export type AiProviderKind =
  | "openai"
  | "deepseek"
  | "ollama"
  | "openai-compatible"
  | "anthropic"
  | "google"
  | "mistral"
  | "custom";

export type AiAuthMode = "bearer" | "x-api-key" | "query-key" | "none";

export type VideoProcessingStatus = "ready" | "error" | "skipped";

export type DriveUploadStatus = "disabled" | "uploaded" | "error" | "skipped";

export type AiSettings = {
  providerKind: AiProviderKind;
  providerName: string;
  baseUrl: string;
  chatEndpoint: string;
  transcriptionEndpoint: string;
  authMode: AiAuthMode;
  apiKeyEnvVar: string;
  apiKeyQueryParam: string;
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

export type DriveSettings = {
  enabled: boolean;
  folderId: string;
  serviceAccountEmailEnvVar: string;
  serviceAccountPrivateKeyEnvVar: string;
  compressionCrf: number;
  audioBitrateKbps: number;
  deleteOriginalAfterProcessing: boolean;
  updatedAt?: string;
};

export type DriveSettingsStatus = DriveSettings & {
  credentialsConfigured: boolean;
  ready: boolean;
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
  sourceFileName?: string;
  audioFileName?: string;
  audioUrl?: string;
  mimeType: string;
  size: number;
  compressedSize?: number;
  audioSize?: number;
  processingStatus?: VideoProcessingStatus;
  processingError?: string;
  driveStatus?: DriveUploadStatus;
  driveFileId?: string;
  driveFileName?: string;
  driveWebViewLink?: string;
  driveError?: string;
  driveUploadedAt?: string;
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
  driveSettings: DriveSettings;
};
