/**
 * ISSUE-30: Context endpoint untuk halaman signing.
 *
 * GET /api/signing/context
 *
 * Dikonsumsi oleh halaman /sign/session untuk menampilkan data dokumen
 * yang akan ditandatangani, sesuai sesi dan scope.
 *
 * Security:
 *   - Hanya bisa diakses dengan cookie signing session yang valid
 *   - Digest dokumen diverifikasi: jika tidak cocok → sesi tidak valid
 *   - Respons tidak mengandung raw token
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { validateSigningSession, writeAudit } from "@/lib/token-data";
import {
  generateCorrelationId,
  SIGNING_SESSION_COOKIE,
  verifyDocumentDigest,
} from "@/lib/token-utils";
import { detailedSurat } from "@/lib/surat-service";
import { getCurrentDocumentVersion } from "@/lib/token-data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const correlationId = generateCorrelationId();

  // Baca session ID dari cookie
  const sessionId = request.cookies.get(SIGNING_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Sesi tidak ditemukan. Gunakan link yang dikirimkan." }, { status: 401 });
  }

  try {
    // Validasi sesi (atomik, perbarui idle timeout)
    const session = await validateSigningSession(sessionId, correlationId);

    if (!session.valid || !session.nomor_surat || !session.pihak) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau sudah berakhir." },
        { status: 401 },
      );
    }

    if (!session.scopes?.includes("read:context")) {
      return NextResponse.json({ error: "Sesi tidak valid atau sudah berakhir." }, { status: 403 });
    }

    // Verifikasi digest dokumen: pastikan dokumen belum berubah sejak token diterbitkan
    const { digest: currentDigest } = await getCurrentDocumentVersion(session.nomor_surat);

    if (!verifyDocumentDigest(currentDigest, session.document_digest!)) {
      await writeAudit({
        event: "digest.mismatch",
        nomor: session.nomor_surat,
        pihak: session.pihak,
        outcome: "failure",
        correlationId,
        sessionId,
        documentVersion: session.document_version ?? undefined,
        documentDigest: session.document_digest ?? undefined,
        actor: null,
        actorType: "system",
        metadata: { current_digest: currentDigest },
      });

      return NextResponse.json(
        { error: "Sesi tidak valid atau sudah berakhir." }, { status: 403 },
      );
    }

    // Ambil data dokumen
    const surat = await detailedSurat(session.nomor_surat);
    if (!surat) {
      return NextResponse.json({ error: "Sesi tidak valid atau sudah berakhir." }, { status: 403 });
    }

    // Kembalikan context (hanya field yang dibutuhkan UI, sesuai scope)
    const response = NextResponse.json({
      context: {
        nomor: session.nomor_surat,
        pihak: session.pihak,
        scopes: session.scopes,
        documentVersion: session.document_version,
        documentDigest: session.document_digest,
        sessionExpiresAt: session.expires_at,
        idleExpiresAt: session.idle_expires_at,
        sessionState: session.state,
      },
      surat: {
        nomor: surat.nomor,
        tanggal: surat.tanggal,
        kategori: surat.kategori,
        nama: surat.nama,
        departemen: surat.departemen,
        penerima: surat.penerima,
        departemenPenerima: surat.departemenPenerima,
        keterangan: surat.keterangan,
        namaHrd: surat.namaHrd,
        aset: surat.aset,
        // TTD sudah ada ditampilkan sebagai status, bukan data image penuh
        ttdStatus: Object.fromEntries(
          Object.entries(surat.ttd ?? {}).map(([k, v]) => [k, Boolean(v)]),
        ),
      },
    });

    // Security headers
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none';",
    );
    response.headers.set("Referrer-Policy", "no-referrer");

    return response;
  } catch (error) {
    return apiError(error, "Gagal memuat konteks tanda tangan.");
  }
}
