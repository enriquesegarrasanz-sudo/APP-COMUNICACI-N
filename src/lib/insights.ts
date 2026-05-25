import type { AnalysisResult, VideoEntry } from "@/types/video";

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
