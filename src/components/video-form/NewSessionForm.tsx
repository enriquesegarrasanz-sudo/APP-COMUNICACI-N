"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Tags, Upload } from "lucide-react";
import type { VideoEntry } from "@/types/video";

type Props = {
  onCreated: (entry: VideoEntry) => void;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function NewSessionForm({ onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fecha, setFecha] = useState(today());
  const [titulo, setTitulo] = useState("");
  const [tema, setTema] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [notasMeGusto, setNotasMeGusto] = useState("");
  const [notasMejorar, setNotasMejorar] = useState("");

  const fileLabel = useMemo(() => file?.name ?? "Seleccionar video", [file]);

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
      const response = await fetch("/api/videos", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { entry?: VideoEntry; error?: string };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "No se pudo subir.");
      }

      onCreated(payload.entry);
      setFile(null);
      setTitulo("");
      setTema("");
      setEtiquetas("");
      setNotasMeGusto("");
      setNotasMejorar("");
      setFecha(today());
      form.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo subir.");
    } finally {
      setBusy(false);
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

      <button className="primary-action" disabled={busy} type="submit">
        <Plus aria-hidden="true" size={18} />
        {busy ? "Procesando" : "Crear sesion"}
      </button>
    </form>
  );
}
