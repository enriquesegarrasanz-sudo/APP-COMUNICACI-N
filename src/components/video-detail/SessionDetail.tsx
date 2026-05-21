"use client";

import { useState } from "react";
import {
  Brain,
  FileText,
  LoaderCircle,
  Mic2,
  PenLine,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { TranscriptionProvider, VideoEntry } from "@/types/video";

type Props = {
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

export function SessionDetail({ video, onEntryChange, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(video));
  const [provider, setProvider] = useState<TranscriptionProvider>("local");
  const [useAi, setUseAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");

  if (!video) {
    return (
      <section className="session-detail empty-detail">
        <Mic2 aria-hidden="true" size={30} />
        <h2>Sin sesion seleccionada</h2>
      </section>
    );
  }

  const currentVideo = video;

  function updateDraft<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function patchVideo() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/videos/${currentVideo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          etiquetas: draft.etiquetas
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      const payload = (await response.json()) as { entry?: VideoEntry; error?: string };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "No se pudo guardar.");
      }

      onEntryChange(payload.entry);
      setMessage("Guardado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function transcribe() {
    setTranscribing(true);
    setMessage("");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentVideo.id, provider }),
      });
      const payload = (await response.json()) as { entry?: VideoEntry; error?: string };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "No se pudo transcribir.");
      }

      onEntryChange(payload.entry);
      setDraft(toDraft(payload.entry));
      setMessage("Transcripcion lista.");
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
      if (draft.transcript !== currentVideo.transcript) {
        await patchVideo();
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentVideo.id, useAi }),
      });
      const payload = (await response.json()) as { entry?: VideoEntry; error?: string };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "No se pudo analizar.");
      }

      onEntryChange(payload.entry);
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

  return (
    <section className="session-detail">
      <div className="detail-header">
        <div>
          <p>Sesion #{currentVideo.numero}</p>
          <h1>{currentVideo.titulo}</h1>
        </div>
        <StatusPill status={currentVideo.transcriptStatus} />
      </div>

      <div className="detail-grid">
        <div className="video-surface">
          <video controls src={currentVideo.videoUrl} />
        </div>

        <div className="edit-surface">
          <div className="surface-title">
            <PenLine aria-hidden="true" size={18} />
            <h2>Ficha</h2>
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
            <button className="secondary-action" disabled={saving} onClick={patchVideo} type="button">
              {saving ? <LoaderCircle aria-hidden="true" size={17} /> : <Save aria-hidden="true" size={17} />}
              Guardar
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
            <select value={provider} onChange={(event) => setProvider(event.target.value as TranscriptionProvider)}>
              <option value="local">Whisper local</option>
              <option value="openai">OpenAI API</option>
            </select>
            <button className="secondary-action" disabled={transcribing} onClick={transcribe} type="button">
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
              <input checked={useAi} type="checkbox" onChange={(event) => setUseAi(event.target.checked)} />
              IA
            </label>
            <button className="primary-action" disabled={analyzing || !draft.transcript.trim()} onClick={analyze} type="button">
              {analyzing ? <LoaderCircle aria-hidden="true" size={17} /> : <Sparkles aria-hidden="true" size={17} />}
              Analizar
            </button>
          </div>
        </div>

        {message ? <p className="inline-message">{message}</p> : null}
        {currentVideo.transcriptError ? <p className="inline-error">{currentVideo.transcriptError}</p> : null}

        {analysis ? (
          <div className="analysis-grid">
            <article className="score-panel">
              <span>Claridad</span>
              <strong>{analysis.clarityScore}%</strong>
              <small>{analysis.wordCount} palabras</small>
            </article>

            <article className="analysis-panel">
              <h3>Muletillas</h3>
              <div className="filler-stack">
                {analysis.topFillers.length === 0 ? (
                  <p className="empty-line">No detectadas.</p>
                ) : (
                  analysis.topFillers.map((filler) => (
                    <div className="filler-row" key={filler.phrase}>
                      <span>{filler.phrase}</span>
                      <strong>{filler.count}</strong>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="analysis-panel">
              <h3>Estructura</h3>
              <div className="signal-list">
                {analysis.structureSignals.map((signal) => (
                  <span className={signal.count > 0 ? "is-on" : ""} key={signal.name}>
                    {signal.name}
                  </span>
                ))}
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
