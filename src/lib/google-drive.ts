import { promises as fs } from "node:fs";
import { PublicError } from "@/lib/security";
import { getGoogleDriveAccessToken } from "@/lib/google-drive-auth";
import type { DriveSettings } from "@/types/video";

const driveApiBase = "https://www.googleapis.com/drive/v3";
const driveUploadBase = "https://www.googleapis.com/upload/drive/v3";

export const driveFolderMimeType = "application/vnd.google-apps.folder";
export const driveJsonMimeType = "application/json";

type DriveFilePayload = {
  id?: string;
  name?: string;
  webViewLink?: string;
  webContentLink?: string;
  mimeType?: string;
  size?: string;
  error?: { message?: string; code?: number };
};

export type DriveFileMetadata = {
  fileId: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  webViewLink?: string;
  webContentLink?: string;
};

type DriveUploadResult = {
  fileId: string;
  fileName: string;
  webViewLink?: string;
};

function parseDriveFile(payload: DriveFilePayload, fallbackName = ""): DriveFileMetadata {
  if (!payload.id) {
    throw new PublicError("Google Drive no devolvio ID de archivo.");
  }

  return {
    fileId: payload.id,
    fileName: payload.name ?? fallbackName,
    mimeType: payload.mimeType,
    size: payload.size ? Number(payload.size) : undefined,
    webViewLink: payload.webViewLink,
    webContentLink: payload.webContentLink,
  };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function readDriveResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string } };
    const detail = errorPayload.error?.message || `HTTP ${response.status}`;
    throw new PublicError(`${fallbackError}: ${detail}`, response.status);
  }

  return payload as T;
}

async function driveFetch<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
  const accessToken = await getGoogleDriveAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(url, { ...init, headers });
  return readDriveResponse<T>(response, fallbackError);
}

function jsonMultipartBody(metadata: Record<string, unknown>, content: unknown, boundary: string) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata,
      )}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      "utf8",
    ),
    Buffer.from(JSON.stringify(content, null, 2), "utf8"),
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ]);
}

export async function listDriveChildren({
  parentId,
  name,
  mimeType,
}: {
  parentId: string;
  name?: string;
  mimeType?: string;
}) {
  const query = [
    `'${escapeDriveQueryValue(parentId)}' in parents`,
    "trashed = false",
    name ? `name = '${escapeDriveQueryValue(name)}'` : "",
    mimeType ? `mimeType = '${escapeDriveQueryValue(mimeType)}'` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const params = new URLSearchParams({
    fields: "files(id,name,mimeType,size,webViewLink,webContentLink)",
    q: query,
    spaces: "drive",
  });
  const payload = await driveFetch<{ files?: DriveFilePayload[] }>(
    `${driveApiBase}/files?${params.toString()}`,
    { method: "GET" },
    "Google Drive no pudo listar archivos",
  );

  return (payload.files ?? []).map((file) => parseDriveFile(file, file.name));
}

export async function findDriveChild({
  parentId,
  name,
  mimeType,
}: {
  parentId: string;
  name: string;
  mimeType?: string;
}) {
  const files = await listDriveChildren({ parentId, name, mimeType });
  return files[0] ?? null;
}

export async function createDriveFolder({ parentId, name }: { parentId: string; name: string }) {
  const payload = await driveFetch<DriveFilePayload>(
    `${driveApiBase}/files?fields=id,name,mimeType,webViewLink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        mimeType: driveFolderMimeType,
        name,
        parents: [parentId],
      }),
    },
    "Google Drive no pudo crear la carpeta",
  );

  return parseDriveFile(payload, name);
}

export async function ensureDriveFolder({ parentId, name }: { parentId: string; name: string }) {
  const existing = await findDriveChild({
    parentId,
    name,
    mimeType: driveFolderMimeType,
  });

  if (existing) {
    return existing;
  }

  return createDriveFolder({ parentId, name });
}

export async function readDriveJsonFile<T>({ fileId }: { fileId: string }) {
  return driveFetch<T>(`${driveApiBase}/files/${fileId}?alt=media`, { method: "GET" }, "Google Drive no pudo leer JSON");
}

export async function readDriveJsonFileByName<T>({
  parentId,
  name,
}: {
  parentId: string;
  name: string;
}) {
  const existing = await findDriveChild({ parentId, name, mimeType: driveJsonMimeType });

  if (!existing) {
    return null;
  }

  const value = await readDriveJsonFile<T>({ fileId: existing.fileId });
  return { file: existing, value };
}

export async function writeDriveJsonFile({
  fileId,
  name,
  parentId,
  value,
}: {
  fileId?: string;
  name: string;
  parentId: string;
  value: unknown;
}) {
  const boundary = `app-speaking-json-${crypto.randomUUID()}`;
  const metadata: Record<string, unknown> = {
    mimeType: driveJsonMimeType,
    name,
  };

  if (!fileId) {
    metadata.parents = [parentId];
  }

  const body = jsonMultipartBody(metadata, value, boundary);
  const url = fileId
    ? `${driveUploadBase}/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType,size`
    : `${driveUploadBase}/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType,size`;
  const payload = await driveFetch<DriveFilePayload>(
    url,
    {
      method: fileId ? "PATCH" : "POST",
      headers: {
        "Content-Length": String(body.length),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
    "Google Drive no pudo escribir JSON",
  );

  return parseDriveFile(payload, name);
}

export async function upsertDriveJsonFile({
  name,
  parentId,
  value,
}: {
  name: string;
  parentId: string;
  value: unknown;
}) {
  const existing = await findDriveChild({ parentId, name, mimeType: driveJsonMimeType });
  return writeDriveJsonFile({ fileId: existing?.fileId, name, parentId, value });
}

export async function updateDriveFileById({
  body,
  fileId,
  mimeType,
}: {
  body: BodyInit;
  fileId: string;
  mimeType: string;
}) {
  const payload = await driveFetch<DriveFilePayload>(
    `${driveUploadBase}/files/${fileId}?uploadType=media&fields=id,name,webViewLink,webContentLink,mimeType,size`,
    {
      method: "PATCH",
      headers: { "Content-Type": mimeType },
      body,
    },
    "Google Drive no pudo actualizar el archivo",
  );

  return parseDriveFile(payload);
}

export async function deleteDriveFile(fileId: string) {
  await driveFetch<Record<string, never>>(
    `${driveApiBase}/files/${fileId}`,
    { method: "DELETE" },
    "Google Drive no pudo borrar el archivo",
  );
}

export async function updateDriveJsonFileById({ fileId, value }: { fileId: string; value: unknown }) {
  return updateDriveFileById({
    body: JSON.stringify(value, null, 2),
    fileId,
    mimeType: driveJsonMimeType,
  });
}

export async function createDriveResumableUploadSession({
  fileName,
  mimeType,
  parentId,
  size,
}: {
  fileName: string;
  mimeType: string;
  parentId: string;
  size: number;
}) {
  const accessToken = await getGoogleDriveAccessToken();
  const params = new URLSearchParams({
    fields: "id,name,webViewLink,webContentLink,mimeType,size",
    uploadType: "resumable",
  });
  const response = await fetch(`${driveUploadBase}/files?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify({
      mimeType,
      name: fileName,
      parents: [parentId],
    }),
  });
  const uploadUrl = response.headers.get("location");

  if (!response.ok || !uploadUrl) {
    const payload = await readDriveResponse<DriveFilePayload>(response, "Google Drive no pudo iniciar la subida");
    const detail = payload.error?.message || `HTTP ${response.status}`;
    throw new PublicError(`Google Drive no pudo iniciar la subida: ${detail}`, response.status);
  }

  return uploadUrl;
}

