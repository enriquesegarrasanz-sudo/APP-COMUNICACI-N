import type {
  AnalysisResult,
  FillerCount,
  RepeatedTerm,
  StructureSignal,
} from "@/types/video";

const fillerPhrases = [
  "eh",
  "em",
  "um",
  "mmm",
  "bueno",
  "vale",
  "pues",
  "entonces",
  "o sea",
  "digamos",
  "sabes",
  "no se",
  "en plan",
  "como que",
  "la verdad",
  "basicamente",
  "realmente",
  "literalmente",
];

const stopWords = new Set([
  "algo",
  "ante",
  "aqui",
  "cada",
  "como",
  "cual",
  "cuando",
  "desde",
  "donde",
  "ella",
  "ellos",
  "este",
  "esto",
  "esta",
  "estas",
  "estos",
  "para",
  "pero",
  "porque",
  "pues",
  "sobre",
  "tambien",
  "tengo",
  "tiene",
  "todo",
  "todos",
  "unas",
  "unos",
  "vale",
  "vamos",
  "y",
  "de",
  "la",
  "el",
  "lo",
  "las",
  "los",
  "un",
  "una",
  "que",
  "con",
  "por",
  "del",
  "se",
  "me",
  "mi",
  "es",
  "en",
  "al",
]);

const structureGroups = [
  {
    name: "apertura",
    examples: ["hoy", "quiero", "voy a", "para empezar", "la idea"],
  },
  {
    name: "desarrollo",
    examples: ["primero", "despues", "ademas", "por otro lado", "entonces"],
  },
  {
    name: "contraste",
    examples: ["pero", "sin embargo", "aunque", "en cambio"],
  },
  {
    name: "cierre",
    examples: ["en conclusion", "para cerrar", "por ultimo", "finalmente"],
  },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s.?!,;:]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countPhrase(text: string, phrase: string) {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|[.,;:!?]|$)`, "g");
  return text.match(pattern)?.length ?? 0;
}

function getWords(normalized: string) {
  return normalized
    .replace(/[.?!,;:]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function topRepeatedTerms(words: string[]): RepeatedTerm[] {
  const counts = new Map<string, number>();

  for (const word of words) {
    if (word.length < 4 || stopWords.has(word)) {
      continue;
    }

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, count]) => ({ term, count }));
}

function topRepeatedPhrases(words: string[]): RepeatedTerm[] {
  const counts = new Map<string, number>();

  for (let index = 0; index < words.length - 2; index += 1) {
    const chunk = words.slice(index, index + 3);

    if (chunk.some((word) => word.length < 3 || stopWords.has(word))) {
      continue;
    }

    const phrase = chunk.join(" ");
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term, count]) => ({ term, count }));
}

function detectStructure(normalized: string): StructureSignal[] {
  return structureGroups.map((group) => ({
    name: group.name,
    examples: group.examples.filter((example) => countPhrase(normalized, example) > 0),
    count: group.examples.reduce((total, example) => total + countPhrase(normalized, example), 0),
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function analyzeTranscript(transcript: string): AnalysisResult {
  const normalized = normalizeText(transcript);
  const words = getWords(normalized);
  const wordCount = words.length;
  const sentenceCount = transcript.split(/[.?!]+/).filter((part) => part.trim().length > 0).length;

  const topFillers: FillerCount[] = fillerPhrases
    .map((phrase) => {
      const count = countPhrase(normalized, phrase);
      return {
        phrase,
        count,
        perThousandWords: wordCount > 0 ? Math.round((count / wordCount) * 1000) : 0,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const fillerTotal = topFillers.reduce((total, item) => total + item.count, 0);
  const fillerRate = wordCount > 0 ? Math.round((fillerTotal / wordCount) * 1000) : 0;
  const repeatedTerms = topRepeatedTerms(words);
  const repeatedPhrases = topRepeatedPhrases(words);
  const structureSignals = detectStructure(normalized);
  const structureCoverage = structureSignals.filter((signal) => signal.count > 0).length;

  const fillerPenalty = Math.min(32, fillerRate * 0.22);
  const lengthPenalty = wordCount > 0 && wordCount < 80 ? 8 : 0;
  const clarityScore = clamp(
    Math.round(66 + structureCoverage * 6 - fillerPenalty - repeatedPhrases.length * 3 - lengthPenalty),
    5,
    98,
  );

  const recommendations: string[] = [];

  if (wordCount < 40) {
    recommendations.push("Graba una pieza un poco mas larga para ver patrones fiables.");
  }

  if (fillerRate > 55) {
    recommendations.push("Haz una pausa silenciosa antes de seguir; ahora las muletillas estan ocupando demasiado espacio.");
  } else if (fillerRate > 25) {
    recommendations.push("Elige dos muletillas prioritarias y trabaja solo esas en la proxima grabacion.");
  } else {
    recommendations.push("La densidad de muletillas esta contenida; protege ese ritmo.");
  }

  if (structureCoverage < 3) {
    recommendations.push("Prueba una estructura simple: apertura, desarrollo y cierre en una frase cada uno.");
  } else {
    recommendations.push("Hay senales de estructura; puedes reforzar el cierre con una conclusion mas explicita.");
  }

  if (repeatedPhrases.length > 0) {
    recommendations.push("Revisa los bucles de tres palabras repetidas y sustituyelos por una pausa o una palabra puente.");
  }

  return {
    wordCount,
    sentenceCount,
    fillerTotal,
    fillerRate,
    topFillers,
    repeatedTerms,
    repeatedPhrases,
    structureSignals,
    clarityScore,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
