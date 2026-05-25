import {
  BookOpen,
  GitCompareArrows,
  MessageCircle,
  Repeat,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  buildConnectorProfile,
  buildFillerBank,
  buildPhrasePatterns,
  buildVocabEvolution,
  buildWordBank,
  type ConnectorProfileItem,
  type PhrasePatternItem,
} from "@/lib/insights";
import type { VideoEntry } from "@/types/video";

type Props = {
  videos: VideoEntry[];
};

function deltaIcon(value: number) {
  if (value > 0) {
    return <TrendingUp size={13} />;
  }

  if (value < 0) {
    return <TrendingDown size={13} />;
  }

  return null;
}

function categoryLabel(category: PhrasePatternItem["category"]) {
  const labels: Record<PhrasePatternItem["category"], { label: string; icon: LucideIcon; className: string }> = {
    repeticion: { label: "Patron", icon: Repeat, className: "vocab-tag is-pattern" },
    seguridad: { label: "Seguridad", icon: Shield, className: "vocab-tag is-assertive" },
    vacilacion: { label: "Vacilacion", icon: MessageCircle, className: "vocab-tag is-hesitant" },
  };

  return labels[category];
}

function connectorCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    causal: "Causales",
    temporal: "Temporales",
    contraste: "Contraste",
    aditivo: "Aditivos",
    conclusivo: "Conclusivos",
    ejemplo: "Ejemplo",
  };

  return labels[category] ?? category;
}

function connectorStrength(item: ConnectorProfileItem, totalSessions: number) {
  if (totalSessions === 0 || item.sessionCount === 0) {
    return "unused";
  }

  const ratio = item.sessionCount / totalSessions;

  if (ratio >= 0.5) {
    return "strong";
  }

  if (ratio >= 0.2) {
    return "moderate";
  }

  return "weak";
}

