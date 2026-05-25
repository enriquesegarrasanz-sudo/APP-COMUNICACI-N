import type { AnalysisResult, DiscourseConnector, VideoEntry } from "@/types/video";

export type FillerBankItem = {
  phrase: string;
  totalCount: number;
  perThousandWords: number;
  sessionCount: number;
  latestCount: number;
  previousCount: number;
  delta: number;
  hasPreviousSession: boolean;
};

export type WeeklySummaryItem = {
  key: string;
  label: string;
  sessions: number;
  analyzed: number;
  averageClarity: number | null;
  clarityDelta: number | null;
  fillerRate: number | null;
  fillerRateDelta: number | null;
  totalFillers: number;
  topFiller: { phrase: string; count: number } | null;
};

export type SessionComparison = {
  previousNumber: number;
  clarityDelta: number | null;
  fillerRateDelta: number | null;
  fillerTotalDelta: number | null;
  wordCountDelta: number | null;
  vocabularyDiversityDelta: number | null;
  avgSentenceLengthDelta: number | null;
  confidenceDelta: number | null;
  connectorVarietyDelta: number | null;
  topFiller: { phrase: string; current: number; previous: number; delta: number } | null;
};

function sortBySession(videos: VideoEntry[]) {
  return [...videos].sort((a, b) => a.numero - b.numero);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function countFillers(analysis: AnalysisResult | undefined, phrase: string) {
  return analysis?.topFillers.find((filler) => filler.phrase === phrase)?.count ?? 0;
}

function topFillerFromCounts(counts: Map<string, number>) {
  const [phrase, count] =
    [...counts.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])[0] ?? [];

  return phrase ? { phrase, count } : null;
}

export function buildFillerBank(videos: VideoEntry[], limit = 8): FillerBankItem[] {
  const sorted = sortBySession(videos).filter((video) => video.analysis);
  const totals = new Map<string, { count: number; sessions: number }>();
  const totalWords = sorted.reduce((total, video) => total + (video.analysis?.wordCount ?? 0), 0);
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);

  for (const video of sorted) {
    for (const filler of video.analysis?.topFillers ?? []) {
      const current = totals.get(filler.phrase) ?? { count: 0, sessions: 0 };
      totals.set(filler.phrase, {
        count: current.count + filler.count,
        sessions: current.sessions + 1,
      });
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([phrase, value]) => {
      const latestCount = countFillers(latest?.analysis, phrase);
      const previousCount = countFillers(previous?.analysis, phrase);

      return {
        phrase,
        totalCount: value.count,
        perThousandWords: totalWords > 0 ? Math.round((value.count / totalWords) * 1000) : 0,
        sessionCount: value.sessions,
        latestCount,
        previousCount,
        delta: latestCount - previousCount,
        hasPreviousSession: Boolean(previous),
      };
    });
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekStartFor(value: string) {
  const date = parseDateKey(value);

  if (!date) {
    return null;
  }

  const mondayIndex = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayIndex);
  return date;
}

