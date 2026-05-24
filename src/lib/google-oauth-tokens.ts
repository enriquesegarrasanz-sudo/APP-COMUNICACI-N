import { promises as fs } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const tokenFile = path.join(dataDir, "google-drive-token.json");

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
};

let memoryCache: StoredTokens | null = null;

function tokensFromEnv(): StoredTokens | null {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!refreshToken) {
    return null;
  }

  return {
    access_token: process.env.GOOGLE_OAUTH_ACCESS_TOKEN ?? "",
    refresh_token: refreshToken,
    expiry_date: Number(process.env.GOOGLE_OAUTH_ACCESS_TOKEN_EXPIRES_AT ?? 0),
    scope: process.env.GOOGLE_OAUTH_SCOPE ?? "https://www.googleapis.com/auth/drive.file",
  };
}

export async function readTokens(): Promise<StoredTokens | null> {
  const envTokens = tokensFromEnv();

  if (envTokens && memoryCache?.refresh_token !== envTokens.refresh_token) {
    memoryCache = envTokens;
  }

  if (memoryCache) {
    return memoryCache;
  }

  if (envTokens) {
    memoryCache = envTokens;
    return envTokens;
  }

  try {
    const raw = await fs.readFile(tokenFile, "utf8");
    const parsed = JSON.parse(raw) as StoredTokens;

    if (!parsed.refresh_token) {
      return null;
    }

    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: StoredTokens): Promise<void> {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN === tokens.refresh_token) {
    memoryCache = tokens;
    return;
  }

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(tokenFile, JSON.stringify(tokens, null, 2), "utf8");
  memoryCache = tokens;
}

export async function deleteTokens(): Promise<void> {
  memoryCache = null;

  try {
    await fs.unlink(tokenFile);
  } catch {
    // File may not exist — that's fine.
  }
}

export async function isOAuthConnected(): Promise<boolean> {
  const tokens = await readTokens();
  return tokens !== null && Boolean(tokens.refresh_token);
}

/**
 * Returns a valid access token, refreshing automatically if expired.
 * Throws if no tokens are stored or refresh fails.
 */
export async function getOAuthAccessToken(): Promise<string> {
  const tokens = await readTokens();

  if (!tokens || !tokens.refresh_token) {
    throw new Error("Google Drive no esta conectado. Pulsa Conectar Google Drive en ajustes.");
  }

  const now = Date.now();

  if (tokens.access_token && tokens.expiry_date > now + 60_000) {
    return tokens.access_token;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Faltan GOOGLE_OAUTH_CLIENT_ID o GOOGLE_OAUTH_CLIENT_SECRET en .env.local.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || `HTTP ${response.status}`;

    if (payload.error === "invalid_grant") {
      await deleteTokens();
      throw new Error(`Token de Google expirado o revocado. Reconecta Google Drive. (${detail})`);
    }

    throw new Error(`No se pudo refrescar el token de Google Drive: ${detail}`);
  }

  const refreshed: StoredTokens = {
    access_token: payload.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: now + (payload.expires_in ?? 3600) * 1000,
    scope: tokens.scope,
  };

  await writeTokens(refreshed);
  return payload.access_token;
}
