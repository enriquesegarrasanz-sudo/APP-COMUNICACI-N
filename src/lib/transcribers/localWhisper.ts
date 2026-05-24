import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { PublicError } from "@/lib/security";

function splitCommand(command: string) {
  const parts: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(command)) !== null) {
    parts.push(match[1] || match[2] || match[3]);
  }

  return parts;
}

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

function defaultWhisperCommand() {
  return process.platform === "win32" ? "py -m whisper" : "whisper";
}

export async function transcribeWithLocalWhisper(filePath: string) {
  const commandParts = splitCommand(process.env.WHISPER_COMMAND || defaultWhisperCommand());

  if (commandParts.length === 0) {
    throw new PublicError("Configura WHISPER_COMMAND en .env.local.");
  }

  const outputDir = path.join(process.cwd(), "data", "transcripts");
  await fs.mkdir(outputDir, { recursive: true });

  const model = process.env.WHISPER_MODEL || "base";
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
