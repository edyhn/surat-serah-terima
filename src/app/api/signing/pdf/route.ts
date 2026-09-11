import { NextRequest, NextResponse } from "next/server";
import { loadFile, pdfName } from "@/lib/data";
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
    if (!session.valid || !session.nomor_surat || !session.scopes?.includes("read:pdf")) return denied();
    const pdf = await loadFile(pdfName(session.nomor_surat));
    return new Response(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=surat-serah-terima.pdf" } });
  } catch { return denied(); }
}
