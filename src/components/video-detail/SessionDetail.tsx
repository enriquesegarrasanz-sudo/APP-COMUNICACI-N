"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Brain,
  Cloud,
  FileAudio2,
  FileText,
  ListChecks,
  LoaderCircle,
  Mic2,
  PenLine,
  RefreshCw,
  Repeat2,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { compareSessions } from "@/lib/insights";
import { type AutosaveStatus, useAutosave } from "@/lib/use-autosave";
import type { AiSettingsStatus, VideoEntry } from "@/types/video";

type Props = {
  aiSettings: AiSettingsStatus;
  previousVideo: VideoEntry | null;
  video: VideoEntry | null;
  onEntryChange: (entry: VideoEntry) => void;
  onDelete: (id: string) => void;
};

type Draft = {
  titulo: string;
  tema: string;
  fecha: string;
  etiquetas: string;
  notasMeGusto: string;
  notasMejorar: string;
  transcript: string;
};

const emptyDraft: Draft = {
  titulo: "",
  tema: "",
  fecha: "",
  etiquetas: "",
  notasMeGusto: "",
  notasMejorar: "",
  transcript: "",
};

function toDraft(video: VideoEntry | null): Draft {
  if (!video) {
    return emptyDraft;
  }

  return {
    titulo: video.titulo,
    tema: video.tema,
    fecha: video.fecha,
    etiquetas: video.etiquetas.join(", "),
    notasMeGusto: video.notasMeGusto,
    notasMejorar: video.notasMejorar,
    transcript: video.transcript,
  };
}

function draftsAreEqual(left: Draft, right: Draft) {
  return (
    left.titulo === right.titulo &&
    left.tema === right.tema &&
    left.fecha === right.fecha &&
    left.etiquetas === right.etiquetas &&
    left.notasMeGusto === right.notasMeGusto &&
    left.notasMejorar === right.notasMejorar &&
    left.transcript === right.transcript
  );
}