function weekLabel(start: Date) {
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const formatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function buildWeeklySummaries(videos: VideoEntry[], limit = 5): WeeklySummaryItem[] {
  const weeks = new Map<string, { start: Date; videos: VideoEntry[] }>();

  for (const video of sortBySession(videos)) {
    const start = weekStartFor(video.fecha);

    if (!start) {
      continue;
    }

    const key = formatDateKey(start);
    const current = weeks.get(key) ?? { start, videos: [] };
    current.videos.push(video);
    weeks.set(key, current);
  }

  const ordered = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const summaries = ordered.map(([key, week], index): WeeklySummaryItem => {
    const analyzed = week.videos.filter((video) => video.analysis);
    const averageClarity = average(analyzed.map((video) => video.analysis?.clarityScore ?? 0));
    const totalWords = analyzed.reduce((total, video) => total + (video.analysis?.wordCount ?? 0), 0);
    const totalFillers = analyzed.reduce((total, video) => total + (video.analysis?.fillerTotal ?? 0), 0);
    const fillerRate = totalWords > 0 ? Math.round((totalFillers / totalWords) * 1000) : null;
    const counts = new Map<string, number>();

    for (const video of analyzed) {
      for (const filler of video.analysis?.topFillers ?? []) {
        counts.set(filler.phrase, (counts.get(filler.phrase) ?? 0) + filler.count);
      }
    }

    const previous = ordered[index - 1]
      ? buildWeekMetrics(ordered[index - 1][1].videos)
      : { averageClarity: null, fillerRate: null };

    return {
      key,
      label: weekLabel(week.start),
      sessions: week.videos.length,
      analyzed: analyzed.length,
      averageClarity,
      clarityDelta:
        averageClarity !== null && previous.averageClarity !== null ? averageClarity - previous.averageClarity : null,
      fillerRate,
      fillerRateDelta: fillerRate !== null && previous.fillerRate !== null ? fillerRate - previous.fillerRate : null,
      totalFillers,
      topFiller: topFillerFromCounts(counts),
    };
  });

  return summaries.slice(-limit).reverse();
}

function buildWeekMetrics(videos: VideoEntry[]) {
  const analyzed = videos.filter((video) => video.analysis);
  const averageClarity = average(analyzed.map((video) => video.analysis?.clarityScore ?? 0));
  const totalWords = analyzed.reduce((total, video) => total + (video.analysis?.wordCount ?? 0), 0);
  const totalFillers = analyzed.reduce((total, video) => total + (video.analysis?.fillerTotal ?? 0), 0);

  return {
    averageClarity,
    fillerRate: totalWords > 0 ? Math.round((totalFillers / totalWords) * 1000) : null,
  };
}

export function compareSessions(current: VideoEntry, previous: VideoEntry | null): SessionComparison | null {
  if (!previous) {
    return null;
  }

  const currentAnalysis = current.analysis;
  const previousAnalysis = previous.analysis;

  if (!currentAnalysis || !previousAnalysis) {
    return {
      previousNumber: previous.numero,
      clarityDelta: null,
      fillerRateDelta: null,
      fillerTotalDelta: null,
      wordCountDelta: null,
      vocabularyDiversityDelta: null,
      avgSentenceLengthDelta: null,
      confidenceDelta: null,
      connectorVarietyDelta: null,
      topFiller: null,
    };
  }

  const currentTop = currentAnalysis.topFillers[0];
  const previousTopCount = currentTop ? countFillers(previousAnalysis, currentTop.phrase) : 0;

  function safeDelta(current: number | undefined, prev: number | undefined) {
    return current !== undefined && prev !== undefined ? current - prev : null;
  }

  return {
    previousNumber: previous.numero,
    clarityDelta: currentAnalysis.clarityScore - previousAnalysis.clarityScore,
    fillerRateDelta: currentAnalysis.fillerRate - previousAnalysis.fillerRate,
    fillerTotalDelta: currentAnalysis.fillerTotal - previousAnalysis.fillerTotal,
    wordCountDelta: currentAnalysis.wordCount - previousAnalysis.wordCount,
    vocabularyDiversityDelta: safeDelta(currentAnalysis.vocabularyDiversity, previousAnalysis.vocabularyDiversity),
    avgSentenceLengthDelta: safeDelta(currentAnalysis.avgSentenceLength, previousAnalysis.avgSentenceLength),
    confidenceDelta: safeDelta(currentAnalysis.confidenceScore, previousAnalysis.confidenceScore),
    connectorVarietyDelta: safeDelta(currentAnalysis.connectorVariety, previousAnalysis.connectorVariety),
    topFiller: currentTop
      ? {
          phrase: currentTop.phrase,
          current: currentTop.count,
          previous: previousTopCount,
          delta: currentTop.count - previousTopCount,
        }
      : null,
  };
}

export type WordBankItem = {
  word: string;
  totalCount: number;
  sessionCount: number;
  perThousandWords: number;
  trend: number;
};

export function buildWordBank(videos: VideoEntry[], limit = 30): WordBankItem[] {
  const sorted = sortBySession(videos).filter((video) => video.analysis);
  const totals = new Map<string, { count: number; sessions: number }>();
  const totalWords = sorted.reduce((total, video) => total + (video.analysis?.wordCount ?? 0), 0);
  const latestTerms = new Map<string, number>();
  const previousTerms = new Map<string, number>();
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);

  for (const term of latest?.analysis?.repeatedTerms ?? []) {
    latestTerms.set(term.term, term.count);
  }

  for (const term of previous?.analysis?.repeatedTerms ?? []) {
    previousTerms.set(term.term, term.count);
  }

  for (const video of sorted) {
    const seen = new Set<string>();

    for (const term of video.analysis?.repeatedTerms ?? []) {
      const current = totals.get(term.term) ?? { count: 0, sessions: 0 };
      current.count += term.count;

      if (!seen.has(term.term)) {
        current.sessions += 1;
        seen.add(term.term);
      }

      totals.set(term.term, current);
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([word, value]) => ({
      word,
      totalCount: value.count,
      sessionCount: value.sessions,
      perThousandWords: totalWords > 0 ? Math.round((value.count / totalWords) * 1000) : 0,
      trend: (latestTerms.get(word) ?? 0) - (previousTerms.get(word) ?? 0),
    }));
}

export type PhrasePatternItem = {
  phrase: string;
  totalCount: number;
  sessionCount: number;
  category: "repeticion" | "seguridad" | "vacilacion";
};

export function buildPhrasePatterns(videos: VideoEntry[], limit = 20): PhrasePatternItem[] {
  const sorted = sortBySession(videos).filter((video) => video.analysis);
  const items: PhrasePatternItem[] = [];

  const repetitions = new Map<string, { count: number; sessions: number }>();

  for (const video of sorted) {
    const seen = new Set<string>();

    for (const phrase of video.analysis?.repeatedPhrases ?? []) {
      const current = repetitions.get(phrase.term) ?? { count: 0, sessions: 0 };
      current.count += phrase.count;

      if (!seen.has(phrase.term)) {
        current.sessions += 1;
        seen.add(phrase.term);
      }

      repetitions.set(phrase.term, current);
    }
  }

  for (const [phrase, value] of repetitions) {
    items.push({ phrase, totalCount: value.count, sessionCount: value.sessions, category: "repeticion" });
  }

  const assertive = new Map<string, { count: number; sessions: number }>();

  for (const video of sorted) {
    const seen = new Set<string>();

    for (const marker of video.analysis?.assertivenessMarkers ?? []) {
      const current = assertive.get(marker.phrase) ?? { count: 0, sessions: 0 };
      current.count += marker.count;

      if (!seen.has(marker.phrase)) {
        current.sessions += 1;
        seen.add(marker.phrase);
      }

      assertive.set(marker.phrase, current);
    }
  }

  for (const [phrase, value] of assertive) {
    items.push({ phrase, totalCount: value.count, sessionCount: value.sessions, category: "seguridad" });
  }

  const hesitant = new Map<string, { count: number; sessions: number }>();

  for (const video of sorted) {
    const seen = new Set<string>();

    for (const marker of video.analysis?.hesitationMarkers ?? []) {
      const current = hesitant.get(marker.phrase) ?? { count: 0, sessions: 0 };
      current.count += marker.count;

      if (!seen.has(marker.phrase)) {
        current.sessions += 1;
        seen.add(marker.phrase);
      }

      hesitant.set(marker.phrase, current);
    }
  }

  for (const [phrase, value] of hesitant) {
    items.push({ phrase, totalCount: value.count, sessionCount: value.sessions, category: "vacilacion" });
  }

  return items.sort((a, b) => b.totalCount - a.totalCount).slice(0, limit);
}

export type ConnectorProfileItem = {
  category: string;
  totalCount: number;
  sessionCount: number;
  topExamples: string[];
};

export function buildConnectorProfile(videos: VideoEntry[]): ConnectorProfileItem[] {
  const sorted = sortBySession(videos).filter((video) => video.analysis);
  const categories = new Map<string, { count: number; sessions: number; examples: Map<string, number> }>();

  for (const video of sorted) {
    const seen = new Set<string>();

    for (const connector of video.analysis?.discourseConnectors ?? []) {
      if (connector.count === 0) {
        continue;
      }

      const current = categories.get(connector.category) ?? { count: 0, sessions: 0, examples: new Map() };
      current.count += connector.count;

      if (!seen.has(connector.category)) {
        current.sessions += 1;
        seen.add(connector.category);
      }

      for (const example of connector.examples) {
        current.examples.set(example, (current.examples.get(example) ?? 0) + 1);
      }

      categories.set(connector.category, current);
    }
  }

  const allCategories = ["causal", "temporal", "contraste", "aditivo", "conclusivo", "ejemplo"];

  return allCategories.map((category) => {
    const data = categories.get(category);

    if (!data) {
      return { category, totalCount: 0, sessionCount: 0, topExamples: [] };
    }

    const topExamples = [...data.examples.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([example]) => example);

    return {
      category,
      totalCount: data.count,
      sessionCount: data.sessions,
      topExamples,
    };
  });
}

export type VocabEvolutionPoint = {
  numero: number;
  tema: string;
  uniqueWords: number;
  diversity: number;
  confidence: number;
};

export function buildVocabEvolution(videos: VideoEntry[]): VocabEvolutionPoint[] {
  return sortBySession(videos)
    .filter((video) => video.analysis)
    .map((video) => ({
      numero: video.numero,
      tema: video.tema,
      uniqueWords: video.analysis?.uniqueWordCount ?? 0,
      diversity: video.analysis?.vocabularyDiversity ?? 0,
      confidence: video.analysis?.confidenceScore ?? 50,
    }));
}