export function VocabularyGallery({ videos }: Props) {
  const analyzed = videos.filter((video) => video.analysis);
  const fillerBank = buildFillerBank(videos, 10);
  const wordBank = buildWordBank(videos, 20);
  const phrasePatterns = buildPhrasePatterns(videos, 15);
  const connectorProfile = buildConnectorProfile(videos);
  const evolution = buildVocabEvolution(videos);
  const totalSessions = analyzed.length;

  const totalUniqueWords = new Set(
    analyzed.flatMap((v) => v.analysis?.repeatedTerms?.map((t) => t.term) ?? []),
  ).size;
  const avgDiversity =
    analyzed.length > 0
      ? Math.round(
          analyzed.reduce((t, v) => t + (v.analysis?.vocabularyDiversity ?? 0), 0) / analyzed.length,
        )
      : 0;
  const avgConfidence =
    analyzed.length > 0
      ? Math.round(
          analyzed.reduce((t, v) => t + (v.analysis?.confidenceScore ?? 50), 0) / analyzed.length,
        )
      : 0;
  const totalFillers = analyzed.reduce((t, v) => t + (v.analysis?.fillerTotal ?? 0), 0);

  const usedConnectors = connectorProfile.filter((c) => c.totalCount > 0).length;
  const unusedConnectors = connectorProfile.filter((c) => c.totalCount === 0);

  if (analyzed.length === 0) {
    return (
      <section className="overview-panel" aria-label="Vocabulario">
        <div className="empty-board">
          <p>Analiza al menos una sesion para ver tu galeria de vocabulario.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="overview-panel" aria-label="Vocabulario">
      <div className="summary-strip">
        <article className="metric-tile">
          <BookOpen aria-hidden="true" size={20} />
          <div>
            <strong>{totalUniqueWords}</strong>
            <span>Palabras unicas</span>
          </div>
        </article>
        <article className="metric-tile">
          <Sparkles aria-hidden="true" size={20} />
          <div>
            <strong>{avgDiversity}%</strong>
            <span>Diversidad media</span>
          </div>
        </article>
        <article className="metric-tile">
          <Shield aria-hidden="true" size={20} />
          <div>
            <strong>{avgConfidence}%</strong>
            <span>Seguridad media</span>
          </div>
        </article>
        <article className="metric-tile">
          <MessageCircle aria-hidden="true" size={20} />
          <div>
            <strong>{totalFillers}</strong>
            <span>Muletillas totales</span>
          </div>
        </article>
        <article className="metric-tile">
          <GitCompareArrows aria-hidden="true" size={20} />
          <div>
            <strong>{usedConnectors}/6</strong>
            <span>Tipos conector</span>
          </div>
        </article>
      </div>

      <div className="vocab-grid">
        <article className="report-panel">
          <div className="panel-title">
            <Repeat aria-hidden="true" size={18} />
            <h3>Mis muletillas</h3>
          </div>
          {fillerBank.length === 0 ? (
            <p className="empty-line">Sin muletillas detectadas.</p>
          ) : (
            <div className="filler-bank-list">
              {fillerBank.map((item) => (
                <div className="filler-bank-row" key={item.phrase}>
                  <span>
                    <strong>{item.phrase}</strong>
                    <small>
                      {item.sessionCount} sesiones - {item.perThousandWords}/1000 pal.
                    </small>
                  </span>
                  <b>{item.totalCount}</b>
                  <em className={item.hasPreviousSession ? (item.delta < 0 ? "is-good" : item.delta > 0 ? "is-alert" : "is-neutral") : "is-neutral"}>
                    {item.hasPreviousSession ? (
                      <>
                        {deltaIcon(item.delta)}
                        {item.delta > 0 ? `+${item.delta}` : item.delta === 0 ? "igual" : `${item.delta}`}
                      </>
                    ) : (
                      `${item.latestCount} ult.`
                    )}
                  </em>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="report-panel">
          <div className="panel-title">
            <BookOpen aria-hidden="true" size={18} />
            <h3>Palabras frecuentes</h3>
          </div>
          {wordBank.length === 0 ? (
            <p className="empty-line">Analiza sesiones para ver tu vocabulario.</p>
          ) : (
            <div className="vocab-word-list">
              {wordBank.map((item) => (
                <div className="vocab-word-row" key={item.word}>
                  <span className="vocab-word-main">
                    <strong>{item.word}</strong>
                    <small>{item.sessionCount} sesiones</small>
                  </span>
                  <b>{item.totalCount}</b>
                  <em className={item.trend < 0 ? "is-good" : item.trend > 0 ? "is-alert" : "is-neutral"}>
                    {deltaIcon(item.trend)}
                  </em>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="vocab-grid">
        <article className="report-panel">
          <div className="panel-title">
            <MessageCircle aria-hidden="true" size={18} />
            <h3>Patrones y expresiones</h3>
          </div>
          {phrasePatterns.length === 0 ? (
            <p className="empty-line">Sin patrones detectados todavia.</p>
          ) : (
            <div className="vocab-phrase-list">
              {phrasePatterns.map((item) => {
                const tag = categoryLabel(item.category);
                const TagIcon = tag.icon;

                return (
                  <div className="vocab-phrase-row" key={`${item.category}-${item.phrase}`}>
                    <span className="vocab-phrase-main">
                      <strong>&ldquo;{item.phrase}&rdquo;</strong>
                      <span className={tag.className}>
                        <TagIcon size={11} />
                        {tag.label}
                      </span>
                    </span>
                    <span className="vocab-phrase-meta">
                      <b>{item.totalCount}x</b>
                      <small>{item.sessionCount} sesiones</small>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="report-panel">
          <div className="panel-title">
            <GitCompareArrows aria-hidden="true" size={18} />
            <h3>Perfil de conectores</h3>
          </div>
          <div className="vocab-connector-list">
            {connectorProfile.map((item) => {
              const strength = connectorStrength(item, totalSessions);

              return (
                <div className={`vocab-connector-row is-${strength}`} key={item.category}>
                  <span className="vocab-connector-main">
                    <strong>{connectorCategoryLabel(item.category)}</strong>
                    <small>
                      {item.totalCount > 0
                        ? item.topExamples.join(", ")
                        : "No usados todavia"}
                    </small>
                  </span>
                  <span className="vocab-connector-stats">
                    <b>{item.totalCount}</b>
                    <small>{item.sessionCount} ses.</small>
                  </span>
                </div>
              );
            })}
          </div>
          {unusedConnectors.length > 0 ? (
            <div className="vocab-suggestion">
              <Sparkles size={14} />
              <span>
                Prueba incorporar conectores{" "}
                <strong>{unusedConnectors.map((c) => connectorCategoryLabel(c.category).toLowerCase()).join(", ")}</strong>{" "}
                para enriquecer tu discurso.
              </span>
            </div>
          ) : null}
        </article>
      </div>

      {evolution.length >= 3 ? (
        <article className="report-panel">
          <div className="panel-title">
            <TrendingUp aria-hidden="true" size={18} />
            <h3>Evolucion del vocabulario</h3>
          </div>
          <div className="vocab-evolution-list">
            {evolution.slice(-8).map((point) => (
              <div className="vocab-evolution-row" key={point.numero}>
                <span>#{point.numero}</span>
                <strong>{point.diversity}%</strong>
                <small>{point.uniqueWords} unicas</small>
                <small>Segur. {point.confidence}%</small>
                <small className="trend-topic">{point.tema}</small>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
