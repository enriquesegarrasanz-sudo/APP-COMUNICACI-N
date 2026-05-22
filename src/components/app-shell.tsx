"use client";

import { useMemo, useState } from "react";
import { BarChart3, Camera, FileVideo2, Mic2, PlusCircle, Waves } from "lucide-react";
import {
  DashboardOverview,
  type SessionClassifier,
  type SessionSort,
} from "@/components/dashboard/DashboardOverview";
import { SessionBoard } from "@/components/dashboard/SessionBoard";
import { AiSettingsPanel } from "@/components/settings/AiSettingsPanel";
import { DriveSettingsPanel } from "@/components/settings/DriveSettingsPanel";
import { NewSessionForm } from "@/components/video-form/NewSessionForm";
import { SessionDetail } from "@/components/video-detail/SessionDetail";
import { defaultAiSettings, defaultDriveSettings } from "@/lib/ai-defaults";
import type { AiSettingsStatus, DriveSettingsStatus, VideoEntry } from "@/types/video";

type AppTab = "overview" | "sessions" | "detail" | "create";

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
  credentialsConfigured: false,
  ready: false,
};

const tabs: Array<{ id: AppTab; label: string; description: string; icon: typeof BarChart3 }> = [
  {
    id: "overview",
    label: "Datos",
    description: "Estadisticas y patrones",
    icon: BarChart3,
  },
  {
    id: "sessions",
    label: "Sesiones",
    description: "Bloques guardados",
    icon: FileVideo2,
  },
  {
    id: "detail",
    label: "Sesion abierta",
    description: "Video, ficha y analisis",
    icon: Mic2,
  },
  {
    id: "create",
    label: "Crear",
    description: "Nueva sesion e IA",
    icon: PlusCircle,
  },
];

export default function AppShell({ initialAiSettings, initialDriveSettings, initialVideos }: AppShellProps) {
  const [videos, setVideos] = useState(() => sortVideos(initialVideos));
  const [aiSettings, setAiSettings] = useState(() => initialAiSettings ?? fallbackAiSettings);
  const [driveSettings, setDriveSettings] = useState(() => initialDriveSettings ?? fallbackDriveSettings);
  const [selectedId, setSelectedId] = useState<string | null>(() => getInitialSelectedId(initialVideos));
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [query, setQuery] = useState("");
  const [classifier, setClassifier] = useState<SessionClassifier>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sort, setSort] = useState<SessionSort>("newest");

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
    setActiveTab("detail");
  }

  function removeEntry(id: string) {
    setVideos((current) => {
      const next = current.filter((video) => video.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  function selectSession(id: string) {
    setSelectedId(id);
    setActiveTab("detail");
  }

  return (
    <main className="app-frame">
      <section className="workspace">
        <header className="app-header">
          <div className="brand-mark">
            <span>
              <Camera aria-hidden="true" size={22} />
            </span>
            <div>
              <strong>APP SPEAKING</strong>
              <small>camara, voz, progreso</small>
            </div>
          </div>

          <div className="topline">
            <div>
              <p>Practica diaria</p>
              <h1>Registro de presencia en camara</h1>
            </div>
            <Waves aria-hidden="true" size={28} />
          </div>
        </header>

        <nav className="space-tabs" aria-label="Espacios de la aplicacion" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                aria-controls={`panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                className={`space-tab ${activeTab === tab.id ? "is-active" : ""}`}
                id={`tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.description}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <section
          aria-labelledby="tab-overview"
          className={`tab-panel ${activeTab === "overview" ? "is-active" : ""}`}
          hidden={activeTab !== "overview"}
          id="panel-overview"
          role="tabpanel"
        >
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
        </section>

        <section
          aria-labelledby="tab-sessions"
          className={`tab-panel ${activeTab === "sessions" ? "is-active" : ""}`}
          hidden={activeTab !== "sessions"}
          id="panel-sessions"
          role="tabpanel"
        >
          <SessionBoard selectedId={selected?.id ?? null} videos={filteredVideos} onSelect={selectSession} />
        </section>

        <section
          aria-labelledby="tab-detail"
          className={`tab-panel ${activeTab === "detail" ? "is-active" : ""}`}
          hidden={activeTab !== "detail"}
          id="panel-detail"
          role="tabpanel"
        >
          <SessionDetail
            aiSettings={aiSettings}
            key={selected?.id ?? "empty-session"}
            previousVideo={previousVideo}
            video={selected}
            onDelete={removeEntry}
            onEntryChange={upsertEntry}
          />
        </section>

        <section
          aria-labelledby="tab-create"
          className={`tab-panel ${activeTab === "create" ? "is-active" : ""}`}
          hidden={activeTab !== "create"}
          id="panel-create"
          role="tabpanel"
        >
          <div className="compose-grid">
            <NewSessionForm onCreated={upsertEntry} />
            <DriveSettingsPanel initialSettings={driveSettings} onSaved={setDriveSettings} />
            <AiSettingsPanel initialSettings={aiSettings} onSaved={setAiSettings} />
          </div>
        </section>
      </section>
    </main>
  );
}
