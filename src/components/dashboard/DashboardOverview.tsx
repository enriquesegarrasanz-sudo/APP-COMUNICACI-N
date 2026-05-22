import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleDot,
  Filter,
  Gauge,
  Layers3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tags,
} from "lucide-react";
import { buildFillerBank, buildWeeklySummaries } from "@/lib/insights";
import type { VideoEntry } from "@/types/video";

export type SessionClassifier = "all" | "analyzed" | "needs-analysis" | "ready" | "error";
export type SessionSort = "newest" | "oldest" | "clarity" | "fillers";

type Props = {
  videos: VideoEntry[];
  visibleCount: number;
  query: string;
  classifier: SessionClassifier;
  selectedTag: string;
  sort: SessionSort;
  availableTags: string[];
  onQueryChange: (value: string) => void;
  onClassifierChange: (value: SessionClassifier) => void;
  onTagChange: (value: string) => void;
  onSortChange: (value: SessionSort) => void;
};

const classifierOptions: Array<{ id: SessionClassifier; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "analyzed", label: "Analizadas" },
  { id: "needs-analysis", label: "Sin analisis" },
  { id: "ready", label: "Transcritas" },
  { id: "error", label: "Errores" },
];

const sortOptions: Array<{ id: SessionSort; label: string }> = [
  { id: "newest", label: "Recientes" },
  { id: "oldest", label: "Antiguas" },
  { id: "clarity", label: "Claridad" },
  { id: "fillers", label: "Muletillas" },
];

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function countForClassifier(videos: VideoEntry[], classifier: SessionClassifier) {
  if (classifier === "analyzed") {
    return videos.filter((video) => video.analysis).length;
  }

  if (classifier === "needs-analysis") {
    return videos.filter((video) => !video.analysis).length;
  }

  if (classifier === "ready") {
    return videos.filter((video) => video.transcriptStatus === "ready").length;
  }

  if (classifier === "error") {
    return videos.filter((video) => video.transcriptStatus === "error").length;
  }

  return videos.length;
}

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

export function DashboardOverview({
  availableTags,
  classifier,
  query,
  selectedTag,
  sort,
  videos,
  visibleCount,
  onClassifierChange,
  onQueryChange,
  onSortChange,
  onTagChange,
}: Props) {
  const sorted = [...videos].sort((a, b) => a.numero - b.numero);
  const analyzed = sorted.filter((video) => video.analysis);
  const clarity = average(analyzed.map((video) => video.analysis?.clarityScore ?? 0));
  const totalWords = analyzed.reduce((total, video) => total + (video.analysis?.wordCount ?? 0), 0);
  const totalFillers = analyzed.reduce((total, video) => total + (video.analysis?.fillerTotal ?? 0), 0);
  const latest = sorted.slice(-4);
  const fillerBank = buildFillerBank(sorted, 6);
  const weeklySummaries = buildWeeklySummaries(sorted, 5);
  const lastAnalyzed = analyzed[analyzed.length - 1] ?? null;

  const metrics = [
    { label: "Sesiones", value: videos.length, icon: Layers3 },
    { label: "Visibles", value: visibleCount, icon: Filter },
    { label: "Claridad media", value: analyzed.length ? `${clarity}%` : "-", icon: Gauge },
    { label: "Muletillas", value: totalFillers, icon: BarChart3 },
  ];

  return (
    <section className="overview-panel" aria-label="Panel general">
      <div className="overview-heading">
        <div>
          <p>Panel general</p>
          <h2>Datos, jerarquia y patrones</h2>
        </div>
        <Sparkles aria-hidden="true" size={21} />
      </div>

      <div className="classifier-bar" aria-label="Clasificadores">
        <div className="classifier-group">
          {classifierOptions.map((option) => (
            <button
              aria-pressed={classifier === option.id}
              className={`classifier-chip ${classifier === option.id ? "is-active" : ""}`}
              key={option.id}
              onClick={() => onClassifierChange(option.id)}
              type="button"
            >
              <span>{option.label}</span>
              <strong>{countForClassifier(videos, option.id)}</strong>
            </button>
          ))}
        </div>

        <div className="control-grid">
          <label className="control-field">
            <span>
              <Search aria-hidden="true" size={15} />
              Buscar
            </span>
            <input
              placeholder="Titulo, tema, tag..."
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>

          <label className="control-field">
            <span>
              <Tags aria-hidden="true" size={15} />
              Tag
            </span>
            <select value={selectedTag} onChange={(event) => onTagChange(event.target.value)}>
              <option value="all">Todos</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <label className="control-field">
            <span>
              <SlidersHorizontal aria-hidden="true" size={15} />
              Orden
            </span>
            <select value={sort} onChange={(event) => onSortChange(event.target.value as SessionSort)}>
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overview-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article className="metric-tile" key={metric.label}>
              <Icon aria-hidden="true" size={18} />
              <div>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            </article>
          );
        })}
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
