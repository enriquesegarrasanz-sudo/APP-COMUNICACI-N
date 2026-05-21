import { FileVideo2 } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { VideoEntry } from "@/types/video";

type Props = {
  videos: VideoEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function SessionList({ videos, selectedId, onSelect }: Props) {
  return (
    <nav className="session-list" aria-label="Sesiones">
      <div className="list-heading">
        <FileVideo2 aria-hidden="true" size={18} />
        <h2>Registro</h2>
      </div>

      {videos.length === 0 ? (
        <p className="empty-line">Sin videos guardados.</p>
      ) : (
        videos.map((video) => (
          <button
            className={`session-item ${selectedId === video.id ? "is-active" : ""}`}
            key={video.id}
            onClick={() => onSelect(video.id)}
            type="button"
          >
            <span className="session-number">#{video.numero}</span>
            <span className="session-copy">
              <strong>{video.titulo}</strong>
              <small>{video.tema}</small>
            </span>
            <StatusPill status={video.transcriptStatus} />
          </button>
        ))
      )}
    </nav>
  );
}

