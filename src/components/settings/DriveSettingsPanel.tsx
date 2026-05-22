"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  FolderKey,
  KeyRound,
  LoaderCircle,
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
  credentialsConfigured: false,
  ready: false,
};

export function DriveSettingsPanel({ initialSettings, onSaved }: Props) {
  const [draft, setDraft] = useState<DriveSettingsStatus>(() => initialSettings ?? fallbackDriveSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  const statusText = draft.ready ? "Drive listo" : draft.enabled ? "Config pendiente" : "Drive pausado";

  return (
    <section className="drive-settings-panel" aria-label="Conexion Google Drive">
      <div className="section-heading">
        <div>
          <p>Configuracion</p>
          <h2>Drive y procesado</h2>
        </div>
        <Cloud aria-hidden="true" size={20} />
      </div>

      <div className="ai-status-row">
        <span className={draft.ready ? "connection-status is-ready" : "connection-status is-missing"}>
          {draft.ready ? <CheckCircle2 aria-hidden="true" size={16} /> : <AlertCircle aria-hidden="true" size={16} />}
          {statusText}
        </span>
        <small>{draft.serviceAccountEmailEnvVar}</small>
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
            <KeyRound aria-hidden="true" size={14} />
            Variable email SA
          </span>
          <input
            value={draft.serviceAccountEmailEnvVar}
            onChange={(event) => updateDraft("serviceAccountEmailEnvVar", event.target.value)}
          />
        </label>

        <label>
          <span>
            <KeyRound aria-hidden="true" size={14} />
            Variable private key
          </span>
          <input
            value={draft.serviceAccountPrivateKeyEnvVar}
            onChange={(event) => updateDraft("serviceAccountPrivateKeyEnvVar", event.target.value)}
          />
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

      {message ? <p className={message.includes("guardada") ? "inline-message" : "inline-error"}>{message}</p> : null}

      <button className="secondary-action" disabled={saving} onClick={saveSettings} type="button">
        {saving ? <LoaderCircle aria-hidden="true" size={17} /> : <Save aria-hidden="true" size={17} />}
        Guardar Drive
      </button>
    </section>
  );
}
