"use client";

import { useState } from "react";
import { AlertCircle, BrainCircuit, CheckCircle2, History, KeyRound, LoaderCircle, Save } from "lucide-react";
import { defaultAiSettings } from "@/lib/ai-defaults";
import type { AiSettingsStatus } from "@/types/video";

type Props = {
  initialSettings?: AiSettingsStatus;
  onSaved: (settings: AiSettingsStatus) => void;
};

const fallbackAiSettings: AiSettingsStatus = {
  ...defaultAiSettings,
  apiKeyConfigured: false,
};

export function AiSettingsPanel({ initialSettings, onSaved }: Props) {
  const [draft, setDraft] = useState<AiSettingsStatus>(() => initialSettings ?? fallbackAiSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { settings?: AiSettingsStatus; error?: string };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "No se pudo conectar DeepSeek.");
      }

      setDraft(payload.settings);
      onSaved(payload.settings);
      setMessage("DeepSeek conectado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo conectar DeepSeek.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ai-settings-panel" aria-label="Conectar con DeepSeek">
      <div className="section-heading">
        <div>
          <p>IA</p>
          <h2>Conectar con DeepSeek</h2>
        </div>
        <BrainCircuit aria-hidden="true" size={20} />
      </div>

      <div className="ai-status-row">
        <span className={draft.apiKeyConfigured ? "connection-status is-ready" : "connection-status is-missing"}>
          {draft.apiKeyConfigured ? (
            <CheckCircle2 aria-hidden="true" size={16} />
          ) : (
            <AlertCircle aria-hidden="true" size={16} />
          )}
          {draft.apiKeyConfigured ? "Clave detectada" : "Clave pendiente"}
        </span>
        <small>DEEPSEEK_API_KEY</small>
      </div>

      <div className="deepseek-summary">
        <span>
          <KeyRound aria-hidden="true" size={16} />
          Variable en Vercel y local
        </span>
        <strong>DEEPSEEK_API_KEY</strong>
        <small>DeepSeek analiza transcripciones ya escritas y genera coaching de oratoria.</small>
      </div>

      <div className="deepseek-summary">
        <span>
          <History aria-hidden="true" size={16} />
          Modelo de analisis
        </span>
        <strong>deepseek-v4-flash</strong>
        <small>La transcripcion sigue usando Whisper local en tu ordenador.</small>
      </div>

      {message ? <p className={message.includes("conectado") ? "inline-message" : "inline-error"}>{message}</p> : null}

      <button className="secondary-action" disabled={saving} onClick={saveSettings} type="button">
        {saving ? <LoaderCircle aria-hidden="true" size={17} /> : <Save aria-hidden="true" size={17} />}
        Conectar DeepSeek
      </button>
    </section>
  );
}
