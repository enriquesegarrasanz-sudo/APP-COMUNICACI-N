import { Activity, BadgeCheck, CircleDot, ListFilter } from "lucide-react";
import type { FillerCount, VideoEntry } from "@/types/video";

function aggregateFillers(videos: VideoEntry[]) {
  const counts = new Map<string, number>();

  for (const video of videos) {
    for (const filler of video.analysis?.topFillers ?? []) {
      counts.set(filler.phrase, (counts.get(filler.phrase) ?? 0) + filler.count);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([phrase, count]) => ({ phrase, count }));
}

function latestFillers(video: VideoEntry): FillerCount[] {
  return video.analysis?.topFillers.slice(0, 3) ?? [];
}

export function GlobalReport({ videos }: { videos: VideoEntry[] }) {
  const sorted = [...videos].sort((a, b) => a.numero - b.numero);
  const analyzed = sorted.filter((video) => video.analysis);
  const aggregate = aggregateFillers(sorted);
  const latest = sorted.slice(-5);

  return (
    <section className="global-report" aria-label="Informe global">
      <div className="section-heading">
        <div>
          <p>Informe</p>
          <h2>Patrones acumulados</h2>
        </div>
        <ListFilter aria-hidden="true" size={20} />
      </div>

      <div className="report-grid">
        <article className="report-panel">
          <div className="panel-title">
            <Activity aria-hidden="true" size={18} />
            <h3>Evolucion</h3>
          </div>
          {latest.length === 0 ? (
            <p className="empty-line">Todavia no hay sesiones.</p>
          ) : (
            <ol className="trend-list">
              {latest.map((video) => (
                <li key={video.id}>
                  <span>#{video.numero}</span>
                  <strong>{video.analysis ? `${video.analysis.clarityScore}%` : "-"}</strong>
                  <small>{video.tema}</small>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="report-panel">
          <div className="panel-title">
            <CircleDot aria-hidden="true" size={18} />
            <h3>Muletillas top</h3>
          </div>
          {aggregate.length === 0 ? (
            <p className="empty-line">Analiza una transcripcion para verlas.</p>
          ) : (
            <div className="filler-stack">
              {aggregate.map((item) => (
                <div className="filler-row" key={item.phrase}>
                  <span>{item.phrase}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="report-panel">
          <div className="panel-title">
            <BadgeCheck aria-hidden="true" size={18} />
            <h3>Ultima lectura</h3>
          </div>
          {analyzed.length === 0 ? (
            <p className="empty-line">Sin analisis todavia.</p>
          ) : (
            <div className="last-reading">
              <strong>{analyzed.at(-1)?.tema}</strong>
              <div>
                {latestFillers(analyzed.at(-1) as VideoEntry).map((filler) => (
                  <span key={filler.phrase}>{filler.phrase}</span>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

