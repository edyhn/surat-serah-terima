/**
 * ISSUE-30: API internal – revoke/rotate token.
 *
 * DELETE /api/signing/token/[id]  → cabut token berdasarkan ID
 * POST   /api/signing/token/[id]/rotate → rotate: cabut lama, terbitkan baru
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { revokeToken, issueSigningToken, getCurrentDocumentVersion } from "@/lib/token-data";
import { generateCorrelationId } from "@/lib/token-utils";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";

type Context = { params: Promise<{ id: string }> };

/** Dapatkan user id dari sesi aktif; null jika tidak terautentikasi */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    const supabase = createServerClient(url, anonKey, {
      cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
    });
    const { data } = await supabase.auth.getClaims();
    return data?.claims?.sub ?? null;
  } catch {
    return null;
  }
}

/** Wajib login untuk endpoint manajemen token */
async function requireAuth(request: NextRequest): Promise<string | NextResponse> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  }
  return userId;
}

/** DELETE /api/signing/token/[id] */
export async function DELETE(request: NextRequest, context: Context) {
  const correlationId = generateCorrelationId();
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    await revokeToken(id, correlationId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Gagal mencabut token.");
  }
}

/** POST /api/signing/token/[id]/rotate → rotate token */
export async function POST(request: NextRequest, context: Context) {
  const correlationId = generateCorrelationId();
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    // Ambil data token lama
    const { data: token, error } = await createAdminClient()
      .from("external_signing_token")
      .select("nomor_surat, pihak, scopes, document_version")
      .eq("id", id)
      .maybeSingle();

    if (error || !token) {
      return NextResponse.json({ error: "Token tidak ditemukan." }, { status: 404 });
    }

    const t = token as { nomor_surat: string; pihak: string; scopes: string[]; document_version: number };

    // Cabut token lama
    await revokeToken(id, correlationId);

    // Dapatkan versi dan digest dokumen saat ini
    const { version, digest } = await getCurrentDocumentVersion(t.nomor_surat);

    // Terbitkan token baru
    const result = await issueSigningToken({
      nomor: t.nomor_surat,
      pihak: t.pihak as import("@/types/token").PihakTtd,
      scopes: t.scopes as import("@/types/token").TokenScope[],
      createdBy: auth,
      documentVersion: version,
      documentDigest: digest,
    });

    const baseUrl = process.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const signingUrl = `${baseUrl}/sign/exchange?t=${result.rawToken}`;

    return NextResponse.json({
      tokenId: result.tokenId,
      expiresAt: result.expiresAt.toISOString(),
      documentVersion: version,
      signingUrl,
    });
  } catch (error) {
    return apiError(error, "Gagal merotasi token.");
  }
}
