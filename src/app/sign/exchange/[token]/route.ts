import { NextRequest, NextResponse } from "next/server";
import { exchangeToken, writeAudit } from "@/lib/token-data";
import { generateCorrelationId, SIGNING_COOKIE_OPTIONS, SIGNING_SESSION_COOKIE } from "@/lib/token-utils";

export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };

function secureRedirect(request: NextRequest, pathname: string) {
  const response = NextResponse.redirect(new URL(pathname, request.url), 303);
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  return response;
}

export async function GET(request: NextRequest, context: Context) {
  const correlationId = generateCorrelationId();
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return secureRedirect(request, "/sign/invalid");

  try {
    const session = await exchangeToken(token, correlationId);
    const response = secureRedirect(request, "/sign/session");
    response.cookies.set(SIGNING_SESSION_COOKIE, session.session_secret, {
      ...SIGNING_COOKIE_OPTIONS,
      expires: new Date(session.expires_at),
      maxAge: Math.max(0, Math.min(1800, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000))),
    });
    return response;
  } catch {
    await writeAudit({ event: "token.replay_rejected", nomor: null, pihak: null, outcome: "failure", correlationId, actor: null, actorType: "external_signer", metadata: { reason: "invalid" } });
    return secureRedirect(request, "/sign/invalid");
  }
}
