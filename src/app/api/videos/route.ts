import { NextResponse } from "next/server";
import { createVideoEntry, listVideoEntries } from "@/lib/storage";
import {
  logUnexpectedError,
  publicErrorMessage,
  publicErrorStatus,
  requireLocalWriteRequest,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const videos = await listVideoEntries();
  return NextResponse.json({ videos });
}

export async function POST(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  try {
    const formData = await request.formData();
    const entry = await createVideoEntry(formData);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    logUnexpectedError("videos.create", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo crear el video.") },
      { status: publicErrorStatus(error, 400) },
    );
  }
}
