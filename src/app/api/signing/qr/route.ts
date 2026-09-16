import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { validateSigningSession } from "@/lib/token-data";
import { generateCorrelationId, SIGNING_SESSION_COOKIE } from "@/lib/token-utils";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };
const denied = () => NextResponse.json({ error: "Sesi tidak valid atau sudah berakhir." }, { status: 403, headers });

export async function GET(request: NextRequest) {
  const secret = request.cookies.get(SIGNING_SESSION_COOKIE)?.value;
  if (!secret) return denied();
  try {
    const session = await validateSigningSession(secret, generateCorrelationId());
    if (!session.valid || !session.nomor_surat || !session.scopes?.includes("read:qr") || !session.document_digest || !session.document_version) return denied();
    const evidence = `urn:surat-serah-terima:${encodeURIComponent(session.nomor_surat)}:v${session.document_version}:sha256:${session.document_digest}`;
    const png = await QRCode.toBuffer(evidence, { width: 320, margin: 1, errorCorrectionLevel: "M" });
    return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png", "Content-Disposition": "inline; filename=document-evidence.png" } });
  } catch { return denied(); }
}
