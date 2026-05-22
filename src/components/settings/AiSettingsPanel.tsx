"use client";

import { useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Eye,
  FileAudio2,
  History,
  KeyRound,
  LoaderCircle,
  PlugZap,
  Save,
  Settings2,
} from "lucide-react";
import type { AiProviderKind, AiSettings, AiSettingsStatus } from "@/types/video";

type Props = {
  initialSettings: AiSettingsStatus;
  onSaved: (settings: AiSettingsStatus) => void;
};

const providerDefaults: Record<AiProviderKind, Partial<AiSettings>> = {
  openai: {
    providerName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnvVar: "OPENAI_API_KEY",
    transcriptionModel: "gpt-4o-mini-transcribe",
    analysisModel: "gpt-5.4-nano",
    visionModel: "gpt-5.4-nano",
    transcriptionEnabled: true,
    transcriptAnalysisEnabled: true,
  },
  "openai-compatible": {
    providerName: "API compatible",
    baseUrl: "https://api.tu-proveedor.com/v1",
    apiKeyEnvVar: "AI_API_KEY",
    transcriptionModel: "whisper-large-v3",
    analysisModel: "modelo-chat",
    visionModel: "modelo-vision",
    transcriptionEnabled: true,
    transcriptAnalysisEnabled: true,
  },
  anthropic: {
    providerName: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    analysisModel: "claude-sonnet-4-5",
    visionModel: "claude-sonnet-4-5",
    transcriptionEnabled: false,
    transcriptAnalysisEnabled: true,
  },
  google: {
    providerName: "Google AI",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnvVar: "GOOGLE_API_KEY",
    analysisModel: "gemini-2.5-flash",
    visionModel: "gemini-2.5-flash",
    transcriptionEnabled: false,
    transcriptAnalysisEnabled: true,
  },
  mistral: {
    providerName: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyEnvVar: "MISTRAL_API_KEY",
    analysisModel: "mistral-small-latest",
    visionModel: "pixtral-large-latest",
    transcriptionEnabled: false,
    transcriptAnalysisEnabled: true,
  },
  custom: {
    providerName: "Proveedor propio",
    baseUrl: "https://api.tu-proveedor.com/v1",
    apiKeyEnvVar: "AI_API_KEY",
    transcriptionModel: "modelo-transcripcion",
    analysisModel: "modelo-analisis",
    visionModel: "modelo-vision",
    transcriptionEnabled: true,
    transcriptAnalysisEnabled: true,
  },
};

const providerLabels: Array<{ value: AiProviderKind; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "openai-compatible", label: "OpenAI compatible" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google AI" },
  { value: "mistral", label: "Mistral" },
  { value: "custom", label: "Custom" },
];

function ToggleRow({
  checked,
  helper,
  icon,
  label,
  onChange,
}: {
  checked: boolean;
  helper: string;
  icon: React.ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting-toggle">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span>{icon}</span>
      <strong>{label}</strong>
      <small>{helper}</small>
    </label>
  );
}

export function AiSettingsPanel({ initialSettings, onSaved }: Props) {
  const [draft, setDraft] = useState<AiSettingsStatus>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateDraft<Key extends keyof AiSettings>(key: Key, value: AiSettings[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseProvider(providerKind: AiProviderKind) {
    const defaults = providerDefaults[providerKind];
    setDraft((current) => ({
      ...current,
      ...defaults,
      providerKind,
      apiKeyConfigured: false,
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { settings?: AiSettingsStatus; error?: string };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "No se pudo guardar la configuracion.");
      }

      setDraft(payload.settings);
      onSaved(payload.settings);
      setMessage("Configuracion IA guardada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuracion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ai-settings-panel" aria-label="Conexiones IA">
      <div className="section-heading">
        <div>
          <p>Configuracion</p>
          <h2>Conexiones IA</h2>
        </div>
        <Settings2 aria-hidden="true" size={20} />
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
        <small>{draft.apiKeyEnvVar}</small>
      </div>

      <div className="settings-grid">
        <label>
          <span>
            <PlugZap aria-hidden="true" size={14} />
            Proveedor
          </span>
          <select value={draft.providerKind} onChange={(event) => chooseProvider(event.target.value as AiProviderKind)}>
            {providerLabels.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Nombre visible</span>
          <input value={draft.providerName} onChange={(event) => updateDraft("providerName", event.target.value)} />
        </label>

        <label className="wide-field">
          <span>Base URL API</span>
          <input value={draft.baseUrl} onChange={(event) => updateDraft("baseUrl", event.target.value)} />
        </label>

        <label>
          <span>
            <KeyRound aria-hidden="true" size={14} />
            Variable de clave
          </span>
          <input value={draft.apiKeyEnvVar} onChange={(event) => updateDraft("apiKeyEnvVar", event.target.value)} />
        </label>

        <label>
          <span>Modelo transcripcion</span>
          <input
            value={draft.transcriptionModel}
            onChange={(event) => updateDraft("transcriptionModel", event.target.value)}
          />
        </label>

        <label>
          <span>Modelo analisis</span>
          <input value={draft.analysisModel} onChange={(event) => updateDraft("analysisModel", event.target.value)} />
        </label>

        <label>
          <span>Modelo vision</span>
          <input value={draft.visionModel} onChange={(event) => updateDraft("visionModel", event.target.value)} />
        </label>
      </div>

      <div className="setting-toggles">
        <ToggleRow
          checked={draft.transcriptionEnabled}
          helper="Audio o video a texto"
          icon={<FileAudio2 aria-hidden="true" size={16} />}
          label="Transcribir"
          onChange={(checked) => updateDraft("transcriptionEnabled", checked)}
        />
        <ToggleRow
          checked={draft.transcriptAnalysisEnabled}
          helper="Estructura, muletillas y claridad"
          icon={<BrainCircuit aria-hidden="true" size={16} />}
          label="Analizar texto"
          onChange={(checked) => updateDraft("transcriptAnalysisEnabled", checked)}
        />
        <ToggleRow
          checked={draft.videoAnalysisEnabled}
          helper="Postura, mirada y gestos si hay vision"
          icon={<Eye aria-hidden="true" size={16} />}
          label="Analizar cuerpo"
          onChange={(checked) => updateDraft("videoAnalysisEnabled", checked)}
        />
        <ToggleRow
          checked={draft.historyContextEnabled}
          helper="Usar progreso acumulado"
          icon={<History aria-hidden="true" size={16} />}
          label="Contexto historico"
          onChange={(checked) => updateDraft("historyContextEnabled", checked)}
        />
      </div>

      <label className="context-field">
        <span>Contexto de la aplicacion para la IA</span>
        <textarea
          value={draft.applicationContext}
          onChange={(event) => updateDraft("applicationContext", event.target.value)}
        />
      </label>

      {message ? <p className={message.includes("guardada") ? "inline-message" : "inline-error"}>{message}</p> : null}

      <button className="secondary-action" disabled={saving} onClick={saveSettings} type="button">
        {saving ? <LoaderCircle aria-hidden="true" size={17} /> : <Save aria-hidden="true" size={17} />}
        Guardar IA
      </button>
    </section>
  );
}
