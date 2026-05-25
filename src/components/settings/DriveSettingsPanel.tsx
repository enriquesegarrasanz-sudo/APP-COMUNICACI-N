"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  FolderKey,
  Link2Off,
  LoaderCircle,
  LogIn,
  PlugZap,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { defaultDriveSettings } from "@/lib/ai-defaults";
import type { DriveSettings, DriveSettingsStatus } from "@/types/video";

type Props = {
  initialSettings?: DriveSettingsStatus;
  onSaved: (settings: DriveSettingsStatus) => void;
};

const fallbackDriveSettings: DriveSettingsStatus = {
  ...defaultDriveSettings,
  authMode: "none",
  oauthConnected: false,
  writable: false,
  ready: false,
};

type DriveAuthStatusPayload = {
  connected: boolean;
  mode: DriveSettingsStatus["authMode"];
  writable: boolean;
};

function readOAuthRedirectMessage(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const result = params.get("driveOAuth");
  if (result === "success") return "Google Drive conectado correctamente.";
  if (result === "error") {
    const detail = params.get("detail") || "Error desconocido";
    return "Error al conectar Google Drive: " + detail;
  }
  return "";
}

export function DriveSettingsPanel({ initialSettings, onSaved }: Props) {
  const [draft, setDraft] = useState<DriveSettingsStatus>(() => initialSettings ?? fallbackDriveSettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  const refreshOAuthStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/google/oauth/status");

      if (!response.ok) {
        setMessage("No se pudo comprobar el estado de Google Drive.");
        return;
      }

      const payload = (await response.json()) as DriveAuthStatusPayload;
      setDraft((current) => ({
        ...current,
        oauthConnected: payload.connected,
        authMode: payload.mode,
        writable: payload.writable,
        ready: current.enabled && payload.writable && current.folderId.trim().length > 0,
      }));
    } catch {
      setMessage("Sin conexion con el servidor. Comprueba tu red.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const redirectMessage = readOAuthRedirectMessage();

      if (redirectMessage) {
        setMessage(redirectMessage);
        window.history.replaceState({}, "", window.location.pathname);
      }

      refreshOAuthStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshOAuthStatus]);

  function updateDraft<Key extends keyof DriveSettings>(key: Key, value: DriveSettings[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/drive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { settings?: DriveSettingsStatus; error?: string };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "No se pudo guardar Drive.");
      }

      setDraft(payload.settings);
      onSaved(payload.settings);
      setMessage("Conexion Drive guardada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar Drive.");
    } finally {
      setSaving(false);
    }
  }

  function connectOAuth() {
    window.location.href = "/api/google/oauth/start";
  }

  async function testConnection() {
    setTesting(true);
    setMessage("");

    try {
      const response = await fetch("/api/drive/health");
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        user?: { displayName?: string; emailAddress?: string };
        quota?: { usedMb?: number; limitMb?: number | null };
      };

      if (payload.ok) {
        const user = payload.user?.emailAddress || payload.user?.displayName || "";
        const quota = payload.quota?.usedMb != null ? ` | ${payload.quota.usedMb} MB usados` : "";
        setMessage(`Drive OK${user ? ` (${user})` : ""}${quota}`);
      } else {
        setMessage(payload.error || "No se pudo conectar con Drive.");
      }
    } catch {
      setMessage("Sin conexion con el servidor.");
    } finally {
      setTesting(false);
    }
  }

  async function disconnectOAuth() {
    setSaving(true);
    setMessage("");

    try {
      await fetch("/api/google/oauth/disconnect", { method: "POST" });
      setDraft((current) => ({ ...current, authMode: "none", oauthConnected: false, ready: false }));
      setMessage("Google Drive desconectado.");
    } catch {
      setMessage("No se pudo desconectar Google Drive.");
    } finally {
      setSaving(false);
    }
  }

  const statusText = draft.ready
    ? "Drive listo"
    : draft.oauthConnected
      ? draft.enabled
        ? "Falta carpeta"
        : "Drive pausado"
      : "No conectado";
  const connectionDetail =
    draft.authMode === "service-account"
      ? "Service account conectado"
      : draft.oauthConnected
        ? "Google Drive conectado"
        : "OAuth no conectado";
  const connectionWarning =
    draft.authMode === "service-account" && !draft.writable
      ? "La service account puede leer, pero Google no permite crear archivos sin Shared Drive. Conecta OAuth para subir."
      : "";

  const messageClass =
    message.includes("guardada") || message.includes("conectado correctamente") || message.startsWith("Drive OK")
      ? "inline-message"
      : "inline-error";

  return (
    <section className="drive-settings-panel" aria-label="Conexion Google Drive">
      <div className="section-heading">
        <div>
          <p>Configuracion</p>
          <h2>Drive y procesado</h2>
        </div>
        <Cloud aria-hidden="true" size={20} />
      </div>

      {connectionWarning ? <p className="inline-error">{connectionWarning}</p> : null}

      <div className="ai-status-row">
        <span className={draft.oauthConnected ? "connection-status is-ready" : "connection-status is-missing"}>
          {draft.oauthConnected ? (
            <CheckCircle2 aria-hidden="true" size={16} />
          ) : (
            <AlertCircle aria-hidden="true" size={16} />
          )}
          {statusText}
        </span>
        <small>{connectionDetail}</small>
      </div>

      <div className="setting-toggles">
        {!draft.oauthConnected ? (
          <button className="secondary-action" disabled={saving} onClick={connectOAuth} type="button">
            <LogIn aria-hidden="true" size={17} />
            Conectar Google Drive
          </button>
        ) : draft.authMode === "oauth" ? (
          <button className="secondary-action" disabled={saving} onClick={disconnectOAuth} type="button">
            <Link2Off aria-hidden="true" size={17} />
            Desconectar
          </button>
        ) : (
          <span className="connection-status is-ready">
            <CheckCircle2 aria-hidden="true" size={16} />
            Configurado en .env.local
          </span>
        )}
        {draft.oauthConnected ? (
          <button className="secondary-action" disabled={testing || saving} onClick={testConnection} type="button">
            {testing ? (
              <LoaderCircle aria-hidden="true" size={17} />
            ) : (
              <PlugZap aria-hidden="true" size={17} />
            )}
            Test conexion
          </button>
        ) : null}
      </div>

      <div className="setting-toggles">
        <label className="setting-toggle">
          <input checked={draft.enabled} type="checkbox" onChange={(event) => updateDraft("enabled", event.target.checked)} />
          <span>
            <Cloud aria-hidden="true" size={16} />
          </span>
          <strong>Subida Drive</strong>
          <small>MP4 comprimido</small>
        </label>
        <label className="setting-toggle">
          <input
            checked={draft.deleteOriginalAfterProcessing}
            type="checkbox"
            onChange={(event) => updateDraft("deleteOriginalAfterProcessing", event.target.checked)}
          />
          <span>
            <Trash2 aria-hidden="true" size={16} />
          </span>
          <strong>Limpiar original</strong>
          <small>Conservar derivados</small>
        </label>
      </div>

      <div className="settings-grid">
        <label className="wide-field">
          <span>
            <FolderKey aria-hidden="true" size={14} />
            ID carpeta Drive
          </span>
          <input value={draft.folderId} onChange={(event) => updateDraft("folderId", event.target.value)} />
        </label>

        <label>
          <span>
            <SlidersHorizontal aria-hidden="true" size={14} />
            CRF video
          </span>
          <input
            max={35}
            min={18}
            type="number"
            value={draft.compressionCrf}
            onChange={(event) => updateDraft("compressionCrf", Number(event.target.value))}
          />
        </label>

        <label>
          <span>Audio kbps</span>
          <input
            max={160}
            min={24}
            type="number"
            value={draft.audioBitrateKbps}
            onChange={(event) => updateDraft("audioBitrateKbps", Number(event.target.value))}
          />
        </label>
      </div>

      {message ? <p className={messageClass}>{message}</p> : null}

      <button className="secondary-action" disabled={saving} onClick={saveSettings} type="button">
        {saving ? (
          <LoaderCircle aria-hidden="true" size={17} />
        ) : (
          <Save aria-hidden="true" size={17} />
        )}
        Guardar Drive
      </button>
    </section>
  );
}
