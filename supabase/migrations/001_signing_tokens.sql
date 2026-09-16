/**
 * ISSUE-30: Migrasi Supabase untuk sistem signed token sekali pakai.
 *
 * Versi: 001_signing_tokens
 *
 * Tabel-tabel baru:
 *   - external_signing_token  (token sekali pakai)
 *   - signing_session         (sesi signing berumur pendek)
 *   - idempotency_receipt     (receipt idempotency untuk retry)
 *   - audit_log               (append-only, dilindungi dari update/delete)
 *
 * Juga menambahkan kolom document_version + document_digest ke tabel surat.
 *
 * Petunjuk eksekusi (Supabase SQL Editor — non-production dulu):
 *   1. Buka Supabase Dashboard → SQL Editor
 *   2. Tempel isi file ini lalu klik RUN
 *   3. Verifikasi tabel terbuat di Table Editor
 *   4. Jalankan rollback (bagian bawah) jika ada masalah
 */

-- ============================================================
-- MIGRATION UP
-- ============================================================

BEGIN;

-- ─── 1. Tambah kolom versi & digest ke tabel surat ───────────────────────────

ALTER TABLE surat
  ADD COLUMN IF NOT EXISTS document_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS document_digest  TEXT    NOT NULL DEFAULT '';

-- Constraint: digest harus berupa SHA-256 hex (64 char) atau string kosong (untuk baris lama)
ALTER TABLE surat
  ADD CONSTRAINT surat_digest_format
    CHECK (document_digest = '' OR document_digest ~ '^[0-9a-f]{64}$');

-- ─── 2. Tabel: external_signing_token ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_signing_token (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash       TEXT        NOT NULL UNIQUE, -- SHA-256 hex dari raw token
  nomor_surat      TEXT        NOT NULL REFERENCES surat(nomor) ON DELETE CASCADE,
  pihak            TEXT        NOT NULL CHECK (pihak IN ('menyerahkan','menerima','hrd')),
  scopes           TEXT[]      NOT NULL DEFAULT ARRAY['sign:ttd','read:context'],
  document_version INTEGER     NOT NULL,
  document_digest  TEXT        NOT NULL CHECK (document_digest ~ '^[0-9a-f]{64}$'),
  state            TEXT        NOT NULL DEFAULT 'active'
                               CHECK (state IN ('active','exchanged','expired','revoked','completed')),
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       TEXT,
  idempotency_key  TEXT        UNIQUE
);

-- Maksimal 1 token aktif per surat + pihak + document_version
-- (partial unique index: hanya berlaku untuk state = 'active')
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_active_unique
  ON external_signing_token (nomor_surat, pihak, document_version)
  WHERE state = 'active';

-- Index untuk lookup by hash (exchange endpoint)
CREATE INDEX IF NOT EXISTS idx_token_hash ON external_signing_token (token_hash);

-- Index untuk cleanup job (query expired tokens)
CREATE INDEX IF NOT EXISTS idx_token_expires ON external_signing_token (expires_at)
  WHERE state = 'active';

