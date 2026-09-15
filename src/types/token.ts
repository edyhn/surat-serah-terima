/**
 * ISSUE-30: Tipe data untuk sistem signed token sekali pakai,
 * sesi signing aman, dan pengikatan digest dokumen.
 */

/** State machine token */
export type TokenState = "active" | "exchanged" | "expired" | "revoked" | "completed";

/** State machine sesi signing */
export type SessionState = "active" | "read_only" | "expired" | "revoked";

/** Scope yang diizinkan oleh token */
export type TokenScope = "sign:ttd" | "read:context" | "read:qr" | "read:pdf";

/** Pihak penandatangan */
export type PihakTtd = "menyerahkan" | "menerima" | "hrd";

/**
 * Baris tabel external_signing_token di Supabase.
 * - token_hash: SHA-256 hex dari raw token (256-bit CSPRNG)
 * - document_version: nomor versi snapshot dokumen saat token diterbitkan
 * - document_digest: SHA-256 hex dari canonical JSON dokumen saat diterbitkan
 */
export interface SigningTokenRow {
  id: string;
  token_hash: string;
  nomor_surat: string;
  pihak: PihakTtd;
  scopes: TokenScope[];
  document_version: number;
  document_digest: string;
  state: TokenState;
  expires_at: string; // ISO 8601 UTC
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
  idempotency_key: string | null;
}

/**
 * Baris tabel signing_session di Supabase.
 * - digest saat sesi dibuat harus cocok dengan token_digest saat submit.
 */
export interface SigningSessionRow {
  id: string;
  token_id: string;
  nomor_surat: string;
  pihak: PihakTtd;
  scopes: TokenScope[];
  document_version: number;
  document_digest: string;
  state: SessionState;
  expires_at: string; // absolute TTL
  idle_expires_at: string; // idle timeout
  read_only_until: string | null; // post-submit read-only window
  created_at: string;
  last_activity_at: string;
}

/**
 * Receipt idempotency — disimpan setelah submit TTD berhasil.
 */
export interface IdempotencyReceiptRow {
  id: string;
  idempotency_key: string;
  session_id: string;
  nomor_surat: string;
  pihak: PihakTtd;
  outcome: "success" | "failed";
  response_snapshot: string; // JSON string, disimpan untuk replay deterministik
  document_version: number;
  document_digest: string;
  created_at: string;
  retain_until: string; // 5 tahun dari created_at
}

/**
 * Baris tabel audit_log — append-only, dilindungi dari update/delete.
 */
export interface AuditLogRow {
  id: string;
  event: AuditEvent;
  actor: string | null; // null = anonim/eksternal
  actor_type: "internal_user" | "external_signer" | "system";
  nomor_surat: string | null;
  token_id: string | null;
  session_id: string | null;
  pihak: PihakTtd | null;
  outcome: "success" | "failure" | "warning";
  correlation_id: string;
  document_version: number | null;
  document_digest: string | null;
  metadata: Record<string, unknown>;
  server_timestamp: string; // UTC, set by DB
  retain_until: string; // 12 bulan minimum
}

export type AuditEvent =
  | "token.issued"
  | "token.exchanged"
  | "token.expired"
  | "token.revoked"
  | "token.completed"
  | "token.replay_rejected"
  | "session.created"
  | "session.expired"
  | "session.revoked"
  | "session.read_only"
  | "ttd.submitted"
  | "ttd.replay_idempotent"
  | "digest.mismatch"
  | "document.version_bumped"
  | "pdf.generated"
  | "cleanup.ran";

/** Hasil exchange token → sesi */
export interface ExchangeResult {
  sessionId: string;
  nomor: string;
  pihak: PihakTtd;
  scopes: TokenScope[];
  documentVersion: number;
  documentDigest: string;
  expiresAt: Date;
}

/** Context dokumen yang dikembalikan ke halaman signing */
export interface SigningContext {
  nomor: string;
  pihak: PihakTtd;
  scopes: TokenScope[];
  documentVersion: number;
  documentDigest: string;
  sessionExpiresAt: string;
  idleExpiresAt: string;
}
