-- ISSUE-30 hardening: the browser receives a 256-bit secret; only its SHA-256 hash is stored.
-- Apply to non-production after 001_signing_tokens.sql. Existing sessions are revoked intentionally.
BEGIN;

ALTER TABLE signing_session ADD COLUMN IF NOT EXISTS session_hash TEXT;
UPDATE signing_session
SET session_hash = encode(digest(gen_random_bytes(32), 'sha256'), 'hex'), state = 'revoked'
WHERE session_hash IS NULL;
ALTER TABLE signing_session ALTER COLUMN session_hash SET NOT NULL;
ALTER TABLE signing_session ADD CONSTRAINT signing_session_hash_format CHECK (session_hash ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS idx_signing_session_hash ON signing_session(session_hash);

CREATE OR REPLACE FUNCTION bump_document_version(p_nomor TEXT,p_digest TEXT,p_correlation_id TEXT)
RETURNS TABLE(document_version INTEGER,document_digest TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_surat surat%ROWTYPE; v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF p_digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INVALID_DIGEST'; END IF;
  SELECT * INTO v_surat FROM surat WHERE nomor=p_nomor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
  UPDATE external_signing_token SET state='revoked',revoked_at=v_now WHERE nomor_surat=p_nomor AND state IN ('active','exchanged');
  UPDATE signing_session SET state='revoked' WHERE nomor_surat=p_nomor AND state IN ('active','read_only');
  UPDATE surat SET document_version=v_surat.document_version+1,document_digest=p_digest WHERE nomor=p_nomor;
  INSERT INTO audit_log(event,nomor_surat,outcome,correlation_id,document_version,document_digest,actor_type,retain_until)
  VALUES('document.version_bumped',p_nomor,'success',p_correlation_id,v_surat.document_version+1,p_digest,'system',v_now+interval '12 months');
  RETURN QUERY SELECT v_surat.document_version+1,p_digest;
END $$;

DROP FUNCTION IF EXISTS exchange_signing_token(TEXT, TEXT);
CREATE OR REPLACE FUNCTION exchange_signing_token(
  p_token_hash TEXT, p_session_hash TEXT, p_correlation_id TEXT
)
RETURNS TABLE (
  session_id UUID, nomor_surat TEXT, pihak TEXT, scopes TEXT[], document_version INTEGER,
  document_digest TEXT, expires_at TIMESTAMPTZ, idle_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token external_signing_token%ROWTYPE;
  v_sess signing_session%ROWTYPE;
  v_doc surat%ROWTYPE;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_session_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'TOKEN_INVALID' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_token FROM external_signing_token
  WHERE token_hash=p_token_hash AND state='active' FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION 'TOKEN_INVALID' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_doc FROM surat WHERE nomor=v_token.nomor_surat FOR SHARE;
  IF v_token.expires_at<=v_now OR v_doc.document_version<>v_token.document_version OR v_doc.document_digest<>v_token.document_digest THEN
    UPDATE external_signing_token SET state=CASE WHEN expires_at<=v_now THEN 'expired' ELSE 'revoked' END, revoked_at=CASE WHEN expires_at>v_now THEN v_now ELSE revoked_at END WHERE id=v_token.id;
    RAISE EXCEPTION 'TOKEN_INVALID' USING ERRCODE='P0001';
  END IF;
  UPDATE external_signing_token SET state='exchanged',used_at=v_now WHERE id=v_token.id;
  INSERT INTO signing_session(token_id,session_hash,nomor_surat,pihak,scopes,document_version,document_digest,state,expires_at,idle_expires_at)
  VALUES(v_token.id,p_session_hash,v_token.nomor_surat,v_token.pihak,v_token.scopes,v_token.document_version,v_token.document_digest,'active',v_now+interval '30 minutes',v_now+interval '10 minutes')
  RETURNING * INTO v_sess;
  INSERT INTO audit_log(event,token_id,session_id,nomor_surat,pihak,outcome,correlation_id,document_version,document_digest,actor_type,retain_until)
  VALUES('token.exchanged',v_token.id,v_sess.id,v_token.nomor_surat,v_token.pihak,'success',p_correlation_id,v_token.document_version,v_token.document_digest,'external_signer',v_now+interval '12 months');
  RETURN QUERY SELECT v_sess.id,v_sess.nomor_surat,v_sess.pihak,v_sess.scopes,v_sess.document_version,v_sess.document_digest,v_sess.expires_at,v_sess.idle_expires_at;
END $$;

DROP FUNCTION IF EXISTS validate_signing_session(UUID, TEXT);
CREATE OR REPLACE FUNCTION validate_signing_session(p_session_hash TEXT,p_correlation_id TEXT)
RETURNS TABLE(session_id UUID,valid BOOLEAN,state TEXT,nomor_surat TEXT,pihak TEXT,scopes TEXT[],document_version INTEGER,document_digest TEXT,expires_at TIMESTAMPTZ,idle_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sess signing_session%ROWTYPE; v_doc surat%ROWTYPE; v_now TIMESTAMPTZ:=clock_timestamp(); v_idle TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_sess FROM signing_session WHERE session_hash=p_session_hash FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::UUID,false,'not_found'::TEXT,NULL::TEXT,NULL::TEXT,NULL::TEXT[],NULL::INTEGER,NULL::TEXT,NULL::TIMESTAMPTZ,NULL::TIMESTAMPTZ; RETURN; END IF;
  SELECT * INTO v_doc FROM surat WHERE nomor=v_sess.nomor_surat;
  IF v_sess.state NOT IN ('active','read_only') OR v_sess.expires_at<=v_now OR (v_sess.state='active' AND v_sess.idle_expires_at<=v_now) OR (v_sess.state='read_only' AND v_sess.read_only_until<=v_now) OR v_doc.document_version<>v_sess.document_version OR v_doc.document_digest<>v_sess.document_digest THEN
    UPDATE signing_session SET state=CASE WHEN state='revoked' THEN state ELSE 'expired' END WHERE id=v_sess.id;
    RETURN QUERY SELECT v_sess.id,false,'expired'::TEXT,v_sess.nomor_surat,v_sess.pihak,v_sess.scopes,v_sess.document_version,v_sess.document_digest,v_sess.expires_at,v_sess.idle_expires_at; RETURN;
  END IF;
  v_idle:=least(v_sess.expires_at,v_now+interval '10 minutes');
  IF v_sess.state='active' THEN UPDATE signing_session SET idle_expires_at=v_idle,last_activity_at=v_now WHERE id=v_sess.id; ELSE v_idle:=v_sess.idle_expires_at; END IF;
  RETURN QUERY SELECT v_sess.id,true,v_sess.state,v_sess.nomor_surat,v_sess.pihak,v_sess.scopes,v_sess.document_version,v_sess.document_digest,v_sess.expires_at,v_idle;
END $$;

REVOKE ALL ON FUNCTION bump_document_version(TEXT,TEXT,TEXT),exchange_signing_token(TEXT,TEXT,TEXT),validate_signing_session(TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bump_document_version(TEXT,TEXT,TEXT),exchange_signing_token(TEXT,TEXT,TEXT),validate_signing_session(TEXT,TEXT) TO service_role;
COMMIT;

-- Rollback: revoke active sessions, drop the two hardened functions, drop session_hash,
-- then restore the original functions from 001_signing_tokens.sql. Never roll back with active links.
