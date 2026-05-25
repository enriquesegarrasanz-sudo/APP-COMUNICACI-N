import type {
  AnalysisResult,
  DiscourseConnector,
  FillerCount,
  RepeatedTerm,
  StructureSignal,
  ToneMarker,
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

const discourseGroups = [
  {
    category: "causal",
    phrases: ["porque", "ya que", "por eso", "debido a", "puesto que", "dado que", "por tanto"],
  },
  {
    category: "temporal",
    phrases: ["primero", "luego", "despues", "mientras", "antes de", "a continuacion", "seguidamente"],
  },
  {
    category: "contraste",
    phrases: ["pero", "sin embargo", "aunque", "en cambio", "no obstante", "por otro lado", "a pesar de"],
  },
  {
    category: "aditivo",
    phrases: ["ademas", "tambien", "incluso", "igualmente", "asimismo", "por otra parte", "aparte de"],
  },
  {
    category: "conclusivo",
    phrases: ["por lo tanto", "en conclusion", "finalmente", "en resumen", "por ultimo", "para concluir", "en definitiva"],
  },
  {
    category: "ejemplo",
    phrases: ["por ejemplo", "es decir", "en concreto", "concretamente", "en particular", "digamos que"],
  },
];

const assertivePhrases = [
  "estoy convencido", "sin duda", "claramente", "es evidente", "definitivamente",
  "esta claro", "por supuesto", "es importante", "lo fundamental", "es clave",
  "estoy seguro", "tengo claro", "afirmo", "sostengo",
];

const hesitantPhrases = [
  "creo que", "no se si", "quizas", "tal vez", "puede que", "a lo mejor",
  "no estoy seguro", "supongo", "imagino que", "me parece", "diria que",
  "podria ser", "no lo tengo claro",
];

function detectDiscourseConnectors(normalized: string): DiscourseConnector[] {
  return discourseGroups.map((group) => ({
    category: group.category,
    examples: group.phrases.filter((phrase) => countPhrase(normalized, phrase) > 0),
    count: group.phrases.reduce((total, phrase) => total + countPhrase(normalized, phrase), 0),
  }));
}

function detectToneMarkers(normalized: string, phrases: string[]): ToneMarker[] {
  return phrases
    .map((phrase) => ({ phrase, count: countPhrase(normalized, phrase) }))
    .filter((marker) => marker.count > 0)
    .sort((a, b) => b.count - a.count);
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

  const uniqueWords = new Set(words.filter((w) => w.length >= 3 && !stopWords.has(w)));
  const uniqueWordCount = uniqueWords.size;
  const contentWords = words.filter((w) => w.length >= 3 && !stopWords.has(w)).length;
  const vocabularyDiversity = contentWords > 0 ? Math.round((uniqueWordCount / contentWords) * 100) : 0;

  const avgSentenceLength = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  const discourseConnectors = detectDiscourseConnectors(normalized);
  const connectorVariety = discourseConnectors.filter((c) => c.count > 0).length;

  const assertivenessMarkers = detectToneMarkers(normalized, assertivePhrases);
  const hesitationMarkers = detectToneMarkers(normalized, hesitantPhrases);
  const assertTotal = assertivenessMarkers.reduce((t, m) => t + m.count, 0);
  const hesitTotal = hesitationMarkers.reduce((t, m) => t + m.count, 0);
  const toneTotal = assertTotal + hesitTotal;
  const confidenceScore = toneTotal > 0 ? Math.round((assertTotal / toneTotal) * 100) : 50;

  const fillerPenalty = Math.min(32, fillerRate * 0.22);
  const lengthPenalty = wordCount > 0 && wordCount < 80 ? 8 : 0;
  const diversityBonus = vocabularyDiversity > 65 ? 4 : vocabularyDiversity > 50 ? 2 : 0;
  const connectorBonus = connectorVariety >= 4 ? 4 : connectorVariety >= 2 ? 2 : 0;
  const clarityScore = clamp(
    Math.round(66 + structureCoverage * 6 + diversityBonus + connectorBonus - fillerPenalty - repeatedPhrases.length * 3 - lengthPenalty),
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

  if (vocabularyDiversity < 40 && wordCount >= 80) {
    recommendations.push("Tu vocabulario es muy repetitivo. Intenta usar sinonimos o reformular ideas con palabras distintas.");
  } else if (vocabularyDiversity >= 65) {
    recommendations.push("Buen rango de vocabulario. Manten esa variedad.");
  }

  if (connectorVariety < 2 && wordCount >= 60) {
    recommendations.push("Usa mas conectores discursivos (porque, ademas, sin embargo) para enlazar ideas con claridad.");
  }

  if (avgSentenceLength > 30 && sentenceCount >= 3) {
    recommendations.push("Tus frases son largas (media de " + avgSentenceLength + " palabras). Prueba a partir alguna en dos para ganar claridad.");
  } else if (avgSentenceLength < 8 && sentenceCount >= 5) {
    recommendations.push("Tus frases son muy cortas. Conecta ideas para dar fluidez al discurso.");
  }

  if (confidenceScore < 30 && toneTotal >= 3) {
    recommendations.push("Detectadas muchas expresiones de vacilacion. Sustituye \"creo que\" o \"no se si\" por afirmaciones directas.");
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
    uniqueWordCount,
    vocabularyDiversity,
    avgSentenceLength,
    discourseConnectors,
    connectorVariety,
    assertivenessMarkers,
    hesitationMarkers,
    confidenceScore,
  };
}
