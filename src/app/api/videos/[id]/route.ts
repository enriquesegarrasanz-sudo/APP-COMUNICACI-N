import { NextResponse } from "next/server";
import { deleteVideoEntry, getVideoEntry, sanitizeVideoPatch, updateVideoEntry } from "@/lib/storage";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";
import type { VideoEntry } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const entry = await getVideoEntry(id);

  if (!entry) {
    return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  try {
    const { id } = await context.params;
    const body = await readJsonObject<Partial<VideoEntry>>(request);
    const entry = await updateVideoEntry(id, sanitizeVideoPatch(body));

    if (!entry) {
      return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    logUnexpectedError("videos.update", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo guardar el video.") },
      { status: publicErrorStatus(error, 400) },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const blocked = requireLocalWriteRequest(_request);

  if (blocked) {
    return blocked;
  }

  const { id } = await context.params;
  const deleted = await deleteVideoEntry(id);

  if (!deleted) {
    return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
