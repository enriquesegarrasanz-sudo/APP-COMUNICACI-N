import { createSign } from "node:crypto";
import { promises as fs } from "node:fs";
import { PublicError } from "@/lib/security";
import type { DriveSettings } from "@/types/video";

type TokenPayload = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type DriveFilePayload = {
  id?: string;
  name?: string;
  webViewLink?: string;
  webContentLink?: string;
  mimeType?: string;
  size?: string;
  error?: { message?: string };
};

type CachedToken = {
  accessToken: string;
  cacheKey: string;
  expiresAt: number;
};

type DriveUploadResult = {
  fileId: string;
  fileName: string;
  webViewLink?: string;
};

let cachedToken: CachedToken | null = null;

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getDriveCredentials(settings: DriveSettings) {
  const email = process.env[settings.serviceAccountEmailEnvVar]?.trim();
  const rawPrivateKey = process.env[settings.serviceAccountPrivateKeyEnvVar];
  const privateKey = rawPrivateKey?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new PublicError(
      `Faltan ${settings.serviceAccountEmailEnvVar} o ${settings.serviceAccountPrivateKeyEnvVar} en .env.local.`,
    );
  }

  return { email, privateKey };
}

async function getAccessToken(settings: DriveSettings) {
  const { email, privateKey } = getDriveCredentials(settings);
  const cacheKey = `${settings.serviceAccountEmailEnvVar}:${settings.serviceAccountPrivateKeyEnvVar}:${email}`;
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.cacheKey === cacheKey && cachedToken.expiresAt > now + 90) {
    return cachedToken.accessToken;
  }

  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const claim = base64UrlJson({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  });
  const unsignedToken = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
  });
  const payload = (await response.json()) as TokenPayload;

  if (!response.ok || !payload.access_token) {
    throw new PublicError(`Google Drive no pudo autenticar la service account: ${response.status}`);
  }

  cachedToken = {
    accessToken: payload.access_token,
    cacheKey,
    expiresAt: now + (payload.expires_in ?? 3600),
  };

  return payload.access_token;
}

export async function uploadFileToDrive({
  fileName,
  filePath,
  mimeType,
  settings,
}: {
  fileName: string;
  filePath: string;
  mimeType: string;
  settings: DriveSettings;
}): Promise<DriveUploadResult> {
  if (!settings.enabled) {
    throw new PublicError("Drive esta desactivado.");
  }

  if (!settings.folderId.trim()) {
    throw new PublicError("Falta el ID de carpeta de Google Drive.");
  }

  const accessToken = await getAccessToken(settings);
  const fileBuffer = await fs.readFile(filePath);
  const boundary = `app-speaking-${crypto.randomUUID()}`;
  const metadata = {
    mimeType,
    name: fileName,
    parents: [settings.folderId.trim()],
  };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata,
      )}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      "utf8",
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": String(body.length),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const payload = (await response.json()) as DriveFilePayload;

  if (!response.ok || !payload.id) {
    throw new PublicError(`Google Drive no pudo subir el archivo: ${response.status}`);
  }

  return {
    fileId: payload.id,
    fileName: payload.name ?? fileName,
    webViewLink: payload.webViewLink,
  };
}
