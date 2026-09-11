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

type Context = { params: Promise<{ id: string }> };

/** DELETE /api/signing/token/[id] */
export async function DELETE(request: NextRequest, context: Context) {
  const correlationId = generateCorrelationId();
  try {
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
      createdBy: userId,
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
