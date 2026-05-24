"use client";

import { useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  History,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Save,
  Server,
  Terminal,
} from "lucide-react";
import { deepseekAiSettings, defaultAiSettings, ollamaAiSettings, ollamaAnalysisModels } from "@/lib/ai-defaults";
import type { AiSettingsStatus } from "@/types/video";

type Props = {
  initialSettings?: AiSettingsStatus;
  onSaved: (settings: AiSettingsStatus) => void;
};

const fallbackAiSettings: AiSettingsStatus = {
  ...defaultAiSettings,
  apiKeyConfigured: false,
};

type SupportedProvider = "deepseek" | "ollama";
type LocalToolAction = "ollama" | "whisper";

export function AiSettingsPanel({ initialSettings, onSaved }: Props) {
  const [draft, setDraft] = useState<AiSettingsStatus>(() => initialSettings ?? fallbackAiSettings);
  const [deepseekKeyConfigured, setDeepseekKeyConfigured] = useState(
    () => initialSettings?.providerKind !== "ollama" && Boolean(initialSettings?.apiKeyConfigured),
  );
  const [saving, setSaving] = useState(false);
  const [checkingTool, setCheckingTool] = useState<LocalToolAction | "">("");
  const [message, setMessage] = useState("");
  const selectedProvider: SupportedProvider = draft.providerKind === "ollama" ? "ollama" : "deepseek";
  const isOllama = selectedProvider === "ollama";
  const providerReady = isOllama ? true : draft.apiKeyConfigured;
  const messageIsSuccess =
    message.includes("conectado") ||
    message.includes("responde") ||
    message.includes("inicio") ||
    message.includes("lista");

  function selectProvider(provider: SupportedProvider) {
    const preset = provider === "ollama" ? ollamaAiSettings : deepseekAiSettings;

    setDraft({
      ...preset,
      ollamaStartCommand: draft.ollamaStartCommand,
      whisperCommand: draft.whisperCommand,
      whisperModel: draft.whisperModel,
      apiKeyConfigured: provider === "ollama" ? true : deepseekKeyConfigured,
    });
    setMessage("");
  }

  function localSettingsPayload() {
    return {
      analysisModel: draft.analysisModel,
      baseUrl: draft.baseUrl,
      ollamaStartCommand: draft.ollamaStartCommand,
      providerKind: selectedProvider,
      whisperCommand: draft.whisperCommand,
      whisperModel: draft.whisperModel,
    };
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...localSettingsPayload(),
        }),
      });
      const payload = (await response.json()) as { settings?: AiSettingsStatus; error?: string };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "No se pudo guardar la conexion IA.");
      }

      setDraft(payload.settings);

      if (payload.settings.providerKind === "deepseek") {
        setDeepseekKeyConfigured(payload.settings.apiKeyConfigured);
      }

      onSaved(payload.settings);
      setMessage(payload.settings.providerKind === "ollama" ? "Ollama local conectado." : "DeepSeek conectado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la conexion IA.");
    } finally {
      setSaving(false);
    }
  }

  async function checkLocalTool(action: LocalToolAction) {
    setCheckingTool(action);
    setMessage("");

    try {
      const response = await fetch("/api/settings/ai/local-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          settings: localSettingsPayload(),
        }),
      });
      const payload = (await response.json()) as { result?: { detail?: string }; error?: string };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "No se pudo comprobar la herramienta local.");
      }

      setMessage(payload.result.detail || "Herramienta local lista.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo comprobar la herramienta local.");
    } finally {
      setCheckingTool("");
    }
  }

  return (
    <section className="ai-settings-panel" aria-label="Conectar con IA">
      <div className="section-heading">
        <div>
          <p>IA</p>
          <h2>Conectar con IA</h2>
        </div>
        <BrainCircuit aria-hidden="true" size={20} />
      </div>

      <div className="ai-status-row">
        <span className={providerReady ? "connection-status is-ready" : "connection-status is-missing"}>
          {providerReady ? (
            <CheckCircle2 aria-hidden="true" size={16} />
          ) : (
            <AlertCircle aria-hidden="true" size={16} />
          )}
          {isOllama ? "Local sin clave" : draft.apiKeyConfigured ? "Clave detectada" : "Clave pendiente"}
        </span>
        <small>{isOllama ? draft.baseUrl : "DEEPSEEK_API_KEY"}</small>
      </div>

      <div className="ai-provider-grid" aria-label="Proveedor de analisis IA">
        <button
          className={`ai-provider-card ${selectedProvider === "deepseek" ? "is-active" : ""}`}
          onClick={() => selectProvider("deepseek")}
          type="button"
        >
          <Server aria-hidden="true" size={18} />
          <span>
            <strong>DeepSeek API</strong>
            <small>Analisis textual en la nube con tu clave.</small>
          </span>
        </button>
        <button
          className={`ai-provider-card ${selectedProvider === "ollama" ? "is-active" : ""}`}
          onClick={() => selectProvider("ollama")}
          type="button"
        >
          <Cpu aria-hidden="true" size={18} />
          <span>
            <strong>Ollama local</strong>
            <small>Qwen corre en tu ordenador, sin gastar API.</small>
          </span>
        </button>
      </div>

      <div className="deepseek-summary">
        <span>
          {isOllama ? <Cpu aria-hidden="true" size={16} /> : <KeyRound aria-hidden="true" size={16} />}
          {isOllama ? "Servidor local" : "Variable en Vercel y local"}
        </span>
        <strong>{isOllama ? draft.baseUrl : "DEEPSEEK_API_KEY"}</strong>
        <small>
          {isOllama
            ? "Ollama debe estar abierto en este ordenador para analizar con Qwen."
            : "DeepSeek analiza transcripciones ya escritas y genera coaching de oratoria."}
        </small>
      </div>

      {isOllama ? (
        <div className="settings-grid local-tool-grid">
          <label className="model-select">
            <span>
              <History aria-hidden="true" size={16} />
              Modelo Qwen
            </span>
            <select
              value={draft.analysisModel}
              onChange={(event) => setDraft((current) => ({ ...current, analysisModel: event.target.value }))}
            >
              {ollamaAnalysisModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <small>Recomendado: qwen3:14b para coaching textual. qwen3-vl:8b queda preparado para vision.</small>
          </label>

          <label>
            <span>
              <Server aria-hidden="true" size={16} />
              URL Ollama
            </span>
            <input
              value={draft.baseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
            />
          </label>

          <label>
            <span>
              <Terminal aria-hidden="true" size={16} />
              Comando Ollama
            </span>
            <input
              value={draft.ollamaStartCommand}
              onChange={(event) =>
                setDraft((current) => ({ ...current, ollamaStartCommand: event.target.value }))
              }
            />
          </label>

          <button
            className="secondary-action"
            disabled={saving || checkingTool !== ""}
            onClick={() => void checkLocalTool("ollama")}
            type="button"
          >
            {checkingTool === "ollama" ? (
              <LoaderCircle aria-hidden="true" size={17} />
            ) : (
              <RefreshCw aria-hidden="true" size={17} />
            )}
            Probar Ollama
          </button>
        </div>
      ) : (
        <div className="deepseek-summary">
          <span>
            <History aria-hidden="true" size={16} />
            Modelo de analisis
          </span>
          <strong>{draft.analysisModel}</strong>
          <small>La transcripcion sigue usando Whisper local en tu ordenador.</small>
        </div>
      )}

      <div className="deepseek-summary">
        <span>
          <Terminal aria-hidden="true" size={16} />
          Whisper local
        </span>
        <strong>{draft.whisperModel}</strong>
        <small>La transcripcion se ejecuta con un comando local antes de guardar el texto.</small>
      </div>

      <div className="settings-grid local-tool-grid">
        <label>
          <span>
            <Terminal aria-hidden="true" size={16} />
            Comando Whisper
          </span>
          <input
            value={draft.whisperCommand}
            onChange={(event) => setDraft((current) => ({ ...current, whisperCommand: event.target.value }))}
          />
        </label>
        <label>
          <span>
            <History aria-hidden="true" size={16} />
            Modelo Whisper
          </span>
          <input
            value={draft.whisperModel}
            onChange={(event) => setDraft((current) => ({ ...current, whisperModel: event.target.value }))}
          />
        </label>
        <button
          className="secondary-action"
          disabled={saving || checkingTool !== ""}
          onClick={() => void checkLocalTool("whisper")}
          type="button"
        >
          {checkingTool === "whisper" ? (
            <LoaderCircle aria-hidden="true" size={17} />
          ) : (
            <RefreshCw aria-hidden="true" size={17} />
          )}
          Probar Whisper
        </button>
      </div>

      {message ? <p className={messageIsSuccess ? "inline-message" : "inline-error"}>{message}</p> : null}

      <button className="secondary-action" disabled={saving || checkingTool !== ""} onClick={saveSettings} type="button">
        {saving ? <LoaderCircle aria-hidden="true" size={17} /> : <Save aria-hidden="true" size={17} />}
        Guardar conexion IA
      </button>
    </section>
  );
}
