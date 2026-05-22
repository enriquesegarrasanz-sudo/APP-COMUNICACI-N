import { CalendarDays, FileVideo2, Gauge, SearchX, Tags } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { VideoEntry } from "@/types/video";

type Props = {
  videos: VideoEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function getCardSignal(video: VideoEntry) {
  if (!video.analysis) {
    return {
      label: "Sin analisis",
      value: "-",
    };
  }

  return {
    label: `${video.analysis.fillerTotal} muletillas`,
    value: `${video.analysis.clarityScore}%`,
  };
}

export function SessionBoard({ videos, selectedId, onSelect }: Props) {
  return (
    <section className="session-board" aria-label="Sesiones guardadas">
      <div className="board-heading">
        <div>
          <p>Conjunto</p>
          <h2>Bloques de sesiones</h2>
        </div>
        <FileVideo2 aria-hidden="true" size={21} />
      </div>

      {videos.length === 0 ? (
        <div className="empty-board">
          <SearchX aria-hidden="true" size={28} />
          <p>No hay sesiones con esos clasificadores.</p>
        </div>
      ) : (
        <div className="session-card-grid">
          {videos.map((video) => {
            const signal = getCardSignal(video);

            return (
              <button
                aria-current={selectedId === video.id ? "true" : undefined}
                className={`session-card ${selectedId === video.id ? "is-active" : ""}`}
                key={video.id}
                onClick={() => onSelect(video.id)}
                type="button"
              >
                <span className="session-card-number">#{video.numero}</span>
                <span className="session-card-main">
                  <span className="session-card-topline">
                    <strong>{video.titulo}</strong>
                    <StatusPill status={video.transcriptStatus} />
                  </span>
                  <span className="session-card-topic">{video.tema || "Sin tema"}</span>
                </span>

                <span className="session-card-meta">
                  <span>
                    <CalendarDays aria-hidden="true" size={14} />
                    {video.fecha}
                  </span>
                  <span>
                    <Gauge aria-hidden="true" size={14} />
                    {signal.value}
                  </span>
                  <span>{signal.label}</span>
                </span>

                {video.etiquetas.length > 0 ? (
                  <span className="session-card-tags">
                    <Tags aria-hidden="true" size={14} />
                    {video.etiquetas.slice(0, 4).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
