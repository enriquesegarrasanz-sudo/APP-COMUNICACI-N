"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BookOpen,
  FileVideo2,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LockKeyholeOpen,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";
import {
  DashboardOverview,
  type SessionClassifier,
  type SessionSort,
} from "@/components/dashboard/DashboardOverview";
import { ProgressView } from "@/components/dashboard/ProgressView";
import { VocabularyGallery } from "@/components/dashboard/VocabularyGallery";
import { SessionBoard } from "@/components/dashboard/SessionBoard";
import { AiSettingsPanel } from "@/components/settings/AiSettingsPanel";
import { DriveSettingsPanel } from "@/components/settings/DriveSettingsPanel";
import { NewSessionForm } from "@/components/video-form/NewSessionForm";
import { SessionDetail } from "@/components/video-detail/SessionDetail";
import { defaultAiSettings, defaultDriveSettings } from "@/lib/ai-defaults";
import type { AiSettingsStatus, DriveSettingsStatus, VideoEntry } from "@/types/video";

type AppView = "dashboard" | "sessions" | "progress" | "vocabulary" | "settings";

type AccessStatus = {
  accessConfigured: boolean;
  granted: boolean;
  remote: boolean;
  remoteWritesEnabled: boolean;
  required: boolean;
};

function sortVideos(videos: VideoEntry[]) {
  return [...videos].sort((a, b) => b.numero - a.numero);
}

function getInitialSelectedId(videos: VideoEntry[]) {
  return sortVideos(videos)[0]?.id ?? null;
}

function matchesClassifier(video: VideoEntry, classifier: SessionClassifier) {
  if (classifier === "analyzed") {
    return Boolean(video.analysis);
  }

  if (classifier === "needs-analysis") {
    return !video.analysis;
  }

  if (classifier === "ready") {
    return video.transcriptStatus === "ready";
  }

  if (classifier === "error") {
    return video.transcriptStatus === "error";
  }

  return true;
}

function sortByMode(videos: VideoEntry[], sort: SessionSort) {
  const sorted = [...videos];

  if (sort === "oldest") {
    return sorted.sort((a, b) => a.numero - b.numero);
  }

  if (sort === "clarity") {
    return sorted.sort((a, b) => (b.analysis?.clarityScore ?? -1) - (a.analysis?.clarityScore ?? -1));
  }

  if (sort === "fillers") {
    return sorted.sort((a, b) => (b.analysis?.fillerTotal ?? -1) - (a.analysis?.fillerTotal ?? -1));
  }

  return sorted.sort((a, b) => b.numero - a.numero);
}

type AppShellProps = {
  initialAiSettings?: AiSettingsStatus;
  initialDriveSettings?: DriveSettingsStatus;
  initialVideos: VideoEntry[];
};

const fallbackAiSettings: AiSettingsStatus = {
  ...defaultAiSettings,
  apiKeyConfigured: false,
};

const fallbackDriveSettings: DriveSettingsStatus = {
  ...defaultDriveSettings,
  authMode: "none",
  oauthConnected: false,
  writable: false,
  ready: false,
};

const viewConfig: Array<{ id: AppView; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sessions", label: "Sesiones", icon: FileVideo2 },
  { id: "progress", label: "Progreso", icon: TrendingUp },
  { id: "vocabulary", label: "Vocabulario", icon: BookOpen },
  { id: "settings", label: "Ajustes", icon: Settings },
];

const viewTitles: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Resumen y metricas de tu practica" },
  sessions: { title: "Sesiones", subtitle: "Archivo completo de grabaciones" },
  progress: { title: "Progreso", subtitle: "Evolucion, patrones y tendencias" },
  vocabulary: { title: "Vocabulario", subtitle: "Galeria de habitos linguisticos y expresiones" },
  settings: { title: "Ajustes", subtitle: "Configuracion de IA y almacenamiento" },
};

