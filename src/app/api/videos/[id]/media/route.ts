import { NextResponse } from "next/server";
import { fetchDriveFileMedia } from "@/lib/google-drive";
import { getVideoEntry } from "@/lib/storage";
import { logUnexpectedError, publicErrorMessage, publicErrorStatus } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MediaSelection = {
  fileId: string;
  mimeType: string;
};

function selectMedia(entry: Awaited<ReturnType<typeof getVideoEntry>>, kind: string | null): MediaSelection | null {
  if (!entry) {
    return null;
  }

  if (kind === "audio") {
    const audioFileId = entry.driveAudioFileId || (entry.mimeType.startsWith("audio/") ? entry.driveOriginalFileId : "");

    if (audioFileId) {
      return { fileId: audioFileId, mimeType: "audio/mp4" };
    }
  }

  const fileId = entry.driveCompressedFileId || entry.driveOriginalFileId || entry.driveFileId;

  if (!fileId) {
    return null;
  }

  return {
    fileId,
    mimeType: entry.driveCompressedFileId ? "video/mp4" : entry.mimeType || "video/mp4",
  };
}

function mediaHeaders(response: Response, mimeType: string) {
  const headers = new Headers();
  const passThroughHeaders = [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "etag",
    "last-modified",
  ];

  for (const name of passThroughHeaders) {
    const value = response.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("Content-Type", response.headers.get("content-type") || mimeType);
  headers.set("Accept-Ranges", response.headers.get("accept-ranges") || "bytes");
  headers.set("Cache-Control", "private, no-store");

  return headers;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const entry = await getVideoEntry(id);

    if (!entry) {
      return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
    }

    const url = new URL(request.url);
    const media = selectMedia(entry, url.searchParams.get("kind"));

    if (!media) {
      return NextResponse.json({ error: "La sesion no tiene archivo de Drive reproducible." }, { status: 404 });
    }

    const driveResponse = await fetchDriveFileMedia({
      fileId: media.fileId,
      range: request.headers.get("range"),
    });

    if (!driveResponse.ok) {
      const detail = await driveResponse.text();
      return NextResponse.json(
        { error: detail || `Google Drive respondio HTTP ${driveResponse.status}.` },
        { status: driveResponse.status },
      );
    }

    return new Response(driveResponse.body, {
      headers: mediaHeaders(driveResponse, media.mimeType),
      status: driveResponse.status,
      statusText: driveResponse.statusText,
    });
  } catch (error) {
    logUnexpectedError("videos.media", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo cargar el archivo desde Drive.") },
      { status: publicErrorStatus(error, 500) },
    );
  }
}
