"use client";

import { useMemo, useState } from "react";
import { Camera, Waves } from "lucide-react";
import { GlobalReport } from "@/components/dashboard/GlobalReport";
import { SessionList } from "@/components/dashboard/SessionList";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { NewSessionForm } from "@/components/video-form/NewSessionForm";
import { SessionDetail } from "@/components/video-detail/SessionDetail";
import type { VideoEntry } from "@/types/video";

function sortVideos(videos: VideoEntry[]) {
  return [...videos].sort((a, b) => b.numero - a.numero);
}

export default function AppShell({ initialVideos }: { initialVideos: VideoEntry[] }) {
  const [videos, setVideos] = useState(() => sortVideos(initialVideos));
  const [selectedId, setSelectedId] = useState<string | null>(initialVideos[0]?.id ?? null);

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
        <SessionList videos={videos} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      </aside>

      <section className="workspace">
        <header className="topline">
          <div>
            <p>Practica diaria</p>
            <h1>Registro de presencia en camara</h1>
          </div>
          <Waves aria-hidden="true" size={28} />
        </header>

        <SummaryStrip videos={videos} />
        <SessionDetail
          key={selected?.id ?? "empty-session"}
          video={selected}
          onDelete={removeEntry}
          onEntryChange={upsertEntry}
        />
        <GlobalReport videos={videos} />
      </section>
    </main>
  );
}
