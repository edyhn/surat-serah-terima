/**
 * ISSUE-30: Data layer untuk operasi token & sesi signing.
 *
 * Semua operasi menggunakan admin client (service-role) — tidak ada interaksi
 * langsung dengan anon key. Raw token TIDAK PERNAH disimpan atau di-log.
 */

import { createAdminClient } from "@/lib/supabase-admin";
import {
  computeDocumentDigest,
  expiresIn,
  generateCorrelationId,
  generateRawToken,
  hashToken,
  SESSION_READONLY_MS,
  TOKEN_TTL_MS,
  utcNow,
} from "@/lib/token-utils";
import type { PihakTtd, SigningTokenRow, TokenScope, TokenState } from "@/types/token";
import type { Surat } from "@/types";

// ─── Document Version & Digest ────────────────────────────────────────────────

/**
 * Hitung current digest dokumen dari data surat + aset.
 */
export function digestFromSurat(surat: Surat, asetKodes: string[]): string {
  return computeDocumentDigest({
    nomor: surat.nomor,
    tanggal: surat.tanggal,
    kategori: surat.kategori,
    nama: surat.nama,
    departemen: surat.departemen,
    penerima: surat.penerima,
    departemenPenerima: surat.departemenPenerima,
    keterangan: surat.keterangan,
    namaHrd: surat.namaHrd ?? "",
    asetKodes,
  });
}

/**
 * Update document_version dan document_digest pada tabel surat.
 * Dipanggil setiap kali dokumen berubah (edit, tambah aset, dst).
 * Sekaligus mencabut semua token aktif untuk versi lama.
 */
export async function bumpDocumentVersion(
  nomor: string,
  digest: string,
  correlationId: string = generateCorrelationId(),
): Promise<{ version: number; digest: string }> {
  const db = createAdminClient();

  // Atomik: increment version, set digest baru
  const { data, error } = await db
    .from("surat")
    .update({
      document_version: db.rpc("document_version + 1" as never) as never, // raw SQL increment via RPC
      document_digest: digest,
    })
    .eq("nomor", nomor)
    .select("document_version, document_digest")
    .single();

  // Fallback: jika RPC expression tidak didukung, gunakan read-then-write
  if (error || !data) {
    const { data: current } = await db
      .from("surat")
      .select("document_version")
      .eq("nomor", nomor)
      .single();

    const newVersion = ((current as { document_version?: number })?.document_version ?? 0) + 1;

    const { data: updated, error: updateError } = await db
      .from("surat")
      .update({ document_version: newVersion, document_digest: digest })
      .eq("nomor", nomor)
      .select("document_version, document_digest")
      .single();

    if (updateError) throw updateError;
    if (!updated) throw new Error("Gagal update versi dokumen.");

    // Cabut semua token aktif versi lama
    await revokeAllActiveTokens(nomor, correlationId);

    return {
      version: (updated as { document_version: number }).document_version,
      digest: (updated as { document_digest: string }).document_digest,
    };
  }

  // Cabut semua token aktif versi lama
  await revokeAllActiveTokens(nomor, correlationId);

  return {
    version: (data as { document_version: number }).document_version,
    digest: (data as { document_digest: string }).document_digest,
  };
}

/**
 * Dapatkan versi dan digest dokumen saat ini.
 */
export async function getCurrentDocumentVersion(
  nomor: string,
): Promise<{ version: number; digest: string }> {
  const { data, error } = await createAdminClient()
    .from("surat")
    .select("document_version, document_digest")
    .eq("nomor", nomor)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Surat tidak ditemukan.");

  const row = data as { document_version: number; document_digest: string };
  return { version: row.document_version, digest: row.document_digest };
}

// ─── Token Issuance ───────────────────────────────────────────────────────────

export interface IssueTokenInput {
  nomor: string;
  pihak: PihakTtd;
  scopes?: TokenScope[];
  ttlMs?: number;
  createdBy?: string;
  idempotencyKey?: string;
  documentVersion: number;
  documentDigest: string;
}

