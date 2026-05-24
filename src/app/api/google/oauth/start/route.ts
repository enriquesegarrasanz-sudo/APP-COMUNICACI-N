import { NextResponse } from "next/server";
import {
  createGoogleOAuthState,
  requireLocalWriteRequest,
  setGoogleOAuthStateCookie,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = requireLocalWriteRequest(request);

  if (blocked) {
    return blocked;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/google/oauth/callback";

  if (!clientId) {
    return NextResponse.json(
      { error: "Falta GOOGLE_OAUTH_CLIENT_ID en .env.local." },
      { status: 500 },
    );
  }

  // Use drive.file scope first (minimum privilege).
  // If folder permission errors appear, the user can switch to drive scope.
  const scope = "https://www.googleapis.com/auth/drive.file";
  const state = createGoogleOAuthState();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  const consentUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const response = NextResponse.redirect(consentUrl);
  setGoogleOAuthStateCookie(response, state);
  return response;
}
