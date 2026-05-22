"use client";

import { useMemo, useState } from "react";
import { Camera, Waves } from "lucide-react";
import {
  DashboardOverview,
  type SessionClassifier,
  type SessionSort,
} from "@/components/dashboard/DashboardOverview";
import { SessionBoard } from "@/components/dashboard/SessionBoard";
import { AiSettingsPanel } from "@/components/settings/AiSettingsPanel";
import { NewSessionForm } from "@/components/video-form/NewSessionForm";
import { SessionDetail } from "@/components/video-detail/SessionDetail";
import type { AiSettingsStatus, VideoEntry } from "@/types/video";

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
  initialAiSettings: AiSettingsStatus;
  initialVideos: VideoEntry[];
};

export default function AppShell({ initialAiSettings, initialVideos }: AppShellProps) {
  const [videos, setVideos] = useState(() => sortVideos(initialVideos));
  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [selectedId, setSelectedId] = useState<string | null>(() => getInitialSelectedId(initialVideos));
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
  }

  function removeEntry(id: string) {
    setVideos((current) => {
      const next = current.filter((video) => video.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  return (
    <main className="app-frame">
      <aside className="side-rail">
        <div className="brand-mark">
          <span>
            <Camera aria-hidden="true" size={22} />
          </span>
          <div>
            <strong>APP SPEAKING</strong>
            <small>camara, voz, progreso</small>
          </div>
        </div>

        <NewSessionForm onCreated={upsertEntry} />
        <AiSettingsPanel initialSettings={aiSettings} onSaved={setAiSettings} />
      </aside>

      <section className="workspace">
        <header className="topline">
          <div>
            <p>Practica diaria</p>
            <h1>Registro de presencia en camara</h1>
          </div>
          <Waves aria-hidden="true" size={28} />
        </header>

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
        <SessionBoard
          selectedId={selected?.id ?? null}
          videos={filteredVideos}
          onSelect={setSelectedId}
        />
        <SessionDetail
          aiSettings={aiSettings}
          key={selected?.id ?? "empty-session"}
          video={selected}
          onDelete={removeEntry}
          onEntryChange={upsertEntry}
        />
      </section>
    </main>
  );
}
