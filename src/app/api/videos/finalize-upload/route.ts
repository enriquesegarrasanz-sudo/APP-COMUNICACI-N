import { NextResponse } from "next/server";
import { finalizeDriveUpload, type FinalizeDriveUploadInput } from "@/lib/storage";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  readJsonObject,
  requireLocalWriteRequest,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  try {
    const body = await readJsonObject<FinalizeDriveUploadInput>(request);
    const entry = await finalizeDriveUpload(body);

    if (!entry) {
      return NextResponse.json({ error: "Video no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    logUnexpectedError("videos.finalize-upload", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo finalizar la subida.") },
      { status: publicErrorStatus(error, 400) },
    );
  }
}