export interface IssueTokenResult {
  rawToken: string; // sekali pakai — kirim ke penerima melalui QR/link
  tokenId: string;
  expiresAt: Date;
}

/**
 * Terbitkan token baru sekali pakai.
 *
 * Sebelum insert, cek apakah ada token aktif untuk kombinasi
 * nomor+pihak+document_version — jika ada, cabut dulu (rotate).
 */
export async function issueSigningToken(input: IssueTokenInput): Promise<IssueTokenResult> {
  const db = createAdminClient();
  const correlationId = generateCorrelationId();
  const ttl = input.ttlMs ?? TOKEN_TTL_MS;
  const expiresAt = expiresIn(ttl);
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  // Idempotency check
  if (input.idempotencyKey) {
    const { data: existing } = await db
      .from("external_signing_token")
      .select("id, state, expires_at")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existing) {
      // Kembalikan error — raw token tidak bisa di-replay karena tidak disimpan
      throw new Error("TOKEN_IDEMPOTENCY_CONFLICT: Token dengan kunci ini sudah pernah diterbitkan.");
    }
  }

  // Cabut token aktif sebelumnya untuk kombinasi ini (rotate)
  await revokeActiveTokenForPihak(input.nomor, input.pihak, input.documentVersion);

  // Insert token baru
  const { data, error } = await db
    .from("external_signing_token")
    .insert({
      token_hash: tokenHash,
      nomor_surat: input.nomor,
      pihak: input.pihak,
      scopes: input.scopes ?? ["sign:ttd", "read:context"],
      document_version: input.documentVersion,
      document_digest: input.documentDigest,
      state: "active",
      expires_at: expiresAt.toISOString(),
      created_by: input.createdBy ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Gagal menerbitkan token.");

  // Audit
  await writeAudit({
    event: "token.issued",
    tokenId: (data as { id: string }).id,
    nomor: input.nomor,
    pihak: input.pihak,
    outcome: "success",
    correlationId,
    documentVersion: input.documentVersion,
    documentDigest: input.documentDigest,
    actor: input.createdBy ?? null,
    actorType: "internal_user",
  });

  return {
    rawToken, // ← satu-satunya kali raw token dikembalikan
    tokenId: (data as { id: string }).id,
    expiresAt,
  };
}

// ─── Token Exchange (→ Sesi) ──────────────────────────────────────────────────

/**
 * Exchange raw token menjadi sesi signing.
 * Menggunakan RPC atomik di DB untuk mencegah race condition.
 *
 * @returns Data sesi yang baru dibuat
 * @throws Error jika token tidak valid, expired, atau sudah dipakai
 */
export async function exchangeToken(
  rawToken: string,
  correlationId: string = generateCorrelationId(),
) {
  const tokenHash = hashToken(rawToken);
  const db = createAdminClient();

  const { data, error } = await db.rpc("exchange_signing_token", {
    p_token_hash: tokenHash,
    p_correlation_id: correlationId,
  });

  if (error) {
    const code = error.code || error.message;
    if (code?.includes("TOKEN_EXPIRED")) throw new Error("TOKEN_EXPIRED");
    if (code?.includes("TOKEN_INVALID")) throw new Error("TOKEN_INVALID");
    throw error;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("TOKEN_INVALID");
  }

  return data[0] as {
    session_id: string;
    nomor_surat: string;
    pihak: PihakTtd;
    scopes: TokenScope[];
    document_version: number;
    document_digest: string;
    expires_at: string;
    idle_expires_at: string;
  };
}

// ─── Session Validation ───────────────────────────────────────────────────────

/**
 * Validasi sesi signing: cek state, TTL absolute & idle, perbarui idle timeout.
 * Menggunakan RPC atomik di DB.
 */
export async function validateSigningSession(
  sessionId: string,
  correlationId: string = generateCorrelationId(),
) {
  const db = createAdminClient();

  const { data, error } = await db.rpc("validate_signing_session", {
    p_session_id: sessionId,
    p_correlation_id: correlationId,
  });

  if (error) throw error;
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return data[0] as {
    valid: boolean;
    state: string;
    nomor_surat: string | null;
    pihak: PihakTtd | null;
    scopes: TokenScope[] | null;
    document_version: number | null;
    document_digest: string | null;
    expires_at: string | null;
    idle_expires_at: string | null;
  };
}

/**
 * Tandai sesi sebagai read_only setelah TTD berhasil disubmit.
 * Read-only window: 15 menit dari sekarang.
 */
export async function setSessionReadOnly(sessionId: string): Promise<void> {
  const readOnlyUntil = expiresIn(SESSION_READONLY_MS).toISOString();
  const { error } = await createAdminClient()
    .from("signing_session")
    .update({ state: "read_only", read_only_until: readOnlyUntil })
    .eq("id", sessionId)
    .eq("state", "active"); // hanya dari state active

  if (error) throw error;
}

// ─── Revocation ───────────────────────────────────────────────────────────────

/**
 * Cabut satu token berdasarkan ID. Juga mencabut sesi aktif terkait.
 */
export async function revokeToken(
  tokenId: string,
  correlationId: string = generateCorrelationId(),
): Promise<void> {
  const db = createAdminClient();
  const now = utcNow().toISOString();

  // Cabut token
  const { data: token, error: tokenError } = await db
    .from("external_signing_token")
    .update({ state: "revoked", revoked_at: now })
    .eq("id", tokenId)
    .in("state", ["active", "exchanged"])
    .select("nomor_surat, pihak, document_version, document_digest")
    .single();

  if (tokenError) throw tokenError;

  // Cabut sesi aktif terkait
  await db
    .from("signing_session")
    .update({ state: "revoked" })
    .eq("token_id", tokenId)
    .in("state", ["active", "read_only"]);

  if (token) {
    const t = token as { nomor_surat: string; pihak: PihakTtd; document_version: number; document_digest: string };
    await writeAudit({
      event: "token.revoked",
      tokenId,
      nomor: t.nomor_surat,
      pihak: t.pihak,
      outcome: "success",
      correlationId,
      documentVersion: t.document_version,
      documentDigest: t.document_digest,
      actor: null,
      actorType: "internal_user",
    });
  }
}

/**
 * Cabut semua token aktif untuk satu surat (semua pihak, semua versi).
 * Dipakai saat dokumen berubah versi atau pembatalan.
 */
export async function revokeAllActiveTokens(
  nomor: string,
  correlationId: string = generateCorrelationId(),
): Promise<number> {
  const db = createAdminClient();
  const now = utcNow().toISOString();

  const { data: tokens } = await db
    .from("external_signing_token")
    .update({ state: "revoked", revoked_at: now })
    .eq("nomor_surat", nomor)
    .eq("state", "active")
    .select("id, pihak, document_version, document_digest");

  if (!tokens) return 0;

  // Cabut sesi aktif terkait
  await db
    .from("signing_session")
    .update({ state: "revoked" })
    .in("token_id", (tokens as SigningTokenRow[]).map((t) => t.id))
    .in("state", ["active", "read_only"]);

  // Audit setiap token
  for (const token of tokens as SigningTokenRow[]) {
    await writeAudit({
      event: "token.revoked",
      tokenId: token.id,
      nomor,
      pihak: token.pihak,
      outcome: "success",
      correlationId,
      documentVersion: token.document_version,
      documentDigest: token.document_digest,
      actor: null,
      actorType: "system",
    });
  }

  await writeAudit({
    event: "document.version_bumped",
    nomor,
    pihak: null,
    outcome: "success",
    correlationId,
    actor: null,
    actorType: "system",
    metadata: { revoked_count: tokens.length },
  });

  return tokens.length;
}

/**
 * Cabut token aktif untuk pihak + versi tertentu (saat rotate).
 */
async function revokeActiveTokenForPihak(
  nomor: string,
  pihak: PihakTtd,
  documentVersion: number,
): Promise<void> {
  const db = createAdminClient();
  const now = utcNow().toISOString();

  const { data: existing } = await db
    .from("external_signing_token")
    .update({ state: "revoked", revoked_at: now })
    .eq("nomor_surat", nomor)
    .eq("pihak", pihak)
    .eq("document_version", documentVersion)
    .eq("state", "active")
    .select("id");

  if (existing && (existing as { id: string }[]).length > 0) {
    const ids = (existing as { id: string }[]).map((t) => t.id);
    await db
      .from("signing_session")
      .update({ state: "revoked" })
      .in("token_id", ids)
      .in("state", ["active", "read_only"]);
  }
}

// ─── Idempotency Receipt ──────────────────────────────────────────────────────

/**
 * Simpan receipt idempotency setelah submit TTD berhasil.
 * retain_until = 5 tahun dari sekarang (atau retensi legal lebih panjang).
 */
export async function saveIdempotencyReceipt(params: {
  idempotencyKey: string;
  sessionId: string;
  nomor: string;
  pihak: PihakTtd;
  outcome: "success" | "failed";
  responseSnapshot: unknown;
  documentVersion: number;
  documentDigest: string;
}): Promise<void> {
  const retainUntil = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await createAdminClient().from("idempotency_receipt").insert({
    idempotency_key: params.idempotencyKey,
    session_id: params.sessionId,
    nomor_surat: params.nomor,
    pihak: params.pihak,
    outcome: params.outcome,
    response_snapshot: JSON.stringify(params.responseSnapshot),
    document_version: params.documentVersion,
    document_digest: params.documentDigest,
    retain_until: retainUntil,
  });
  if (error && !error.message?.includes("duplicate")) throw error;
}

/**
 * Cek apakah receipt idempotency sudah ada. Jika ada, kembalikan
 * response snapshot untuk replay deterministik.
 */
export async function getIdempotencyReceipt(
  idempotencyKey: string,
): Promise<{ outcome: string; responseSnapshot: unknown } | null> {
  const { data } = await createAdminClient()
    .from("idempotency_receipt")
    .select("outcome, response_snapshot")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!data) return null;
  const row = data as { outcome: string; response_snapshot: string };
  return {
    outcome: row.outcome,
    responseSnapshot: JSON.parse(row.response_snapshot),
  };
}

