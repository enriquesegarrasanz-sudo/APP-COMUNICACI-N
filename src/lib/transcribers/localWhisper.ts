import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { defaultWhisperCommand, defaultWhisperModel } from "@/lib/ai-defaults";
import { splitCommand } from "@/lib/local-processes";
import { PublicError } from "@/lib/security";
import type { AiSettings } from "@/types/video";

async function runProcess(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONIOENCODING: process.env.PYTHONIOENCODING || "utf-8",
        PYTHONUTF8: process.env.PYTHONUTF8 || "1",
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Whisper ha tardado demasiado y se ha cancelado."));
    }, 30 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if ("code" in error && error.code === "ENOENT") {
        reject(
          new PublicError(
            `No se encontro el comando de Whisper "${command}". Configura WHISPER_COMMAND en .env.local.`,
          ),
        );
        return;
      }

      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Whisper termino con codigo ${code}.`));
      }
    });
  });
}

export async function transcribeWithLocalWhisper(filePath: string, settings?: AiSettings) {
  const commandParts = splitCommand(settings?.whisperCommand || process.env.WHISPER_COMMAND || defaultWhisperCommand);

  if (commandParts.length === 0) {
    throw new PublicError("Configura el comando de Whisper en Ajustes de IA.");
  }

  const outputDir = path.join(process.cwd(), "data", "transcripts");
  await fs.mkdir(outputDir, { recursive: true });

  const model = settings?.whisperModel || process.env.WHISPER_MODEL || defaultWhisperModel;
  const command = commandParts[0];
  const args = [
    ...commandParts.slice(1),
    filePath,
    "--language",
    "Spanish",
    "--model",
    model,
    "--output_format",
    "txt",
    "--output_dir",
    outputDir,
  ];

  const result = await runProcess(command, args);
  const transcriptPath = path.join(outputDir, `${path.basename(filePath, path.extname(filePath))}.txt`);

  try {
    const transcript = await fs.readFile(transcriptPath, "utf8");
    return transcript.trim();
  } catch {
    return result.stdout.trim();
  }
}
