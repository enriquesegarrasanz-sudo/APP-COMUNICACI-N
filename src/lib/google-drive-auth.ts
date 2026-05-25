import crypto from "node:crypto";
import {
  getOAuthAccessToken,
  isOAuthConnected,
} from "@/lib/google-oauth-tokens";

export type GoogleDriveAuthMode = "oauth" | "service-account" | "none";

export type GoogleDriveAuthStatus = {
  connected: boolean;
  mode: GoogleDriveAuthMode;
  writable: boolean;
};

type ServiceAccountToken = {
  accessToken: string;
  expiresAt: number;
};

let serviceAccountToken: ServiceAccountToken | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function serviceAccountPrivateKey() {
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  return key ? key.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n").trim() : "";
}

export function hasServiceAccountCredentials() {
  return Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL && serviceAccountPrivateKey());
}

let inflightServiceAccountRefresh: Promise<string> | null = null;

async function getServiceAccountAccessToken() {
  if (serviceAccountToken && serviceAccountToken.expiresAt > Date.now() + 60_000) {
    return serviceAccountToken.accessToken;
  }

  if (inflightServiceAccountRefresh) {
    return inflightServiceAccountRefresh;
  }

  inflightServiceAccountRefresh = fetchServiceAccountToken().finally(() => {
    inflightServiceAccountRefresh = null;
  });

  return inflightServiceAccountRefresh;
}

async function fetchServiceAccountToken(): Promise<string> {
  const email = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = serviceAccountPrivateKey();

  if (!email || !privateKey) {
    throw new Error("Faltan GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL o GOOGLE_DRIVE_PRIVATE_KEY en .env.local.");
  }

  for (let attempt = 0; attempt <= 2; attempt++) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claimSet = base64Url(
      JSON.stringify({
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
        iss: email,
        scope: "https://www.googleapis.com/auth/drive",
      }),
    );
    const unsignedJwt = `${header}.${claimSet}`;
    const signature = crypto.createSign("RSA-SHA256").update(unsignedJwt).sign(privateKey);
    const assertion = `${unsignedJwt}.${base64Url(signature)}`;

    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          assertion,
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        }),
      });
    } catch {
      if (attempt < 2) {
        await new Promise<void>((r) => setTimeout(r, 800 * 2 ** attempt));
        continue;
      }
      throw new Error("No se pudo autenticar Google Drive con service account: error de red.");
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise<void>((r) => setTimeout(r, 800 * 2 ** attempt));
      continue;
    }

    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !payload.access_token) {
      const detail = payload.error_description || payload.error || `HTTP ${response.status}`;
      throw new Error(`No se pudo autenticar Google Drive con service account: ${detail}`);
    }

    serviceAccountToken = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };

    return serviceAccountToken.accessToken;
  }

  throw new Error("No se pudo autenticar Google Drive con service account: reintentos agotados.");
}

export async function getGoogleDriveAuthStatus(): Promise<GoogleDriveAuthStatus> {
  if (await isOAuthConnected()) {
    return { connected: true, mode: "oauth", writable: true };
  }

  if (hasServiceAccountCredentials()) {
    return { connected: true, mode: "service-account", writable: false };
  }

  return { connected: false, mode: "none", writable: false };
}

export async function getGoogleDriveAccessToken() {
  if (await isOAuthConnected()) {
    return getOAuthAccessToken();
  }

  if (hasServiceAccountCredentials()) {
    return getServiceAccountAccessToken();
  }

  return getOAuthAccessToken();
}