export async function getDriveFileMetadata(fileId: string) {
  const payload = await driveFetch<DriveFilePayload>(
    `${driveApiBase}/files/${fileId}?fields=id,name,webViewLink,webContentLink,mimeType,size`,
    { method: "GET" },
    "Google Drive no pudo leer el archivo",
  );

  return parseDriveFile(payload);
}

export async function downloadDriveFileToPath({ fileId, filePath }: { fileId: string; filePath: string }) {
  const accessToken = await getGoogleDriveAccessToken();
  const response = await fetch(`${driveApiBase}/files/${fileId}?alt=media`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new PublicError(`Google Drive no pudo descargar el archivo: ${detail || `HTTP ${response.status}`}`);
  }

  await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
}

export async function fetchDriveFileMedia({ fileId, range }: { fileId: string; range?: string | null }) {
  const accessToken = await getGoogleDriveAccessToken();
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });

  if (range) {
    headers.set("Range", range);
  }

  return fetch(`${driveApiBase}/files/${fileId}?alt=media`, {
    method: "GET",
    headers,
  });
}

async function uploadFileToDriveFolder({
  fileName,
  filePath,
  mimeType,
  parentId,
}: {
  fileName: string;
  filePath: string;
  mimeType: string;
  parentId: string;
}): Promise<DriveUploadResult> {
  const accessToken = await getGoogleDriveAccessToken();
  const fileBuffer = await fs.readFile(filePath);
  const boundary = `app-speaking-${crypto.randomUUID()}`;
  const metadata = {
    mimeType,
    name: fileName,
    parents: [parentId],
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

  const response = await fetch(`${driveUploadBase}/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType,size`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Length": String(body.length),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const payload = (await response.json()) as DriveFilePayload;

  if (!response.ok || !payload.id) {
    const detail = payload.error?.message || `HTTP ${response.status}`;
    throw new PublicError(`Google Drive no pudo subir el archivo: ${detail}`);
  }

  return {
    fileId: payload.id,
    fileName: payload.name ?? fileName,
    webViewLink: payload.webViewLink,
  };
}

export async function upsertFileToDriveFolder({
  fileName,
  filePath,
  mimeType,
  parentId,
}: {
  fileName: string;
  filePath: string;
  mimeType: string;
  parentId: string;
}) {
  const existing = await findDriveChild({ parentId, name: fileName });

  if (!existing) {
    return uploadFileToDriveFolder({ fileName, filePath, mimeType, parentId });
  }

  const fileBuffer = await fs.readFile(filePath);
  const updated = await updateDriveFileById({
    body: fileBuffer,
    fileId: existing.fileId,
    mimeType,
  });

  return {
    fileId: updated.fileId,
    fileName: updated.fileName || fileName,
    webViewLink: updated.webViewLink,
  };
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

  return uploadFileToDriveFolder({
    fileName,
    filePath,
    mimeType,
    parentId: settings.folderId.trim(),
  });
}
