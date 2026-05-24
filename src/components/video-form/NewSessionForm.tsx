"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Tags, Upload } from "lucide-react";
import type { VideoEntry } from "@/types/video";

type Props = {
  onCreated: (entry: VideoEntry) => void;
};

type UploadPhase = "idle" | "creating" | "uploading" | "finalizing" | "local";

type UploadSessionPayload = {
  code?: string;
  entry?: VideoEntry;
  error?: string;
  uploadUrl?: string;
  uploadFileName?: string;
};

type FinalizePayload = {
  entry?: VideoEntry;
  error?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uploadPhaseLabel(phase: UploadPhase) {
  if (phase === "creating") return "Creando sesion en Drive...";
  if (phase === "uploading") return "Subiendo directo a Drive...";
  if (phase === "finalizing") return "Marcando como pendiente de procesar...";
  if (phase === "local") return "Procesando en local...";
  return "";
}

async function readJsonPayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export function NewSessionForm({ onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [fecha, setFecha] = useState(today());
  const [titulo, setTitulo] = useState("");
  const [tema, setTema] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [notasMeGusto, setNotasMeGusto] = useState("");
  const [notasMejorar, setNotasMejorar] = useState("");

  const fileLabel = useMemo(() => file?.name ?? "Seleccionar video", [file]);

  function resetForm(form: HTMLFormElement) {
    setFile(null);
    setTitulo("");
    setTema("");
    setEtiquetas("");
    setNotasMeGusto("");
    setNotasMejorar("");
    setFecha(today());
    form.reset();
  }

  async function createWithLocalUpload(formData: FormData) {
    setUploadPhase("local");
    const response = await fetch("/api/videos", {
      method: "POST",
      body: formData,
    });
    const payload = await readJsonPayload<{ entry?: VideoEntry; error?: string }>(response);

    if (!response.ok || !payload.entry) {
      throw new Error(payload.error || "No se pudo subir.");
    }

    return payload.entry;
  }

  async function markDriveUploadError(entry: VideoEntry, message: string) {
    try {
      const response = await fetch("/api/videos/finalize-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, status: "error", error: message }),
      });
      const payload = await readJsonPayload<FinalizePayload>(response);

      if (response.ok && payload.entry) {
        onCreated(payload.entry);
      }
    } catch {
      // The visible form error still explains the failed upload to the user.
    }
  }

  async function finalizeUploadedDriveEntry(input: {
    fileId?: string;
    fileName?: string;
    id: string;
    mimeType?: string;
    size?: number;
    webViewLink?: string;
  }) {
    setUploadPhase("finalizing");
    const finalizeResponse = await fetch("/api/videos/finalize-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        status: "uploaded",
      }),
    });
    const finalizePayload = await readJsonPayload<FinalizePayload>(finalizeResponse);

    if (!finalizeResponse.ok || !finalizePayload.entry) {
      throw new Error(finalizePayload.error || "No se pudo finalizar la subida.");
    }

    return finalizePayload.entry;
  }

  async function createWithDriveUpload() {
    if (!file) {
      throw new Error("Selecciona un video.");
    }

    setUploadPhase("creating");
    const sessionResponse = await fetch("/api/drive/upload-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha,
        titulo,
        tema,
        etiquetas,
        notasMeGusto,
        notasMejorar,
        originalFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      }),
    });
    const sessionPayload = await readJsonPayload<UploadSessionPayload>(sessionResponse);

    if (sessionResponse.status === 409 && sessionPayload.code === "LOCAL_STORAGE_DRIVER") {
      return null;
    }

    if (!sessionResponse.ok || !sessionPayload.entry || !sessionPayload.uploadUrl) {
      throw new Error(sessionPayload.error || "No se pudo iniciar la subida a Drive.");
    }

    onCreated(sessionPayload.entry);
    setUploadPhase("uploading");

    try {
      const uploadResponse = await fetch(sessionPayload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes 0-${file.size - 1}/${file.size}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      const uploadPayload = await readJsonPayload<{
        id?: string;
        name?: string;
        mimeType?: string;
        size?: string;
        webViewLink?: string;
        error?: { message?: string };
      }>(uploadResponse);

      if (!uploadResponse.ok || !uploadPayload.id) {
        throw new Error(uploadPayload.error?.message || `Google Drive respondio HTTP ${uploadResponse.status}.`);
      }

      return finalizeUploadedDriveEntry({
        id: sessionPayload.entry.id,
        fileId: uploadPayload.id,
        fileName: uploadPayload.name || sessionPayload.uploadFileName,
        mimeType: uploadPayload.mimeType || file.type,
        size: uploadPayload.size ? Number(uploadPayload.size) : file.size,
        webViewLink: uploadPayload.webViewLink,
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "No se pudo subir a Drive.";
      try {
        return await finalizeUploadedDriveEntry({
          id: sessionPayload.entry.id,
          fileName: sessionPayload.uploadFileName,
          mimeType: file.type,
          size: file.size,
        });
      } catch {
        // If Google accepted the bytes but hid the response from the browser, the server lookup above recovers it.
      }
      await markDriveUploadError(sessionPayload.entry, message);
      throw uploadError;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");

    if (!file) {
      setError("Selecciona un video.");
      return;
    }

    const formData = new FormData();
    formData.set("video", file);
    formData.set("fecha", fecha);
    formData.set("titulo", titulo);
    formData.set("tema", tema);
    formData.set("etiquetas", etiquetas);
    formData.set("notasMeGusto", notasMeGusto);
    formData.set("notasMejorar", notasMejorar);

    setBusy(true);

    try {
      const driveEntry = await createWithDriveUpload();
      const entry = driveEntry ?? (await createWithLocalUpload(formData));

      onCreated(entry);
      resetForm(form);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo subir.");
    } finally {
      setBusy(false);
      setUploadPhase("idle");
    }
  }

  return (
    <form className="new-session-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <Upload aria-hidden="true" size={19} />
        <h2>Nueva sesion</h2>
      </div>

      <label className="file-picker">
        <input
          accept="video/*,audio/*"
          name="video"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <span>{fileLabel}</span>
      </label>

      <label>
        <span>Titulo</span>
        <input
          placeholder="Video 1"
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
        />
      </label>

      <label>
        <span>Tema</span>
        <input
          placeholder="Presentacion, pausas, storytelling"
          value={tema}
          onChange={(event) => setTema(event.target.value)}
        />
      </label>

      <div className="field-row">
        <label>
          <span>
            <CalendarDays aria-hidden="true" size={14} />
            Fecha
          </span>
          <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
        </label>
        <label>
          <span>
            <Tags aria-hidden="true" size={14} />
            Tags
          </span>
          <input
            placeholder="camara, pausa"
            value={etiquetas}
            onChange={(event) => setEtiquetas(event.target.value)}
          />
        </label>
      </div>

      <label>
        <span>Me gusto</span>
        <textarea value={notasMeGusto} onChange={(event) => setNotasMeGusto(event.target.value)} />
      </label>

      <label>
        <span>Mejorar</span>
        <textarea value={notasMejorar} onChange={(event) => setNotasMejorar(event.target.value)} />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      {busy && uploadPhase !== "idle" ? <p className="inline-message">{uploadPhaseLabel(uploadPhase)}</p> : null}

      <button className="primary-action" disabled={busy} type="submit">
        <Plus aria-hidden="true" size={18} />
        {busy ? "Subiendo" : "Crear sesion"}
      </button>
    </form>
  );
}
