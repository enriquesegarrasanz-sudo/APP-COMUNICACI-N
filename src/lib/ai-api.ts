import { promises as fs } from "node:fs";
import path from "node:path";
import { PublicError, requireSafeServiceUrl } from "@/lib/security";
import type { AiSettings, AnalysisResult, VideoEntry } from "@/types/video";

type ChatCompletionPayload = {
  choices?: Array<{ message?: { content?: string } }>;
};

type ChatCompletionRequest = {
  model: string;
  messages: ReturnType<typeof buildAnalysisPrompt>;
  response_format: { type: "json_object" };
  thinking?: { type: "disabled" };
};

type AnthropicPayload = {
  content?: Array<{ text?: string; type?: string }>;
};

function endpoint(baseUrl: string, suffix: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${suffix.replace(/^\/+/, "")}`;
}

function requireApiKey(settings: AiSettings) {
  if (settings.authMode === "none") {
    return "";
  }

  const apiKey = process.env[settings.apiKeyEnvVar];

  if (!apiKey) {
    throw new PublicError(`Falta ${settings.apiKeyEnvVar} en .env.local para usar ${settings.providerName}.`);
  }

  return apiKey;
}

function authorizationHeaders(settings: AiSettings, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {};

  if (settings.providerKind === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
  }

  if (settings.authMode === "bearer") {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (settings.authMode === "x-api-key") {
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

function apiUrl(settings: AiSettings, suffix: string, apiKey: string) {
  const url = endpoint(settings.baseUrl, suffix);

  if (settings.authMode !== "query-key") {
    return requireSafeServiceUrl(url);
  }

  const separator = url.includes("?") ? "&" : "?";
  return requireSafeServiceUrl(
    `${url}${separator}${encodeURIComponent(settings.apiKeyQueryParam)}=${encodeURIComponent(apiKey)}`,
  );
}

function parseNotes(content: string) {
  const parsed = JSON.parse(content) as { notes?: string[] };
  return Array.isArray(parsed.notes)
    ? parsed.notes.filter((item) => typeof item === "string" && item.trim()).slice(0, 4)
    : null;
}

function buildAnalysisPrompt(entry: VideoEntry, analysis: AnalysisResult, settings: AiSettings) {
  const contextBlocks = [
    settings.applicationContext,
    "Objetivo: analizar una transcripcion escrita para detectar patrones de comunicacion oral y progreso frente a camara.",
    "No has escuchado el audio original. No inventes palabras, tono, pausas exactas ni lenguaje corporal que no aparezcan en los datos.",
    "Evalua claridad, estructura, muletillas, repeticiones, ritmo verbal, cierre, intencion y una practica concreta para la siguiente grabacion.",
    "Devuelve solo JSON valido con la forma {\"notes\":[\"...\"]}. Cada nota debe ser breve, especifica, accionable y escrita en espanol natural.",
  ];

  if (settings.historyContextEnabled) {
    contextBlocks.push("Ten en cuenta que esta sesion forma parte de un diario de evolucion: prioriza patrones repetibles y mejoras para la siguiente grabacion.");
  }

  if (settings.videoAnalysisEnabled) {
    contextBlocks.push("La conexion de vision esta marcada como disponible. Si recibes observaciones visuales, usalas para el analisis corporal.");
  }

  return [
    {
      role: "system",
      content: contextBlocks.join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          session: {
            titulo: entry.titulo,
            tema: entry.tema,
            fecha: entry.fecha,
            etiquetas: entry.etiquetas,
            notasMeGusto: entry.notasMeGusto,
            notasMejorar: entry.notasMejorar,
          },
          heuristicAnalysis: {
            wordCount: analysis.wordCount,
            sentenceCount: analysis.sentenceCount,
            fillerTotal: analysis.fillerTotal,
            fillerRate: analysis.fillerRate,
            topFillers: analysis.topFillers,
            repeatedTerms: analysis.repeatedTerms,
            repeatedPhrases: analysis.repeatedPhrases,
            structureSignals: analysis.structureSignals,
            clarityScore: analysis.clarityScore,
          },
          transcript: entry.transcript.slice(0, 12000),
        },
        null,
        2,
      ),
    },
  ];
}

export async function transcribeWithConfiguredAi(filePath: string, settings: AiSettings) {
  if (!settings.transcriptionEnabled) {
    throw new PublicError("La transcripcion por API esta desactivada. Usa Whisper local en este ordenador.");
  }

  const apiKey = requireApiKey(settings);
  const fileBuffer = await fs.readFile(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  ) as ArrayBuffer;
  const form = new FormData();
  form.set("file", new Blob([arrayBuffer], { type: "application/octet-stream" }), path.basename(filePath));
  form.set("model", settings.transcriptionModel);
  form.set("response_format", "text");
  form.set(
    "prompt",
    "Transcribe en espanol de forma fiel. Conserva muletillas, pausas habladas y expresiones como um, eh, vale, o sea, sabes, pues, digamos.",
  );

  const response = await fetch(apiUrl(settings, settings.transcriptionEndpoint, apiKey), {
    method: "POST",
    headers: authorizationHeaders(settings, apiKey),
    body: form,
  });

  if (!response.ok) {
    throw new PublicError(`${settings.providerName} transcripcion fallo: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { text?: string; transcript?: string };
    return String(payload.text ?? payload.transcript ?? "").trim();
  }

  return (await response.text()).trim();
}

export async function getAiCoachNotes(entry: VideoEntry, analysis: AnalysisResult, settings: AiSettings) {
  if (!settings.transcriptAnalysisEnabled) {
    throw new PublicError("El analisis de transcripcion por IA esta desactivado.");
  }

  if (entry.transcript.trim().length < 40) {
    return null;
  }

  const apiKey = requireApiKey(settings);
  const messages = buildAnalysisPrompt(entry, analysis, settings);

  if (settings.providerKind === "anthropic") {
    const [systemMessage, userMessage] = messages;
    const response = await fetch(apiUrl(settings, settings.chatEndpoint, apiKey), {
      method: "POST",
      headers: {
        ...authorizationHeaders(settings, apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.analysisModel,
        max_tokens: 700,
        system: systemMessage.content,
        messages: [{ role: "user", content: userMessage.content }],
      }),
    });

    if (!response.ok) {
      throw new PublicError(`${settings.providerName} analisis fallo: ${response.status}`);
    }

    const payload = (await response.json()) as AnthropicPayload;
    const content = payload.content?.find((item) => typeof item.text === "string")?.text;
    return content ? parseNotes(content) : null;
  }

  const requestBody: ChatCompletionRequest = {
    model: settings.analysisModel,
    messages,
    response_format: { type: "json_object" },
  };

  if (settings.providerKind === "deepseek") {
    requestBody.thinking = { type: "disabled" };
  }

  const response = await fetch(apiUrl(settings, settings.chatEndpoint, apiKey), {
    method: "POST",
    headers: {
      ...authorizationHeaders(settings, apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new PublicError(`${settings.providerName} analisis fallo: ${response.status}`);
  }

  const payload = (await response.json()) as ChatCompletionPayload;
  const content = payload.choices?.[0]?.message?.content;

  return content ? parseNotes(content) : null;
}
