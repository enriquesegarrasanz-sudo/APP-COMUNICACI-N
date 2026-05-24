import { NextResponse } from "next/server";
import { writeTokens } from "@/lib/google-oauth-tokens";
import {
  clearGoogleOAuthStateCookie,
  hasValidGoogleOAuthState,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  function redirectWithError(detail: string) {
    const response = NextResponse.redirect(
      new URL(`/?driveOAuth=error&detail=${encodeURIComponent(detail)}`, url.origin),
    );
    clearGoogleOAuthStateCookie(response);
    return response;
  }

  if (error) {
    return redirectWithError(error);
  }

  if (!hasValidGoogleOAuthState(request, state)) {
    return redirectWithError("invalid_oauth_state");
  }

  if (!code) {
    return redirectWithError("no_code");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/google/oauth/callback";

  if (!clientId || !clientSecret) {
    return redirectWithError("missing_env");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const payload = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || `HTTP ${tokenResponse.status}`;
    return redirectWithError(detail);
  }

  if (!payload.refresh_token) {
    return redirectWithError("no_refresh_token_revoke_and_retry");
  }

  await writeTokens({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expiry_date: Date.now() + (payload.expires_in ?? 3600) * 1000,
    scope: payload.scope ?? "",
  });

  const response = NextResponse.redirect(new URL("/?driveOAuth=success", url.origin));
  clearGoogleOAuthStateCookie(response);
  return response;
}
