/**
 * ISSUE-30: Endpoint TTD berbasis sesi signing (eksternal, sekali pakai).
 *
 * POST /api/signing/ttd
 *
 * Flow:
 *   1. Baca cookie sesi signing
 *   2. Validasi sesi (atomik)
 *   3. Cek scope sign:ttd
 *   4. Cek idempotency key
 *   5. Verifikasi digest dokumen (TOCTOU protection)
 *   6. Validasi & decode gambar TTD (PNG, batas pixel, re-encode aman)
 *   7. Simpan TTD + buat PDF
 *   8. Simpan receipt idempotency
 *   9. Tandai sesi read_only (post-submit window 15 menit)
 *  10. Audit success
 *
 * Security:
 *   - Hanya sesi aktif dengan scope sign:ttd yang dapat submit
 *   - Digest dokumen diverifikasi sebelum commit (TOCTOU)
 *   - Validasi PNG: magic bytes + batas ukuran piksel (tidak hanya MIME)
 *   - Idempotency: retry aman sebelum token dikonsumsi
 *   - Response tidak mengekspos token
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import {
  getIdempotencyReceipt,
  saveIdempotencyReceipt,
  setSessionReadOnly,
  validateSigningSession,
  writeAudit,
  getCurrentDocumentVersion,
} from "@/lib/token-data";
import {
  generateCorrelationId,
  SIGNING_SESSION_COOKIE,
  verifyDocumentDigest,
} from "@/lib/token-utils";
import { findSurat, linkMap, listLinks, loadTtd, saveFile, saveTtd } from "@/lib/data";
import { buatPdf } from "@/lib/pdf";
import { assetsForCodes } from "@/lib/surat-service";
import type { PihakTtd } from "@/types/token";
import { decodeAndSanitizeSignature } from "@/lib/signature-image";

export const runtime = "nodejs";
const PUBLIC_ERROR = "Sesi tidak valid atau sudah berakhir.";

const ttdSessionSchema = z.object({
  ttd: z.string()
    .startsWith("data:image/png;base64,", "Tanda tangan harus berupa PNG.")
    .max(1_500_000, "Ukuran tanda tangan terlalu besar."),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  nama: z.string().trim().max(200).optional(), // untuk pihak HRD: isi nama
  consent: z.literal(true).refine((v) => v === true, { message: "Consent diperlukan sebelum menandatangani." }),
});

export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId();
  let auditSessionId: string | undefined;

  // 1. Baca cookie sesi
  const sessionSecret = request.cookies.get(SIGNING_SESSION_COOKIE)?.value;
  if (!sessionSecret) {
    return NextResponse.json(
      { error: PUBLIC_ERROR },
      { status: 401 },
    );
  }

  try {
    // 2. Validasi sesi
    const session = await validateSigningSession(sessionSecret, correlationId);
    const sessionId = session.session_id;
    auditSessionId = sessionId;
    if (!session.valid || !session.nomor_surat || !session.pihak) {
      return NextResponse.json(
        { error: PUBLIC_ERROR },
        { status: 401 },
      );
    }

    // 3. Cek scope
    if (!session.scopes?.includes("sign:ttd")) {
      return NextResponse.json({ error: PUBLIC_ERROR }, { status: 403 });
    }

    // 4. Cek idempotency
    let body: z.infer<typeof ttdSessionSchema>;
    try {
      body = ttdSessionSchema.parse(await request.json());
    } catch (e) {
      if (e instanceof z.ZodError) {
        return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
      }
      throw e;
    }

    {
      const receipt = await getIdempotencyReceipt(body.idempotencyKey);
      if (receipt) {
        // Replay deterministik: kembalikan response yang sama
        return NextResponse.json(receipt.responseSnapshot);
      }
    }

    // 5. Verifikasi digest dokumen (TOCTOU protection)
    const { digest: currentDigest, version: currentVersion } = await getCurrentDocumentVersion(session.nomor_surat);

    if (!verifyDocumentDigest(currentDigest, session.document_digest!)) {
      await writeAudit({
        event: "digest.mismatch",
        nomor: session.nomor_surat,
        pihak: session.pihak as PihakTtd,
        outcome: "failure",
        correlationId,
        sessionId,
        documentVersion: session.document_version ?? undefined,
        documentDigest: session.document_digest ?? undefined,
        actor: null,
        actorType: "external_signer",
        metadata: { current_digest: currentDigest },
      });

      return NextResponse.json(
        { error: PUBLIC_ERROR }, { status: 403 },
      );
    }

    // 6. Validasi dan decode PNG TTD
    let ttdBuffer: Buffer;
    try { ttdBuffer = await decodeAndSanitizeSignature(body.ttd); }
    catch { return NextResponse.json({ error: "Gambar tanda tangan tidak valid." }, { status: 400 }); }

    // 7. Simpan TTD + buat PDF
    const nomor = session.nomor_surat;
    const pihak = session.pihak as PihakTtd;

    const surat = await findSurat(nomor);
    if (!surat) {
      return NextResponse.json({ error: PUBLIC_ERROR }, { status: 403 });
    }

    // Identitas yang memengaruhi PDF tidak boleh dimutasi oleh signer setelah digest diverifikasi.
    if (pihak === "hrd" && body.nama && body.nama !== surat.namaHrd) {
      return NextResponse.json({ error: "Identitas penandatangan tidak cocok dengan dokumen." }, { status: 409 });
    }

    // Simpan TTD (hanya pihak ini)
    await saveTtd(nomor, { [pihak]: ttdBuffer });

    // Muat ulang semua TTD dan aset untuk PDF
    const stored = await loadTtd(nomor);
    surat.ttd = stored;
    surat.aset = await assetsForCodes(linkMap(await listLinks())[nomor] ?? []);

    // Buat PDF
    const pdf = await buatPdf(surat);
    await saveFile(pdf.namaFile, pdf.buffer, "application/pdf");

    // Audit PDF generated
    await writeAudit({
      event: "pdf.generated",
      nomor,
      pihak,
      outcome: "success",
      correlationId,
      sessionId,
      documentVersion: session.document_version ?? undefined,
      documentDigest: session.document_digest ?? undefined,
      actor: null,
      actorType: "external_signer",
    });

    // Siapkan response snapshot (untuk idempotency receipt)
    const responseSnapshot = {
      ok: true,
      pihak,
      nomor,
      documentVersion: session.document_version,
      pdf: pdf.namaFile,
    };

    // 8. Simpan receipt idempotency
    {
      await saveIdempotencyReceipt({
        idempotencyKey: body.idempotencyKey,
        sessionId,
        nomor,
        pihak,
        outcome: "success",
        responseSnapshot,
        documentVersion: session.document_version ?? currentVersion,
        documentDigest: session.document_digest ?? currentDigest,
      });
    }

    // 9. Tandai sesi read_only
    await setSessionReadOnly(sessionId);

    // 10. Audit TTD berhasil
    await writeAudit({
      event: "ttd.submitted",
      nomor,
      pihak,
      outcome: "success",
      correlationId,
      sessionId,
      documentVersion: session.document_version ?? undefined,
      documentDigest: session.document_digest ?? undefined,
      actor: null,
      actorType: "external_signer",
    });

    const response = NextResponse.json(responseSnapshot);
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  } catch (error) {
    await writeAudit({
      event: "ttd.submitted",
      nomor: null,
      pihak: null,
      outcome: "failure",
      correlationId,
      sessionId: auditSessionId,
      actor: null,
      actorType: "external_signer",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return apiError(error, PUBLIC_ERROR, 403);
  }
}
