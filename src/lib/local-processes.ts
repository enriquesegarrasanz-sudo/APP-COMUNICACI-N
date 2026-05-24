import { spawn } from "node:child_process";
import { PublicError, requireSafeServiceUrl } from "@/lib/security";
import type { AiSettings } from "@/types/video";

type LocalToolCheck = {
  detail: string;
  ok: boolean;
  started?: boolean;
};

export function splitCommand(command: string) {
  const parts: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(command)) !== null) {
    parts.push(match[1] || match[2] || match[3]);
  }

  return parts;
}

function commandParts(commandLine: string, label: string) {
  const parts = splitCommand(commandLine);

  if (parts.length === 0) {
    throw new PublicError(`Configura el comando de ${label}.`);
  }

  return parts;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function ollamaTagsUrl(settings: AiSettings) {
  return requireSafeServiceUrl(`${settings.baseUrl.replace(/\/+$/, "")}/api/tags`);
}

async function canReachOllama(settings: AiSettings) {
  try {
    const response = await fetchWithTimeout(ollamaTagsUrl(settings), 2200);
    return response.ok;
  } catch {
    return false;
  }
}

function spawnDetached(commandLine: string, label: string) {
  const parts = commandParts(commandLine, label);
  const child = spawn(parts[0], parts.slice(1), {
    cwd: process.cwd(),
    detached: true,
    env: process.env,
    stdio: "ignore",
    windowsHide: true,
  });

  child.on("error", () => undefined);
  child.unref();
}

async function waitForOllama(settings: AiSettings, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReachOllama(settings)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return false;
}

export async function ensureOllamaAvailable(settings: AiSettings): Promise<LocalToolCheck> {
  if (settings.providerKind !== "ollama") {
    return { detail: "El proveedor activo no es Ollama.", ok: true };
  }

  if (await canReachOllama(settings)) {
    return { detail: `Ollama responde en ${settings.baseUrl}.`, ok: true };
  }

  spawnDetached(settings.ollamaStartCommand, "Ollama");

  if (await waitForOllama(settings, 12000)) {
    return { detail: `Ollama se inicio y responde en ${settings.baseUrl}.`, ok: true, started: true };
  }

  throw new PublicError(
    `No se pudo conectar con Ollama en ${settings.baseUrl}. Revisa el comando "${settings.ollamaStartCommand}" y que Ollama este instalado.`,
  );
}

export async function checkWhisperCommand(settings: AiSettings): Promise<LocalToolCheck> {
  const parts = commandParts(settings.whisperCommand, "Whisper");

  return new Promise((resolve, reject) => {
    const child = spawn(parts[0], [...parts.slice(1), "--help"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONIOENCODING: process.env.PYTHONIOENCODING || "utf-8",
        PYTHONUTF8: process.env.PYTHONUTF8 || "1",
      },
      windowsHide: true,
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new PublicError("Whisper no respondio a tiempo al comprobar el comando."));
    }, 10000);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if ("code" in error && error.code === "ENOENT") {
        reject(new PublicError(`No se encontro el comando de Whisper "${parts[0]}".`));
        return;
      }

      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({
          detail: `Whisper responde con "${settings.whisperCommand}" y modelo ${settings.whisperModel}.`,
          ok: true,
        });
        return;
      }

      reject(new PublicError(stderr.trim() || `Whisper termino con codigo ${code} al comprobar el comando.`));
    });
  });
}