function tagsFromDraft(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function draftPatch(value: Draft, baseline: Draft): Partial<VideoEntry> {
  const patch: Partial<VideoEntry> = {};

  if (value.titulo !== baseline.titulo) {
    patch.titulo = value.titulo;
  }

  if (value.tema !== baseline.tema) {
    patch.tema = value.tema;
  }

  if (value.fecha !== baseline.fecha) {
    patch.fecha = value.fecha;
  }

  if (value.etiquetas !== baseline.etiquetas) {
    patch.etiquetas = tagsFromDraft(value.etiquetas);
  }

  if (value.notasMeGusto !== baseline.notasMeGusto) {
    patch.notasMeGusto = value.notasMeGusto;
  }

  if (value.notasMejorar !== baseline.notasMejorar) {
    patch.notasMejorar = value.notasMejorar;
  }

  if (value.transcript !== baseline.transcript) {
    patch.transcript = value.transcript;
  }

  return patch;
}

function autosaveLabel(status: AutosaveStatus, dirty: boolean, error: string) {
  if (status === "error") {
    return error || "Error al guardar";
  }

  if (status === "saving" || status === "pending") {
    return "Guardando...";
  }

  if (status === "saved") {
    return "Guardado";
  }

  return dirty ? "Pendiente" : "Guardado";
}

function formatBytes(value?: number) {
  if (!value || value <= 0) {
    return "";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isDriveBacked(video: VideoEntry) {
  return Boolean(video.storageDriver === "drive" || video.driveOriginalFileId || video.driveCompressedFileId || video.driveAudioFileId);
}

function mediaKind(video: VideoEntry) {
  return video.mimeType.startsWith("audio/") && !video.driveCompressedFileId ? "audio" : "video";
}

function playableMediaSrc(video: VideoEntry) {
  if (isDriveBacked(video)) {
    return `/api/videos/${video.id}/media?kind=${mediaKind(video)}&v=${encodeURIComponent(video.updatedAt)}`;
  }

  return video.videoUrl;
}

type HealthTone = "ready" | "pending" | "error" | "muted";

function getSessionHealth(video: VideoEntry) {
  const mediaIsError = video.processingStatus === "error";
  const mediaIsPending = video.processingStatus === "pending";
  const driveOriginalReady = Boolean(video.driveOriginalFileId || video.driveFileId);
  const transcriptReady = video.transcriptStatus === "ready";

  return [
    {
      label: "Media",
      status: mediaIsError ? "Error" : mediaIsPending && driveOriginalReady ? "Original" : mediaIsPending ? "Pendiente" : "Listo",
      detail: mediaIsError
        ? "Procesado fallo"
        : mediaIsPending && driveOriginalReady
          ? "Drive reproducible"
          : mediaIsPending
            ? "Worker local"
            : formatBytes(video.compressedSize || video.size),
      tone: mediaIsError ? "error" : driveOriginalReady || !mediaIsPending ? "ready" : "pending",
    },
    {
      label: "Audio",
      status: mediaIsError ? "Error" : video.audioFileName ? "Listo" : "Pendiente",
      detail: video.audioFileName ? formatBytes(video.audioSize) : mediaIsPending ? "Esperando worker" : "Sin archivo ligero",
      tone: mediaIsError ? "error" : video.audioFileName ? "ready" : "pending",
    },
    {
      label: "Transcripcion",
      status:
        video.transcriptStatus === "ready"
          ? "Lista"
          : video.transcriptStatus === "processing"
            ? "Procesando"
            : video.transcriptStatus === "error"
              ? "Error"
              : "Pendiente",
      detail: video.transcriptProvider ? video.transcriptProvider : "Sin proveedor",
      tone:
        video.transcriptStatus === "ready"
          ? "ready"
          : video.transcriptStatus === "error"
            ? "error"
            : "pending",
    },
    {
      label: "Analisis",
      status: video.analysis ? "Listo" : transcriptReady ? "Pendiente" : "En espera",
      detail: video.analysis ? `${video.analysis.clarityScore}% claridad` : "Necesita transcripcion",
      tone: video.analysis ? "ready" : transcriptReady ? "pending" : "muted",
    },
    {
      label: "Drive",
      status:
        video.driveStatus === "uploaded"
          ? "Subido"
          : video.driveStatus === "uploading"
            ? "Subiendo"
            : video.driveStatus === "pending"
              ? "Pendiente"
          : video.driveStatus === "error"
            ? "Error"
            : video.driveStatus === "disabled"
              ? "Pausado"
              : "Omitido",
      detail: video.driveFileName ?? "Local",
      tone:
        video.driveStatus === "uploaded"
          ? "ready"
          : video.driveStatus === "error"
            ? "error"
            : video.driveStatus === "uploading" || video.driveStatus === "pending"
              ? "pending"
              : "muted",
    },
  ] satisfies Array<{ label: string; status: string; detail: string; tone: HealthTone }>;
}

function comparisonTone(value: number | null, lowerIsBetter = false) {
  if (value === null || value === 0) {
    return "is-neutral";
  }

  const isBetter = lowerIsBetter ? value < 0 : value > 0;
  return isBetter ? "is-good" : "is-alert";
}

function formatSigned(value: number | null, suffix = "") {
  if (value === null) {
    return "-";
  }

  if (value === 0) {
    return "igual";
  }

  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export function SessionDetail({ aiSettings, previousVideo, video, onEntryChange, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(video));
  const [useAi, setUseAi] = useState(
    () => aiSettings.transcriptAnalysisEnabled && (aiSettings.authMode === "none" || aiSettings.apiKeyConfigured),
  );
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");
  const savedDraftRef = useRef<Draft>(toDraft(video));
  const savedUpdatedAtRef = useRef(video?.updatedAt ?? "");
  const seenVideoIdRef = useRef(video?.id ?? "");

  const saveDraft = useCallback(
    async (value: Draft) => {
      if (!video) {
        throw new Error("No hay sesion seleccionada.");
      }

      const patch = draftPatch(value, savedDraftRef.current);

      if (Object.keys(patch).length === 0) {
        return video;
      }

      const response = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...patch,
          ifUnmodifiedSince: savedUpdatedAtRef.current,
        }),
      });
      const payload = (await response.json()) as { entry?: VideoEntry; error?: string };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "No se pudo guardar.");
      }

      return payload.entry;
    },
    [video],
  );

  const applySavedEntry = useCallback(
    (entry: VideoEntry) => {
      savedDraftRef.current = toDraft(entry);
      savedUpdatedAtRef.current = entry.updatedAt;
      onEntryChange(entry);
    },
    [onEntryChange],
  );

  const autosave = useAutosave<Draft, VideoEntry>({
    debounceMs: 900,
    enabled: Boolean(video),
    isDirty: (value) => !draftsAreEqual(value, savedDraftRef.current),
    onSave: saveDraft,
    onSaved: applySavedEntry,
    resetKey: video?.id ?? "empty-session",
    value: draft,
  });

  useEffect(() => {
    if (!video) {
      savedDraftRef.current = emptyDraft;
      savedUpdatedAtRef.current = "";
      seenVideoIdRef.current = "";
      return;
    }

    const nextDraft = toDraft(video);
    const selectedAnotherSession = seenVideoIdRef.current !== video.id;
    const hasLocalDraftChanges = !draftsAreEqual(draft, savedDraftRef.current);

    if ((selectedAnotherSession || !hasLocalDraftChanges) && !draftsAreEqual(draft, nextDraft)) {
      setDraft(nextDraft);
    }

    savedDraftRef.current = nextDraft;
    savedUpdatedAtRef.current = video.updatedAt;
    seenVideoIdRef.current = video.id;
  }, [draft, video]);

  if (!video) {
    return (
      <section className="session-detail empty-detail">
        <Mic2 aria-hidden="true" size={30} />
        <h2>Sin sesion seleccionada</h2>
      </section>
    );
  }

  const currentVideo = video;
  const aiAnalysisReady =
    aiSettings.transcriptAnalysisEnabled && (aiSettings.authMode === "none" || aiSettings.apiKeyConfigured);
  const aiProviderLabel = aiSettings.providerKind === "ollama" ? `${aiSettings.providerName} (${aiSettings.analysisModel})` : aiSettings.providerName;
  const transcribeDisabled = transcribing;
  const analyzeDisabled = analyzing || !draft.transcript.trim() || (useAi && !aiAnalysisReady);
  const messageIsError =
    message.includes("No se pudo") ||
    message.includes("Falta") ||
    message.includes("fallo") ||
    message.includes("desactiv");

  function updateDraft<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function transcribe() {
    setTranscribing(true);
    setMessage("");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentVideo.id, provider: "local" }),
      });
      const payload = (await response.json()) as { entry?: VideoEntry; error?: string };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "No se pudo transcribir.");
      }

      onEntryChange(payload.entry);
      const nextDraft = toDraft(payload.entry);
      savedDraftRef.current = nextDraft;
      savedUpdatedAtRef.current = payload.entry.updatedAt;
      setDraft(nextDraft);
      setMessage("Transcripcion y analisis base listos.");
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("No se pudo transcribir.");
      }
    } finally {
      setTranscribing(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setMessage("");

    try {
      if (autosave.dirty) {
        await autosave.saveNow();
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentVideo.id, useAi: useAi && aiAnalysisReady }),
      });
      const payload = (await response.json()) as { entry?: VideoEntry; error?: string };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "No se pudo analizar.");
      }

      onEntryChange(payload.entry);
      savedDraftRef.current = toDraft(payload.entry);
      savedUpdatedAtRef.current = payload.entry.updatedAt;
      setMessage("Analisis actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo analizar.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function deleteEntry() {
    const response = await fetch(`/api/videos/${currentVideo.id}`, { method: "DELETE" });

    if (response.ok) {
      onDelete(currentVideo.id);
    }
  }

  const analysis = currentVideo.analysis;
  const healthItems = getSessionHealth(currentVideo);
  const comparison = compareSessions(currentVideo, previousVideo);
  const mediaSrc = playableMediaSrc(currentVideo);
  const currentMediaKind = mediaKind(currentVideo);
  const autosaveBusy = autosave.status === "pending" || autosave.status === "saving";
  const autosaveText = autosaveLabel(autosave.status, autosave.dirty, autosave.error);
  const autosaveClassName = autosave.status === "error" ? "autosave-chip is-error" : "autosave-chip";

  return (
    <section className="session-detail">
      <div className="detail-header">
        <div>
          <p>Sesion #{currentVideo.numero}</p>
          <h1>{currentVideo.titulo}</h1>
        </div>
        <StatusPill status={currentVideo.transcriptStatus} />
      </div>

      <div className="session-insight-row">
        <article className="session-health-panel">
          <div className="panel-title">
            <ListChecks aria-hidden="true" size={18} />
            <h3>Semaforo de sesion</h3>
          </div>
          <div className="health-grid">
            {healthItems.map((item) => (
              <div className={`health-item is-${item.tone}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.status}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="session-comparison-panel">
          <div className="panel-title">
            <BarChart3 aria-hidden="true" size={18} />
            <h3>{comparison ? `Comparacion con #${comparison.previousNumber}` : "Comparacion"}</h3>
          </div>
          {!comparison ? (
            <p className="empty-line">Primera sesion guardada.</p>
          ) : comparison.clarityDelta === null ? (
            <p className="empty-line">La sesion anterior aun no tiene analisis comparable.</p>
          ) : (
            <div className="comparison-grid">
              <span>
                <small>Claridad</small>
                <strong className={comparisonTone(comparison.clarityDelta)}>
                  {formatSigned(comparison.clarityDelta, "%")}
                </strong>
              </span>
              <span>
                <small>Muletillas / 1000</small>
                <strong className={comparisonTone(comparison.fillerRateDelta, true)}>
                  {formatSigned(comparison.fillerRateDelta)}
                </strong>
              </span>
              <span>
                <small>Total muletillas</small>
                <strong className={comparisonTone(comparison.fillerTotalDelta, true)}>
                  {formatSigned(comparison.fillerTotalDelta)}
                </strong>
              </span>
              <span>
                <small>Palabras</small>
                <strong>{formatSigned(comparison.wordCountDelta)}</strong>
              </span>
              {comparison.topFiller ? (
                <span className="comparison-filler">
                  <small>{comparison.topFiller.phrase}</small>
                  <strong className={comparisonTone(comparison.topFiller.delta, true)}>
                    {formatSigned(comparison.topFiller.delta)}
                  </strong>
                  <em>
                    {comparison.topFiller.current} ahora / {comparison.topFiller.previous} antes
                  </em>
                </span>
              ) : null}
            </div>
          )}
        </article>
      </div>

      <div className="detail-grid">
        <div className="video-surface">
          {mediaSrc ? (
            currentMediaKind === "audio" ? (
              <audio controls preload="none" src={mediaSrc} />
            ) : (
              <video controls preload="none" src={mediaSrc} />
            )
          ) : (
            <div className="video-placeholder">
              <Cloud aria-hidden="true" size={28} />
              <strong>
                {currentVideo.processingStatus === "ready" ? "Resultado guardado en Drive" : "Original pendiente en Drive"}
              </strong>
              <span>
                {currentVideo.processingStatus === "ready"
                  ? "No se encontro un archivo reproducible para esta sesion."
                  : "La subida aun no termino o no devolvio ID de archivo."}
              </span>
            </div>
          )}
          <div className="media-status-stack">
            <span
              className={
                currentVideo.processingStatus === "error"
                  ? "media-chip is-error"
                  : currentVideo.processingStatus === "pending"
                    ? "media-chip"
                    : "media-chip is-ready"
              }
            >
              <FileAudio2 aria-hidden="true" size={15} />
              {currentVideo.audioFileName
                ? `Audio ${formatBytes(currentVideo.audioSize)}`
                : currentVideo.processingStatus === "pending"
                  ? "Worker pendiente"
                  : "Audio pendiente"}
            </span>
            <span className={currentVideo.driveStatus === "error" ? "media-chip is-error" : "media-chip"}>
              <Cloud aria-hidden="true" size={15} />
              {currentVideo.driveStatus === "uploaded"
                ? "Drive subido"
                : currentVideo.driveStatus === "uploading"
                  ? "Subiendo a Drive"
                  : currentVideo.driveStatus === "pending"
                    ? "Drive pendiente"
                : currentVideo.driveStatus === "disabled"
                  ? "Drive pausado"
                  : currentVideo.driveStatus === "error"
                    ? "Drive error"
                    : "Drive omitido"}
            </span>
            {currentVideo.compressedSize ? (
              <span className="media-chip">MP4 {formatBytes(currentVideo.compressedSize)}</span>
            ) : null}
            {currentVideo.driveWebViewLink ? (
              <a className="media-chip is-link" href={currentVideo.driveWebViewLink} rel="noreferrer" target="_blank">
                Abrir Drive
              </a>
            ) : null}
          </div>
          {currentVideo.processingError ? <p className="inline-error media-error">{currentVideo.processingError}</p> : null}
          {currentVideo.driveError ? <p className="inline-error media-error">{currentVideo.driveError}</p> : null}
        </div>

        <div className="edit-surface">
          <div className="surface-toolbar">
            <div className="surface-title">
              <PenLine aria-hidden="true" size={18} />
              <h2>Ficha</h2>
            </div>
            <span className={autosaveClassName}>
              {autosaveBusy ? <LoaderCircle aria-hidden="true" size={15} /> : null}
              {autosaveText}
            </span>
          </div>

          <label>
            <span>Titulo</span>
            <input value={draft.titulo} onChange={(event) => updateDraft("titulo", event.target.value)} />
          </label>

          <label>
            <span>Tema</span>
            <input value={draft.tema} onChange={(event) => updateDraft("tema", event.target.value)} />
          </label>

          <div className="field-row">
            <label>
              <span>Fecha</span>
              <input type="date" value={draft.fecha} onChange={(event) => updateDraft("fecha", event.target.value)} />
            </label>
            <label>
              <span>Tags</span>
              <input
                value={draft.etiquetas}
                onChange={(event) => updateDraft("etiquetas", event.target.value)}
              />
            </label>
          </div>

          <label>
            <span>Me gusto</span>
            <textarea value={draft.notasMeGusto} onChange={(event) => updateDraft("notasMeGusto", event.target.value)} />
          </label>

          <label>
            <span>Mejorar</span>
            <textarea value={draft.notasMejorar} onChange={(event) => updateDraft("notasMejorar", event.target.value)} />
          </label>

          <div className="button-row">
            <button
              className="secondary-action"
              disabled={!autosave.dirty || autosaveBusy}
              onClick={() => void autosave.saveNow().catch(() => undefined)}
              type="button"
            >
              {autosaveBusy ? <LoaderCircle aria-hidden="true" size={17} /> : <Save aria-hidden="true" size={17} />}
              Guardar ahora
            </button>
            <button className="danger-action" onClick={deleteEntry} type="button">
              <Trash2 aria-hidden="true" size={17} />
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <div className="transcript-band">
        <div className="transcript-toolbar">
          <div className="surface-title">
            <FileText aria-hidden="true" size={18} />
            <h2>Transcripcion</h2>
          </div>
          <div className="toolbar-controls">
            <span className={autosaveClassName}>
              {autosaveBusy ? <LoaderCircle aria-hidden="true" size={15} /> : null}
              {autosaveText}
            </span>
            <span className="local-transcription-chip">Whisper {aiSettings.whisperModel}</span>
            <button className="secondary-action" disabled={transcribeDisabled} onClick={transcribe} type="button">
              {transcribing ? (
                <LoaderCircle aria-hidden="true" size={17} />
              ) : (
                <RefreshCw aria-hidden="true" size={17} />
              )}
              Transcribir
            </button>
          </div>
        </div>

        <textarea
          className="transcript-area"
          value={draft.transcript}
          onChange={(event) => updateDraft("transcript", event.target.value)}
        />
      </div>

      <div className="analysis-band">
        <div className="analysis-toolbar">
          <div className="surface-title">
            <Brain aria-hidden="true" size={18} />
            <h2>Analisis</h2>
          </div>
          <div className="toolbar-controls">
            <label className="ai-toggle">
              <input
                checked={useAi && aiAnalysisReady}
                disabled={!aiAnalysisReady}
                type="checkbox"
                onChange={(event) => setUseAi(event.target.checked)}
              />
              {aiProviderLabel}
            </label>
            <button className="primary-action" disabled={analyzeDisabled} onClick={analyze} type="button">
              {analyzing ? <LoaderCircle aria-hidden="true" size={17} /> : <Sparkles aria-hidden="true" size={17} />}
              Analizar
            </button>
          </div>
        </div>

        {!aiAnalysisReady && aiSettings.authMode !== "none" ? (
          <p className="empty-line">El analisis local funciona siempre. Para coaching IA, configura {aiSettings.apiKeyEnvVar}.</p>
        ) : null}
        {message ? <p className={messageIsError ? "inline-error" : "inline-message"}>{message}</p> : null}
        {currentVideo.transcriptError ? <p className="inline-error">{currentVideo.transcriptError}</p> : null}

        {analysis ? (
          <div className="analysis-grid">
            <article className="score-panel">
              <span>Claridad</span>
              <strong>{analysis.clarityScore}%</strong>
              <small>{analysis.wordCount} palabras - {analysis.sentenceCount} frases</small>
            </article>

            <article className="analysis-panel">
              <h3>
                <BarChart3 aria-hidden="true" size={16} />
                Muletillas
              </h3>
              <div className="filler-stack">
                {analysis.topFillers.length === 0 ? (
                  <p className="empty-line">No detectadas.</p>
                ) : (
                  analysis.topFillers.map((filler) => (
                    <div className="filler-row" key={filler.phrase}>
                      <span>{filler.phrase}</span>
                      <strong>{filler.count}</strong>
                      <small>{filler.perThousandWords}/1000</small>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="analysis-panel">
              <h3>
                <ListChecks aria-hidden="true" size={16} />
                Ritmo verbal
              </h3>
              <div className="metric-stack">
                <div>
                  <span>Muletillas / 1000 palabras</span>
                  <strong>{analysis.fillerRate}</strong>
                </div>
                <div>
                  <span>Total de muletillas</span>
                  <strong>{analysis.fillerTotal}</strong>
                </div>
              </div>
            </article>

            <article className="analysis-panel">
              <h3>Estructura</h3>
              <div className="signal-list">
                {analysis.structureSignals.map((signal) => (
                  <div className={signal.count > 0 ? "structure-row is-on" : "structure-row"} key={signal.name}>
                    <span>{signal.name}</span>
                    <strong>{signal.count}</strong>
                    <small>{signal.examples.length > 0 ? signal.examples.join(", ") : "sin senales"}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="analysis-panel">
              <h3>
                <Repeat2 aria-hidden="true" size={16} />
                Repeticiones
              </h3>
              <div className="filler-stack">
                {analysis.repeatedTerms.length === 0 ? (
                  <p className="empty-line">Sin terminos dominantes.</p>
                ) : (
                  analysis.repeatedTerms.map((term) => (
                    <div className="filler-row" key={term.term}>
                      <span>{term.term}</span>
                      <strong>{term.count}</strong>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="analysis-panel">
              <h3>Frases repetidas</h3>
              <div className="filler-stack">
                {analysis.repeatedPhrases.length === 0 ? (
                  <p className="empty-line">No hay bucles claros.</p>
                ) : (
                  analysis.repeatedPhrases.map((phrase) => (
                    <div className="filler-row" key={phrase.term}>
                      <span>{phrase.term}</span>
                      <strong>{phrase.count}</strong>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="analysis-panel wide">
              <h3>Correcciones</h3>
              <ul className="recommendations">
                {analysis.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {(currentVideo.aiCoachNotes ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        ) : (
          <p className="empty-line">Sin analisis guardado.</p>
        )}
      </div>
    </section>
  );
}
