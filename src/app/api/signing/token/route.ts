/**
 * ISSUE-30: API internal untuk pengelolaan token signing.
 *
 * POST   /api/signing/token             → terbitkan token baru
 * GET    /api/signing/token?nomor=...   → list token untuk surat
 * DELETE /api/signing/token/[id]        → cabut token
 *
 * Endpoint ini HANYA dapat diakses oleh pengguna terautentikasi (Supabase session).
 * Middleware sudah menjamin ini, tapi endpoint juga validasi ulang session.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import {
  getCurrentDocumentVersion,
  issueSigningToken,
  listTokensForSurat,
} from "@/lib/token-data";
import { findSurat } from "@/lib/data";
import type { PihakTtd } from "@/types/token";
import { createServerClient } from "@supabase/ssr";

const issueSchema = z.object({
  nomor: z.string().trim().min(1),
  pihak: z.enum(["menyerahkan", "menerima", "hrd"]),
  scopes: z
    .array(z.enum(["sign:ttd", "read:context", "read:qr", "read:pdf"]))
    .min(1)
    .default(["sign:ttd", "read:context"]),
  ttlMs: z
    .number()
    .int()
    .min(15 * 60 * 1000)
    .max(72 * 60 * 60 * 1000)
    .optional(),
  idempotencyKey: z.string().max(128).optional(),
});

/** GET /api/signing/token?nomor=... */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
    }

    const nomor = request.nextUrl.searchParams.get("nomor");
    if (!nomor) return NextResponse.json({ error: "Parameter nomor diperlukan." }, { status: 400 });

    const tokens = await listTokensForSurat(nomor);
    return NextResponse.json({ tokens });
  } catch (error) {
    return apiError(error, "Gagal membaca daftar token.");
  }
}

/** POST /api/signing/token → issue token */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
    }

    const body = issueSchema.parse(await request.json());

    // Validasi surat ada
    const surat = await findSurat(body.nomor);
    if (!surat) {
      return NextResponse.json({ error: "Surat tidak ditemukan." }, { status: 404 });
    }

    // Dapatkan versi dan digest dokumen saat ini
    const { version, digest } = await getCurrentDocumentVersion(body.nomor);

    const result = await issueSigningToken({
      nomor: body.nomor,
      pihak: body.pihak as PihakTtd,
      scopes: body.scopes as import("@/types/token").TokenScope[],
      ttlMs: body.ttlMs,
      createdBy: userId,
      idempotencyKey: body.idempotencyKey,
      documentVersion: version,
      documentDigest: digest,
    });

    // Bangun URL signing (tanpa expose ke log)
    const baseUrl = process.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const signingUrl = `${baseUrl}/sign/exchange/${result.rawToken}`;

    return NextResponse.json({
      tokenId: result.tokenId,
      expiresAt: result.expiresAt.toISOString(),
      documentVersion: version,
      // signingUrl dikembalikan tapi TIDAK di-log server-side
      signingUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("IDEMPOTENCY_CONFLICT")) {
      return NextResponse.json(
        { error: "Token dengan idempotency key ini sudah ada." },
        { status: 409 },
      );
    }
    return apiError(error, "Gagal menerbitkan token.", 500);
  }
}

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
