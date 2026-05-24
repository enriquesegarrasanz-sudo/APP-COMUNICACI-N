import { NextResponse } from "next/server";
import {
  clearPersonalAccessCookie,
  getPersonalAccessStatus,
  setPersonalAccessCookie,
  validatePersonalAccessSecret,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(getPersonalAccessStatus(request));
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo JSON no es valido." }, { status: 400 });
  }

  const secret =
    body && typeof body === "object" && !Array.isArray(body) && "secret" in body && typeof body.secret === "string"
      ? body.secret
      : "";

  if (!validatePersonalAccessSecret(secret)) {
    return NextResponse.json({ error: "Clave personal incorrecta." }, { status: 401 });
  }

  const response = NextResponse.json({ granted: true });
  setPersonalAccessCookie(response);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ granted: false });
  clearPersonalAccessCookie(response);
  return response;
}
