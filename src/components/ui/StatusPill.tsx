import { AlertCircle, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import type { TranscriptStatus } from "@/types/video";

const labels: Record<TranscriptStatus, string> = {
  idle: "Sin transcribir",
  processing: "Transcribiendo",
  ready: "Transcrito",
  error: "Error",
};

export function StatusPill({ status }: { status: TranscriptStatus }) {
  const Icon =
    status === "ready"
      ? CheckCircle2
      : status === "processing"
        ? LoaderCircle
        : status === "error"
          ? AlertCircle
          : Clock3;

  return (
    <span className={`status-pill status-${status}`}>
      <Icon aria-hidden="true" size={15} />
      {labels[status]}
    </span>
  );
}

