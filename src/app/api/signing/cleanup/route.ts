/**
 * ISSUE-30: Cleanup job endpoint — idempotent, aman dijalankan tiap jam.
 *
 * POST /api/signing/cleanup
 *
 * Dipanggil oleh:
 *   - Cron job Vercel (vercel.json scheduler)
 *   - Manual oleh operator internal (dengan internal API key)
 *
 * Security:
 *   - Hanya boleh dipanggil oleh internal API key (SIGNING_CLEANUP_KEY env)
 *   - Idempotent: aman dijalankan berulang
 *   - Tombstone 30 hari: token hanya di-state-change, tidak dihapus dalam 30 hari
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateCorrelationId } from "@/lib/token-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Validasi internal API key
  const key = request.headers.get("x-cleanup-key");
  const expectedKey = process.env.SIGNING_CLEANUP_KEY;

  if (!expectedKey || !key || key !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const correlationId = generateCorrelationId();

  try {
    const { data, error } = await createAdminClient().rpc(
      "cleanup_expired_tokens_and_sessions",
    );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      result: data,
      correlationId,
    });
  } catch (error) {
    console.error("[cleanup] Gagal menjalankan cleanup:", error);
    return NextResponse.json({ error: "Cleanup gagal." }, { status: 500 });
  }
}
