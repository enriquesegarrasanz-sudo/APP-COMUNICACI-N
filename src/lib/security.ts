import { NextResponse } from "next/server";

export class PublicError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

export function publicErrorMessage(error: unknown, fallback: string) {
  return error instanceof PublicError ? error.message : fallback;
}

export function publicErrorStatus(error: unknown, fallback = 400) {
  return error instanceof PublicError ? error.status : fallback;
}

export function logUnexpectedError(scope: string, error: unknown) {
  if (error instanceof PublicError) {
    return;
  }

  console.error(`[${scope}]`, error);
}

function hostnameFromHost(host: string) {
  const trimmed = host.trim().toLowerCase();

  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  return trimmed.split(":")[0] ?? "";
}

export function isLoopbackHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.")
  );
}

export function requireLocalWriteRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "Origen de la peticion no permitido." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Origen de la peticion no permitido." }, { status: 403 });
    }
  }

  const allowRemoteWrites = process.env.APP_ALLOW_REMOTE_WRITE === "true";

  if (!allowRemoteWrites && !isLoopbackHostname(hostnameFromHost(host))) {
    return NextResponse.json(
      { error: "Las escrituras remotas estan desactivadas para proteger los datos locales." },
      { status: 403 },
    );
  }

  return null;
}

export async function readJsonObject<T>(request: Request): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new PublicError("El cuerpo JSON no es valido.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublicError("El cuerpo JSON debe ser un objeto.");
  }

  return body as T;
}

export function requireSafeServiceUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new PublicError("La URL del proveedor no es valida.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new PublicError("La URL del proveedor debe usar HTTP o HTTPS.");
  }

  if (parsed.protocol === "http:" && !isLoopbackHostname(parsed.hostname)) {
    throw new PublicError("Usa HTTPS para proveedores remotos o HTTP solo en localhost.");
  }

  return parsed.toString();
}