function SidebarBrand() {
  return (
    <div className="sidebar-brand">
      <span className="sidebar-brand-icon">
        <Image
          alt=""
          aria-hidden="true"
          className="sidebar-brand-logo"
          height={34}
          priority
          src="/brand/speaking-mark.png"
          width={34}
        />
      </span>
      <span className="sidebar-brand-text">
        <strong>SPEAKING</strong>
        <small>camara, voz, progreso</small>
      </span>
    </div>
  );
}

export default function AppShell({ initialAiSettings, initialDriveSettings, initialVideos }: AppShellProps) {
  const [videos, setVideos] = useState(() => sortVideos(initialVideos));
  const [aiSettings, setAiSettings] = useState(() => initialAiSettings ?? fallbackAiSettings);
  const [driveSettings, setDriveSettings] = useState(() => initialDriveSettings ?? fallbackDriveSettings);
  const [selectedId, setSelectedId] = useState<string | null>(() => getInitialSelectedId(initialVideos));
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [showDetail, setShowDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [query, setQuery] = useState("");
  const [classifier, setClassifier] = useState<SessionClassifier>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sort, setSort] = useState<SessionSort>("newest");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [accessSecret, setAccessSecret] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const lastRefreshAtRef = useRef(0);

  const availableTags = useMemo(
    () => [...new Set(videos.flatMap((video) => video.etiquetas))].sort((a, b) => a.localeCompare(b)),
    [videos],
  );

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visible = videos.filter((video) => {
      const searchable = [
        video.titulo,
        video.tema,
        video.fecha,
        video.transcriptStatus,
        ...video.etiquetas,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = normalizedQuery.length === 0 || searchable.includes(normalizedQuery);
      const matchesTag = tagFilter === "all" || video.etiquetas.includes(tagFilter);

      return matchesSearch && matchesTag && matchesClassifier(video, classifier);
    });

    return sortByMode(visible, sort);
  }, [classifier, query, sort, tagFilter, videos]);

  const selected = useMemo(
    () => videos.find((video) => video.id === selectedId) ?? videos[0] ?? null,
    [selectedId, videos],
  );
  const previousVideo = useMemo(() => {
    if (!selected) {
      return null;
    }

    return sortVideos(videos.filter((video) => video.numero < selected.numero))[0] ?? null;
  }, [selected, videos]);

  const refreshAccessStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/access/session", { cache: "no-store" });
      const payload = (await response.json()) as AccessStatus;
      setAccessStatus(payload);
    } catch {
      setAccessStatus(null);
    }
  }, []);

  function upsertEntry(entry: VideoEntry) {
    setVideos((current) => {
      const exists = current.some((video) => video.id === entry.id);
      const next = exists
        ? current.map((video) => (video.id === entry.id ? entry : video))
        : [entry, ...current];

      return sortVideos(next);
    });
    setSelectedId(entry.id);
    setQuery("");
    setClassifier("all");
    setTagFilter("all");
    setShowCreateModal(false);
    setShowDetail(true);
  }

  function removeEntry(id: string) {
    setVideos((current) => {
      const next = current.filter((video) => video.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
    setShowDetail(false);
  }

  function selectSession(id: string) {
    setSelectedId(id);
    setShowDetail(true);
  }

  const refreshVideos = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    setRefreshing(true);

    if (!quiet) {
      setRefreshMessage("");
    }

    try {
      const response = await fetch("/api/videos", { cache: "no-store" });
      const payload = (await response.json()) as { videos?: VideoEntry[]; error?: string };

      if (!response.ok || !payload.videos) {
        throw new Error(payload.error || "No se pudo refrescar.");
      }

      const nextVideos = sortVideos(payload.videos);
      setVideos(nextVideos);
      setSelectedId((current) => {
        if (current && nextVideos.some((video) => video.id === current)) {
          return current;
        }

        return nextVideos[0]?.id ?? null;
      });
      lastRefreshAtRef.current = Date.now();

      if (!quiet) {
        setRefreshMessage("Actualizado");
      }
    } catch (error) {
      if (!quiet) {
        setRefreshMessage(error instanceof Error ? error.message : "Error al refrescar.");
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    lastRefreshAtRef.current = Date.now();

    function refreshWhenReturning() {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (Date.now() - lastRefreshAtRef.current < 15000) {
        return;
      }

      void refreshVideos({ quiet: true });
    }

    document.addEventListener("visibilitychange", refreshWhenReturning);
    window.addEventListener("focus", refreshWhenReturning);

    return () => {
      document.removeEventListener("visibilitychange", refreshWhenReturning);
      window.removeEventListener("focus", refreshWhenReturning);
    };
  }, [refreshVideos]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshAccessStatus();
    }, 0);

    return () => clearTimeout(timer);
  }, [refreshAccessStatus]);

  async function unlockPersonalAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccessSaving(true);
    setAccessMessage("");

    try {
      const response = await fetch("/api/access/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: accessSecret }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo activar el acceso.");
      }

      setAccessSecret("");
      setAccessMessage("Acceso personal activo.");
      await refreshAccessStatus();
    } catch (error) {
      setAccessMessage(error instanceof Error ? error.message : "No se pudo activar el acceso.");
    } finally {
      setAccessSaving(false);
    }
  }

  async function lockPersonalAccess() {
    setAccessSaving(true);
    setAccessMessage("");

    try {
      await fetch("/api/access/session", { method: "DELETE" });
      setAccessMessage("Acceso cerrado.");
      await refreshAccessStatus();
    } catch {
      setAccessMessage("No se pudo cerrar el acceso.");
    } finally {
      setAccessSaving(false);
    }
  }

  function handleBackFromDetail() {
    setShowDetail(false);
  }

  const currentViewInfo = viewTitles[activeView];

  if (showDetail && selected) {
    return (
      <div className="app-layout">
        <aside className="sidebar">
          <SidebarBrand />

          <nav className="sidebar-nav">
            <button
              className="sidebar-item"
              onClick={handleBackFromDetail}
              type="button"
            >
              <FileVideo2 size={20} />
              <span>Volver</span>
            </button>
          </nav>
        </aside>

        <main className="main-content">
          <SessionDetail
            aiSettings={aiSettings}
            key={selected.id}
            previousVideo={previousVideo}
            video={selected}
            onDelete={removeEntry}
            onEntryChange={upsertEntry}
          />
        </main>

        <button
          className="fab-create"
          onClick={() => setShowCreateModal(true)}
          type="button"
        >
          <Plus size={20} />
          <span>Nueva sesion</span>
        </button>

        {showCreateModal ? (
          <>
            <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} />
            <div className="modal-panel">
              <div className="modal-header">
                <h2>Nueva sesion</h2>
                <button className="modal-close" onClick={() => setShowCreateModal(false)} type="button">
                  <X size={18} />
                </button>
              </div>
              <NewSessionForm onCreated={upsertEntry} />
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <SidebarBrand />

        <span className="sidebar-section-label">Menu</span>

        <nav className="sidebar-nav">
          {viewConfig.map((view) => {
            const Icon = view.icon;

            return (
              <button
                className={`sidebar-item ${activeView === view.id ? "is-active" : ""}`}
                key={view.id}
                onClick={() => setActiveView(view.id)}
                type="button"
              >
                <Icon size={20} />
                <span>{view.label}</span>
                {view.id === "sessions" ? (
                  <span className="sidebar-item-badge">{videos.length}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className={`sidebar-item ${refreshing ? "" : ""}`}
            disabled={refreshing}
            onClick={() => void refreshVideos()}
            type="button"
          >
            {refreshing ? <LoaderCircle size={20} /> : <RefreshCw size={20} />}
            <span>{refreshMessage || "Refrescar"}</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {accessStatus?.required ? (
          <section className={`personal-access-panel ${accessStatus.granted ? "is-granted" : ""}`}>
            <div className="panel-title">
              {accessStatus.granted ? (
                <LockKeyholeOpen aria-hidden="true" size={18} />
              ) : (
                <LockKeyhole aria-hidden="true" size={18} />
              )}
              <div>
                <h2>Acceso personal</h2>
                <small>
                  {accessStatus.granted
                    ? "Escrituras remotas habilitadas."
                    : "Introduce la clave para guardar cambios."}
                </small>
              </div>
            </div>

            {!accessStatus.remoteWritesEnabled ? (
              <p className="inline-error">Falta APP_ALLOW_REMOTE_WRITE=true en Vercel.</p>
            ) : !accessStatus.accessConfigured ? (
              <p className="inline-error">Falta APP_ACCESS_SECRET en Vercel.</p>
            ) : accessStatus.granted ? (
              <button className="secondary-action" disabled={accessSaving} onClick={lockPersonalAccess} type="button">
                <LogOut aria-hidden="true" size={17} />
                Cerrar acceso
              </button>
            ) : (
              <form className="personal-access-form" onSubmit={unlockPersonalAccess}>
                <label>
                  <span>
                    <KeyRound aria-hidden="true" size={14} />
                    Clave privada
                  </span>
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setAccessSecret(event.target.value)}
                    type="password"
                    value={accessSecret}
                  />
                </label>
                <button className="primary-action" disabled={accessSaving || accessSecret.trim().length === 0} type="submit">
                  {accessSaving ? <LoaderCircle aria-hidden="true" size={17} /> : <LockKeyholeOpen aria-hidden="true" size={17} />}
                  Entrar
                </button>
              </form>
            )}

            {accessMessage ? (
              <p className={accessMessage.includes("activo") ? "inline-message" : "inline-error"}>{accessMessage}</p>
            ) : null}
          </section>
        ) : null}

        <div className="main-header">
          <div className="main-header-title">
            <p>{currentViewInfo.subtitle}</p>
            <h1>{currentViewInfo.title}</h1>
          </div>
          <div className="main-header-actions">
            {refreshMessage ? <span className="inline-message" style={{ fontSize: "0.8rem" }}>{refreshMessage}</span> : null}
          </div>
        </div>

        {activeView === "dashboard" ? (
          <DashboardOverview
            availableTags={availableTags}
            classifier={classifier}
            query={query}
            selectedTag={tagFilter}
            sort={sort}
            videos={videos}
            visibleCount={filteredVideos.length}
            onClassifierChange={setClassifier}
            onQueryChange={setQuery}
            onSortChange={setSort}
            onTagChange={setTagFilter}
          />
        ) : null}

        {activeView === "sessions" ? (
          <SessionBoard selectedId={selected?.id ?? null} videos={filteredVideos} onSelect={selectSession} />
        ) : null}

        {activeView === "progress" ? (
          <ProgressView videos={videos} />
        ) : null}

        {activeView === "vocabulary" ? (
          <VocabularyGallery videos={videos} />
        ) : null}

        {activeView === "settings" ? (
          <div style={{ display: "grid", gap: "var(--sp-space-5)", maxWidth: 640 }}>
            <DriveSettingsPanel initialSettings={driveSettings} onSaved={setDriveSettings} />
            <AiSettingsPanel initialSettings={aiSettings} onSaved={setAiSettings} />
          </div>
        ) : null}
      </main>

      <button
        className="fab-create"
        onClick={() => setShowCreateModal(true)}
        type="button"
      >
        <Plus size={20} />
        <span>Nueva sesion</span>
      </button>

      {showCreateModal ? (
        <>
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} />
          <div className="modal-panel">
            <div className="modal-header">
              <h2>Nueva sesion</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <NewSessionForm onCreated={upsertEntry} />
          </div>
        </>
      ) : null}
    </div>
  );
}
