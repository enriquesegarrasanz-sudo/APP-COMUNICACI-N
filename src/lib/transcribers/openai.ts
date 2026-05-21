import fs from "node:fs";
import OpenAI from "openai";

export async function transcribeWithOpenAI(filePath: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Falta OPENAI_API_KEY en .env.local.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const response = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model,
    response_format: "text",
    prompt:
      "Transcribe en espanol de forma fiel. Conserva muletillas, pausas habladas y expresiones como um, eh, vale, o sea, sabes, pues, digamos.",
  });

  return String(response).trim();
}

