/**
 * ISSUE-30: Endpoint exchange token → sesi signing.
 *
 * GET /api/signing/exchange?t=<rawToken>
 *
 * Flow:
 *   1. Validasi format token
 *   2. Exchange token (atomik, sekali pakai) → buat sesi
 *   3. Set cookie HttpOnly signing session
 *   4. Redirect ke /sign/session (URL bersih, tanpa token)
 *
 * Security:
 *   - Raw token TIDAK di-log
 *   - Cookie: HttpOnly, Secure, SameSite=Strict, Path=/sign
 *   - Redirect ke URL bersih sebelum UI dirender
 *   - Respons error generik (tidak membedakan "expired" vs "dipakai")
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeToken, writeAudit } from "@/lib/token-data";
import {
  generateCorrelationId,
  SIGNING_COOKIE_OPTIONS,
  SIGNING_SESSION_COOKIE,
} from "@/lib/token-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const correlationId = generateCorrelationId();

  // Ambil token dari query string — jangan log nilai ini
  const rawToken = request.nextUrl.searchParams.get("t");

  // Validasi format minimal: base64url, ~43 karakter (256-bit)
  if (!rawToken || !/^[A-Za-z0-9_-]{40,60}$/.test(rawToken)) {
    return redirectToError("Link tidak valid atau sudah kedaluwarsa.", request);
  }

  try {
    const session = await exchangeToken(rawToken, correlationId);

    // Buat response redirect ke /sign/session (URL bersih)
    const sessionPath = `/sign/session?nomor=${encodeURIComponent(session.nomor_surat)}&pihak=${encodeURIComponent(session.pihak)}`;
    const redirectUrl = new URL(sessionPath, request.url);
    const response = NextResponse.redirect(redirectUrl);

    // Set cookie sesi signing
    response.cookies.set(SIGNING_SESSION_COOKIE, session.session_id, {
      ...SIGNING_COOKIE_OPTIONS,
      expires: new Date(session.expires_at),
      maxAge: Math.floor(
        (new Date(session.expires_at).getTime() - Date.now()) / 1000,
      ),
    });

    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store, private");

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "UNKNOWN";

    // Audit kegagalan (dengan correlation ID untuk tracing, tanpa raw token)
    await writeAudit({
      event: "token.replay_rejected",
      nomor: null,
      pihak: null,
      outcome: "failure",
      correlationId,
      actor: null,
      actorType: "external_signer",
      metadata: { reason: msg === "TOKEN_EXPIRED" ? "expired" : "invalid" },
    });

    // Respons generik — tidak membocorkan apakah token expired vs dipakai
    return redirectToError("Link tidak valid atau sudah kedaluwarsa.", request);
  }
}

function redirectToError(reason: string, request: NextRequest): NextResponse {
  const errorUrl = new URL("/sign/invalid", request.url);
  errorUrl.searchParams.set("reason", reason);
  const response = NextResponse.redirect(errorUrl);
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
