import { NextResponse } from "next/server";
import { createVideoEntry, listVideoEntries } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const videos = await listVideoEntries();
  return NextResponse.json({ videos });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const entry = await createVideoEntry(formData);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el video." },
      { status: 400 },
    );
  }
}

