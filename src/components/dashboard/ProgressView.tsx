import {
  Activity,
  CalendarDays,
  CircleDot,
  Gauge,
} from "lucide-react";
import { buildFillerBank, buildWeeklySummaries } from "@/lib/insights";
import type { VideoEntry } from "@/types/video";

type Props = {
  videos: VideoEntry[];
};

function deltaClass(value: number | null, lowerIsBetter = false) {
  if (value === null || value === 0) {
    return "is-neutral";
  }

  const isBetter = lowerIsBetter ? value < 0 : value > 0;
  return isBetter ? "is-good" : "is-alert";
}

function formatDelta(value: number | null, suffix = "") {
  if (value === null) {
    return "sin comparativa";
  }

  if (value === 0) {
    return "igual";
  }

  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function ProgressView({ videos }: Props) {
  const sorted = [...videos].sort((a, b) => a.numero - b.numero);
  const analyzed = sorted.filter((video) => video.analysis);
  const totalWords = analyzed.reduce((total, video) => total + (video.analysis?.wordCount ?? 0), 0);
  const clarity = average(analyzed.map((video) => video.analysis?.clarityScore ?? 0));
  const latest = sorted.slice(-6);
  const fillerBank = buildFillerBank(sorted, 8);
  const weeklySummaries = buildWeeklySummaries(sorted, 6);
  const lastAnalyzed = analyzed[analyzed.length - 1] ?? null;

  return (
    <section className="overview-panel" aria-label="Progreso">
      <div className="summary-strip">
        <article className="metric-tile">
          <Gauge aria-hidden="true" size={20} />
          <div>
            <strong>{analyzed.length ? `${clarity}%` : "-"}</strong>
            <span>Claridad media</span>
          </div>
        </article>
        <article className="metric-tile">
          <Activity aria-hidden="true" size={20} />
          <div>
            <strong>{analyzed.length}</strong>
            <span>Analizadas</span>
          </div>
        </article>
        <article className="metric-tile">
          <CircleDot aria-hidden="true" size={20} />
          <div>
            <strong>{totalWords.toLocaleString()}</strong>
            <span>Palabras totales</span>
          </div>
        </article>
      </div>

      <div className="pattern-grid">
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
            <h3>Banco de muletillas</h3>
          </div>
          {fillerBank.length === 0 ? (
            <p className="empty-line">Analiza una transcripcion para verlas.</p>
          ) : (
            <div className="filler-bank-list">
              {fillerBank.map((item) => (
                <div className="filler-bank-row" key={item.phrase}>
                  <span>
                    <strong>{item.phrase}</strong>
                    <small>
                      {item.sessionCount} sesiones - {item.perThousandWords}/1000 palabras
                    </small>
                  </span>
                  <b>{item.totalCount}</b>
                  <em className={item.hasPreviousSession ? deltaClass(item.delta, true) : "is-neutral"}>
                    {item.hasPreviousSession ? formatDelta(item.delta) : `${item.latestCount} ult.`}
                  </em>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="report-panel signal-panel">
          <div className="panel-title">
            <Gauge aria-hidden="true" size={18} />
            <h3>Ultima lectura</h3>
          </div>
          {lastAnalyzed ? (
            <>
              <strong className="reading-score">{lastAnalyzed.analysis?.clarityScore}%</strong>
              <p>{lastAnalyzed.tema}</p>
              <small>{totalWords} palabras acumuladas</small>
            </>
          ) : (
            <p className="empty-line">Sin analisis todavia.</p>
          )}
        </article>
      </div>

      <article className="weekly-summary-panel">
        <div className="panel-title">
          <CalendarDays aria-hidden="true" size={18} />
          <h3>Resumen semanal</h3>
        </div>
        {weeklySummaries.length === 0 ? (
          <p className="empty-line">Todavia no hay semanas con sesiones.</p>
        ) : (
          <div className="week-stack">
            {weeklySummaries.map((week) => (
              <div className="week-row" key={week.key}>
                <span className="week-main">
                  <strong>{week.label}</strong>
                  <small>
                    {week.sessions} sesiones - {week.analyzed} analizadas
                  </small>
                </span>
                <span>
                  <small>Claridad</small>
                  <strong>{week.averageClarity !== null ? `${week.averageClarity}%` : "-"}</strong>
                  <em className={deltaClass(week.clarityDelta)}>{formatDelta(week.clarityDelta, "%")}</em>
                </span>
                <span>
                  <small>Muletillas</small>
                  <strong>{week.fillerRate !== null ? `${week.fillerRate}/1000` : "-"}</strong>
                  <em className={deltaClass(week.fillerRateDelta, true)}>{formatDelta(week.fillerRateDelta)}</em>
                </span>
                <span>
                  <small>Dominante</small>
                  <strong>{week.topFiller ? week.topFiller.phrase : "-"}</strong>
                  <em>{week.topFiller ? `${week.topFiller.count} usos` : "sin datos"}</em>
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
