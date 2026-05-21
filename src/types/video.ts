export type TranscriptStatus = "idle" | "processing" | "ready" | "error";

export type TranscriptionProvider = "local" | "openai";

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
};