-- ─── 3. Tabel: signing_session ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS signing_session (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id          UUID        NOT NULL REFERENCES external_signing_token(id) ON DELETE CASCADE,
  nomor_surat       TEXT        NOT NULL REFERENCES surat(nomor) ON DELETE CASCADE,
  pihak             TEXT        NOT NULL CHECK (pihak IN ('menyerahkan','menerima','hrd')),
  scopes            TEXT[]      NOT NULL DEFAULT ARRAY['sign:ttd','read:context'],
  document_version  INTEGER     NOT NULL,
  document_digest   TEXT        NOT NULL CHECK (document_digest ~ '^[0-9a-f]{64}$'),
  state             TEXT        NOT NULL DEFAULT 'active'
                                CHECK (state IN ('active','read_only','expired','revoked')),
  expires_at        TIMESTAMPTZ NOT NULL, -- absolute TTL (30 menit dari created_at)
  idle_expires_at   TIMESTAMPTZ NOT NULL, -- idle timeout (10 menit, diperbarui saat aktivitas)
  read_only_until   TIMESTAMPTZ,          -- post-submit read-only window (15 menit)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maksimal 1 sesi aktif per token (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_token_active
  ON signing_session (token_id)
  WHERE state = 'active';

-- Index untuk cleanup
CREATE INDEX IF NOT EXISTS idx_session_expires ON signing_session (expires_at)
  WHERE state IN ('active','read_only');

-- ─── 4. Tabel: idempotency_receipt ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idempotency_receipt (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   TEXT        NOT NULL UNIQUE,
  session_id        UUID        NOT NULL REFERENCES signing_session(id) ON DELETE SET NULL,
  nomor_surat       TEXT        NOT NULL,
  pihak             TEXT        NOT NULL CHECK (pihak IN ('menyerahkan','menerima','hrd')),
  outcome           TEXT        NOT NULL CHECK (outcome IN ('success','failed')),
  response_snapshot TEXT        NOT NULL, -- JSON snapshot response untuk replay deterministik
  document_version  INTEGER     NOT NULL,
  document_digest   TEXT        NOT NULL CHECK (document_digest ~ '^[0-9a-f]{64}$'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retain_until      TIMESTAMPTZ NOT NULL -- 5 tahun dari created_at
);

-- Index untuk cleanup receipt
CREATE INDEX IF NOT EXISTS idx_receipt_retain ON idempotency_receipt (retain_until);

-- ─── 5. Tabel: audit_log (append-only) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event            TEXT        NOT NULL,
  actor            TEXT,
  actor_type       TEXT        NOT NULL CHECK (actor_type IN ('internal_user','external_signer','system')),
  nomor_surat      TEXT,
  token_id         UUID,
  session_id       UUID,
  pihak            TEXT        CHECK (pihak IN ('menyerahkan','menerima','hrd')),
  outcome          TEXT        NOT NULL CHECK (outcome IN ('success','failure','warning')),
  correlation_id   TEXT        NOT NULL,
  document_version INTEGER,
  document_digest  TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retain_until     TIMESTAMPTZ NOT NULL
);

-- Index untuk query audit per surat
CREATE INDEX IF NOT EXISTS idx_audit_nomor ON audit_log (nomor_surat, server_timestamp DESC);

-- Index untuk cleanup
CREATE INDEX IF NOT EXISTS idx_audit_retain ON audit_log (retain_until);

-- ─── 6. RLS: deny-by-default untuk akses client anonim ───────────────────────

-- Aktifkan RLS pada semua tabel baru
ALTER TABLE external_signing_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_session        ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_receipt    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- Deny semua akses dari anon role (API publik menggunakan service-role server-side)
CREATE POLICY deny_anon_token   ON external_signing_token FOR ALL TO anon USING (false);
CREATE POLICY deny_anon_session ON signing_session        FOR ALL TO anon USING (false);
CREATE POLICY deny_anon_receipt ON idempotency_receipt    FOR ALL TO anon USING (false);
CREATE POLICY deny_anon_audit   ON audit_log              FOR ALL TO anon USING (false);

-- ─── 7. Proteksi audit_log: larang update/delete oleh authenticated (non-service) ──

-- Authenticated user hanya boleh SELECT audit milik surat yang mereka buat
-- (Kebijakan baca audit disesuaikan dengan aplikasi)
CREATE POLICY audit_readonly_auth ON audit_log FOR SELECT TO authenticated USING (true);
-- Blok update dan delete dari semua role kecuali service_role
CREATE POLICY audit_no_update ON audit_log FOR UPDATE TO authenticated USING (false);
CREATE POLICY audit_no_delete ON audit_log FOR DELETE TO authenticated USING (false);

-- ─── 8. RPC: exchange_token (atomik, mencegah race condition) ─────────────────

-- Fungsi server-side untuk atomically exchange token → buat sesi
-- Dipanggil oleh server-side API (bukan client langsung)
CREATE OR REPLACE FUNCTION exchange_signing_token(
  p_token_hash     TEXT,
  p_correlation_id TEXT
)
RETURNS TABLE (
  session_id       UUID,
  nomor_surat      TEXT,
  pihak            TEXT,
  scopes           TEXT[],
  document_version INTEGER,
  document_digest  TEXT,
  expires_at       TIMESTAMPTZ,
  idle_expires_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token  external_signing_token%ROWTYPE;
  v_sess   signing_session%ROWTYPE;
  v_now    TIMESTAMPTZ := NOW();
  v_abs    TIMESTAMPTZ := v_now + INTERVAL '30 minutes';
  v_idle   TIMESTAMPTZ := v_now + INTERVAL '10 minutes';
BEGIN
  -- Lock token row untuk mencegah concurrent exchange
  SELECT * INTO v_token
  FROM external_signing_token
  WHERE token_hash = p_token_hash
    AND state = 'active'
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- Token tidak ada, sudah dipakai, expired, atau sedang di-exchange concurrently
    RAISE EXCEPTION 'TOKEN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- Periksa expiry
  IF v_token.expires_at < v_now THEN
    -- Tandai expired
    UPDATE external_signing_token
    SET state = 'expired'
    WHERE id = v_token.id;

    INSERT INTO audit_log (event, token_id, nomor_surat, pihak, outcome, correlation_id, document_version, document_digest, actor_type, retain_until)
    VALUES ('token.expired', v_token.id, v_token.nomor_surat, v_token.pihak, 'failure', p_correlation_id, v_token.document_version, v_token.document_digest, 'system', v_now + INTERVAL '12 months');

    RAISE EXCEPTION 'TOKEN_EXPIRED' USING ERRCODE = 'P0002';
  END IF;

  -- Tandai token sebagai exchanged (sekali pakai)
  UPDATE external_signing_token
  SET state = 'exchanged', used_at = v_now
  WHERE id = v_token.id;

  -- Buat sesi signing baru
  INSERT INTO signing_session (
    token_id, nomor_surat, pihak, scopes, document_version, document_digest,
    state, expires_at, idle_expires_at
  )
  VALUES (
    v_token.id, v_token.nomor_surat, v_token.pihak, v_token.scopes,
    v_token.document_version, v_token.document_digest,
    'active', v_abs, v_idle
  )
  RETURNING * INTO v_sess;

  -- Tulis audit event
  INSERT INTO audit_log (event, token_id, session_id, nomor_surat, pihak, outcome, correlation_id, document_version, document_digest, actor_type, retain_until)
  VALUES ('token.exchanged', v_token.id, v_sess.id, v_token.nomor_surat, v_token.pihak, 'success', p_correlation_id, v_token.document_version, v_token.document_digest, 'external_signer', v_now + INTERVAL '12 months');

  INSERT INTO audit_log (event, token_id, session_id, nomor_surat, pihak, outcome, correlation_id, document_version, document_digest, actor_type, retain_until)
  VALUES ('session.created', v_token.id, v_sess.id, v_token.nomor_surat, v_token.pihak, 'success', p_correlation_id, v_token.document_version, v_token.document_digest, 'external_signer', v_now + INTERVAL '12 months');

  RETURN QUERY SELECT v_sess.id, v_sess.nomor_surat, v_sess.pihak, v_sess.scopes,
    v_sess.document_version, v_sess.document_digest, v_sess.expires_at, v_sess.idle_expires_at;
END;
$$;

-- ─── 9. RPC: validate_session (atomik, update idle_expires_at) ───────────────

CREATE OR REPLACE FUNCTION validate_signing_session(
  p_session_id     UUID,
  p_correlation_id TEXT
)
RETURNS TABLE (
  valid            BOOLEAN,
  state            TEXT,
  nomor_surat      TEXT,
  pihak            TEXT,
  scopes           TEXT[],
  document_version INTEGER,
  document_digest  TEXT,
  expires_at       TIMESTAMPTZ,
  idle_expires_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sess signing_session%ROWTYPE;
  v_now  TIMESTAMPTZ := NOW();
  v_new_idle TIMESTAMPTZ := v_now + INTERVAL '10 minutes';
BEGIN
  SELECT * INTO v_sess FROM signing_session WHERE id = p_session_id FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found'::TEXT, NULL, NULL, NULL::TEXT[], NULL, NULL, NULL, NULL;
    RETURN;
  END IF;

  -- Cek absolute expiry
  IF v_sess.expires_at < v_now THEN
    UPDATE signing_session SET state = 'expired' WHERE id = p_session_id;
    INSERT INTO audit_log (event, session_id, nomor_surat, pihak, outcome, correlation_id, actor_type, retain_until)
    VALUES ('session.expired', p_session_id, v_sess.nomor_surat, v_sess.pihak, 'failure', p_correlation_id, 'system', v_now + INTERVAL '12 months');
    RETURN QUERY SELECT false, 'expired'::TEXT, v_sess.nomor_surat, v_sess.pihak, v_sess.scopes,
      v_sess.document_version, v_sess.document_digest, v_sess.expires_at, v_sess.idle_expires_at;
    RETURN;
  END IF;

  -- Cek idle timeout
  IF v_sess.idle_expires_at < v_now AND v_sess.state = 'active' THEN
    UPDATE signing_session SET state = 'expired' WHERE id = p_session_id;
    INSERT INTO audit_log (event, session_id, nomor_surat, pihak, outcome, correlation_id, actor_type, retain_until)
    VALUES ('session.expired', p_session_id, v_sess.nomor_surat, v_sess.pihak, 'failure', p_correlation_id, 'system', v_now + INTERVAL '12 months');
    RETURN QUERY SELECT false, 'idle_expired'::TEXT, v_sess.nomor_surat, v_sess.pihak, v_sess.scopes,
      v_sess.document_version, v_sess.document_digest, v_sess.expires_at, v_sess.idle_expires_at;
    RETURN;
  END IF;

  -- Sesi valid: perbarui idle timeout
  IF v_sess.state = 'active' THEN
    UPDATE signing_session
    SET idle_expires_at = v_new_idle, last_activity_at = v_now
    WHERE id = p_session_id;
  END IF;

  RETURN QUERY SELECT true, v_sess.state, v_sess.nomor_surat, v_sess.pihak, v_sess.scopes,
    v_sess.document_version, v_sess.document_digest, v_sess.expires_at,
    CASE WHEN v_sess.state = 'active' THEN v_new_idle ELSE v_sess.idle_expires_at END;
END;
$$;

-- ─── 10. RPC: cleanup_expired (idempotent, aman dijalankan berulang) ──────────

CREATE OR REPLACE FUNCTION cleanup_expired_tokens_and_sessions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now       TIMESTAMPTZ := NOW();
  v_tokens    INTEGER := 0;
  v_sessions  INTEGER := 0;
  v_receipts  INTEGER := 0;
  v_audit     INTEGER := 0;
BEGIN
  -- Tandai token expired (tombstone 30 hari — jangan delete, hanya state change)
  UPDATE external_signing_token
  SET state = 'expired'
  WHERE state = 'active' AND expires_at < v_now;
  GET DIAGNOSTICS v_tokens = ROW_COUNT;

  -- Tandai sesi expired
  UPDATE signing_session
  SET state = 'expired'
  WHERE state IN ('active','read_only')
    AND (expires_at < v_now OR (state = 'active' AND idle_expires_at < v_now));
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  -- Hapus idempotency receipt yang melewati retain_until (24 jam pending, 5 tahun evidence)
  -- receipt dipertahankan sesuai retain_until yang sudah di-set saat insert
  DELETE FROM idempotency_receipt WHERE retain_until < v_now;
  GET DIAGNOSTICS v_receipts = ROW_COUNT;

  -- Hapus audit log yang melewati retain_until (12 bulan minimum, 5 tahun untuk evidence)
  DELETE FROM audit_log WHERE retain_until < v_now;
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  INSERT INTO audit_log (event, outcome, correlation_id, actor_type, metadata, retain_until)
  VALUES (
    'cleanup.ran', 'success', gen_random_uuid()::TEXT, 'system',
    jsonb_build_object('tokens_expired', v_tokens, 'sessions_expired', v_sessions,
                       'receipts_deleted', v_receipts, 'audit_deleted', v_audit),
    v_now + INTERVAL '12 months'
  );

  RETURN jsonb_build_object(
    'tokens_expired', v_tokens,
    'sessions_expired', v_sessions,
    'receipts_deleted', v_receipts,
    'audit_deleted', v_audit,
    'ran_at', v_now
  );
END;
$$;

COMMIT;

-- ============================================================
-- MIGRATION DOWN (rollback)
-- ============================================================
-- Jalankan HANYA jika rollback diperlukan pada non-production:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS cleanup_expired_tokens_and_sessions();
-- DROP FUNCTION IF EXISTS validate_signing_session(UUID, TEXT);
-- DROP FUNCTION IF EXISTS exchange_signing_token(TEXT, TEXT);
-- DROP TABLE IF EXISTS audit_log CASCADE;
-- DROP TABLE IF EXISTS idempotency_receipt CASCADE;
-- DROP TABLE IF EXISTS signing_session CASCADE;
-- DROP TABLE IF EXISTS external_signing_token CASCADE;
-- ALTER TABLE surat DROP COLUMN IF EXISTS document_version;
-- ALTER TABLE surat DROP COLUMN IF EXISTS document_digest;
-- COMMIT;
