import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const PERSONAL_ACCESS_COOKIE = "app_speaking_access";
const PERSONAL_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const GOOGLE_OAUTH_STATE_COOKIE = "app_speaking_google_oauth_state";
const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

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

function configuredAccessSecret() {
  return process.env.APP_ACCESS_SECRET?.trim() ?? "";
}

function hasConfiguredAccessSecret() {
  return configuredAccessSecret().length >= 8;
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function signAccessPayload(payload: string) {
  return createHmac("sha256", configuredAccessSecret()).update(payload).digest("base64url");
}

function signOAuthStatePayload(payload: string) {
  const signingKey = configuredAccessSecret() || "app-speaking-local-oauth-state";
  return createHmac("sha256", signingKey).update(payload).digest("base64url");
}

function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();

  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (key) {
      try {
        cookies.set(key, decodeURIComponent(value));
      } catch {
        cookies.set(key, value);
      }
    }
  }

  return cookies;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer") {
    return "";
  }

  return token?.trim() ?? "";
}

function hasValidAccessCookie(request: Request) {
  const token = parseCookies(request.headers.get("cookie")).get(PERSONAL_ACCESS_COOKIE) ?? "";
  const [version, issuedAt, signature] = token.split(".");

  if (version !== "v1" || !issuedAt || !signature) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  const now = Date.now();

  if (!Number.isFinite(issuedAtMs) || issuedAtMs > now) {
    return false;
  }

  if (now - issuedAtMs > PERSONAL_ACCESS_MAX_AGE_SECONDS * 1000) {
    return false;
  }

  const payload = `${version}.${issuedAt}`;
  return safeEqual(signature, signAccessPayload(payload));
}

function requestHasPersonalAccess(request: Request) {
  if (!hasConfiguredAccessSecret()) {
    return false;
  }

  const headerSecret = request.headers.get("x-app-access-secret")?.trim() ?? bearerToken(request);

  if (headerSecret && safeEqual(headerSecret, configuredAccessSecret())) {
    return true;
  }

  return hasValidAccessCookie(request);
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

export function getPersonalAccessStatus(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const remote = !isLoopbackHostname(hostnameFromHost(host));
  const remoteWritesEnabled = process.env.APP_ALLOW_REMOTE_WRITE === "true";
  const accessConfigured = hasConfiguredAccessSecret();

  return {
    accessConfigured,
    granted: remote ? requestHasPersonalAccess(request) : true,
    remote,
    remoteWritesEnabled,
    required: remote,
  };
}

export function validatePersonalAccessSecret(secret: string) {
  return hasConfiguredAccessSecret() && safeEqual(secret.trim(), configuredAccessSecret());
}

export function setPersonalAccessCookie(response: NextResponse) {
  const issuedAt = Date.now().toString();
  const payload = `v1.${issuedAt}`;

  response.cookies.set({
    name: PERSONAL_ACCESS_COOKIE,
    value: `${payload}.${signAccessPayload(payload)}`,
    httpOnly: true,
    maxAge: PERSONAL_ACCESS_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearPersonalAccessCookie(response: NextResponse) {
  response.cookies.set({
    name: PERSONAL_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function createGoogleOAuthState() {
  const issuedAt = Date.now().toString();
  const nonce = randomBytes(24).toString("base64url");
  const payload = `v1.${issuedAt}.${nonce}`;
  return `${payload}.${signOAuthStatePayload(payload)}`;
}

export function setGoogleOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set({
    name: GOOGLE_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/api/google/oauth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearGoogleOAuthStateCookie(response: NextResponse) {
  response.cookies.set({
    name: GOOGLE_OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/api/google/oauth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function hasValidGoogleOAuthState(request: Request, state: string | null) {
  if (!state) {
    return false;
  }

  const cookieState = parseCookies(request.headers.get("cookie")).get(GOOGLE_OAUTH_STATE_COOKIE) ?? "";

  if (!cookieState || !safeEqual(cookieState, state)) {
    return false;
  }

  const [version, issuedAt, nonce, signature] = state.split(".");

  if (version !== "v1" || !issuedAt || !nonce || !signature) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  const now = Date.now();

  if (!Number.isFinite(issuedAtMs) || issuedAtMs > now) {
    return false;
  }

  if (now - issuedAtMs > GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS * 1000) {
    return false;
  }

  return safeEqual(signature, signOAuthStatePayload(`${version}.${issuedAt}.${nonce}`));
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
  const remoteRequest = !isLoopbackHostname(hostnameFromHost(host));

  if (!allowRemoteWrites && remoteRequest) {
    return NextResponse.json(
      { error: "Las escrituras remotas estan desactivadas para proteger los datos locales." },
      { status: 403 },
    );
  }

  if (remoteRequest && !hasConfiguredAccessSecret()) {
    return NextResponse.json(
      { error: "Configura APP_ACCESS_SECRET antes de permitir escrituras remotas." },
      { status: 403 },
    );
  }

  if (remoteRequest && !requestHasPersonalAccess(request)) {
    return NextResponse.json(
      { error: "Acceso personal requerido para escribir en esta app." },
      { status: 401 },
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