// ─── Token Listing (Internal) ─────────────────────────────────────────────────

/**
 * List token untuk satu surat (untuk UI internal: buat, salin, cabut, rotasi link).
 */
export async function listTokensForSurat(nomor: string): Promise<
  Array<{
    id: string;
    pihak: PihakTtd;
    state: TokenState;
    scopes: TokenScope[];
    document_version: number;
    expires_at: string;
    created_at: string;
    created_by: string | null;
  }>
> {
  const { data, error } = await createAdminClient()
    .from("external_signing_token")
    .select("id, pihak, state, scopes, document_version, expires_at, created_at, created_by")
    .eq("nomor_surat", nomor)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    pihak: PihakTtd;
    state: TokenState;
    scopes: TokenScope[];
    document_version: number;
    expires_at: string;
    created_at: string;
    created_by: string | null;
  }>;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

interface AuditParams {
  event: import("@/types/token").AuditEvent;
  nomor: string | null;
  pihak: PihakTtd | null;
  outcome: "success" | "failure" | "warning";
  correlationId: string;
  actor: string | null;
  actorType: "internal_user" | "external_signer" | "system";
  tokenId?: string;
  sessionId?: string;
  documentVersion?: number;
  documentDigest?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(params: AuditParams): Promise<void> {
  const retainUntil = new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await createAdminClient().from("audit_log").insert({
    event: params.event,
    actor: params.actor,
    actor_type: params.actorType,
    nomor_surat: params.nomor,
    token_id: params.tokenId ?? null,
    session_id: params.sessionId ?? null,
    pihak: params.pihak,
    outcome: params.outcome,
    correlation_id: params.correlationId,
    document_version: params.documentVersion ?? null,
    document_digest: params.documentDigest ?? null,
    metadata: params.metadata ?? {},
    retain_until: retainUntil,
  });

  // Audit failure tidak boleh throw ke caller — log saja
  if (error) console.error("[audit] Gagal menulis audit log:", error.message);
}
