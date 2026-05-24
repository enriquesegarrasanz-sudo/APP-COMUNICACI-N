import { NextResponse } from "next/server";
import {
  createPendingDriveVideoEntry,
  isDriveStorageDriver,
  type PendingDriveUploadInput,
} from "@/lib/storage";
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

  if (!isDriveStorageDriver()) {
    return NextResponse.json(
      { code: "LOCAL_STORAGE_DRIVER", error: "El storage local usa la subida clasica." },
      { status: 409 },
    );
  }

  try {
    const body = await readJsonObject<PendingDriveUploadInput>(request);
    const result = await createPendingDriveVideoEntry(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logUnexpectedError("drive.upload-session", error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo iniciar la subida a Drive.") },
      { status: publicErrorStatus(error, 400) },
    );
  }
}
