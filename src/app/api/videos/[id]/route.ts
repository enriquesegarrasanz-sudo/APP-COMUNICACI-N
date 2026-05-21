import { NextResponse } from "next/server";
import { deleteVideoEntry, getVideoEntry, updateVideoEntry } from "@/lib/storage";
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
  const { id } = await context.params;
  const body = (await request.json()) as Partial<VideoEntry>;
  const allowedPatch: Partial<VideoEntry> = {
    titulo: typeof body.titulo === "string" ? body.titulo.trim() : undefined,
    tema: typeof body.tema === "string" ? body.tema.trim() : undefined,
    fecha: typeof body.fecha === "string" ? body.fecha : undefined,
    etiquetas: Array.isArray(body.etiquetas) ? body.etiquetas.map(String) : undefined,
    notasMeGusto: typeof body.notasMeGusto === "string" ? body.notasMeGusto : undefined,
    notasMejorar: typeof body.notasMejorar === "string" ? body.notasMejorar : undefined,
    transcript: typeof body.transcript === "string" ? body.transcript : undefined,
  };

  Object.keys(allowedPatch).forEach((key) => {
    if (allowedPatch[key as keyof VideoEntry] === undefined) {
      delete allowedPatch[key as keyof VideoEntry];
    }
  });

  const entry = await updateVideoEntry(id, allowedPatch);

  if (!entry) {
    return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteVideoEntry(id);

  if (!deleted) {
    return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

