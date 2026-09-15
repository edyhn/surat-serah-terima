-- ISSUE-35. Atomicity is limited to PostgreSQL; stored PDFs are regenerated separately.
BEGIN;

CREATE OR REPLACE FUNCTION document_digest_from_database(p_nomor TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT encode(digest(concat_ws(E'\x1f',s.nomor,s.tanggal::text,s.kategori,s.nama,
  s.departemen,s.penerima,s.departemen_penerima,s.keterangan,coalesce(s.nama_hrd,''),
  coalesce((SELECT string_agg(concat_ws(E'\x1e',a.kode,a.nama,a.nilai::text,a.kondisi),E'\x1d' ORDER BY a.kode)
   FROM surat_aset sa JOIN aset a ON a.kode=sa.kode_aset WHERE sa.nomor_surat=s.nomor),'')),
  'sha256'),'hex') FROM surat s WHERE s.nomor=p_nomor
$$;

CREATE OR REPLACE FUNCTION mutate_asset_and_invalidate_documents(
 p_old_kode TEXT,p_asset JSONB,p_delete BOOLEAN,p_correlation_id TEXT
) RETURNS TABLE(found BOOLEAN,asset JSONB,affected_documents INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old aset%ROWTYPE; v_new aset%ROWTYPE; v_nomor TEXT; v_digest TEXT;
 v_count INTEGER:=0; v_changed BOOLEAN; v_now TIMESTAMPTZ:=clock_timestamp(); v_docs TEXT[];
BEGIN
 SELECT * INTO v_old FROM aset WHERE kode=p_old_kode FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT false,NULL::JSONB,0; RETURN; END IF;
 SELECT coalesce(array_agg(s.nomor ORDER BY s.nomor),'{}') INTO v_docs
 FROM surat s JOIN surat_aset sa ON sa.nomor_surat=s.nomor WHERE sa.kode_aset=p_old_kode;
 PERFORM nomor FROM surat WHERE nomor=ANY(v_docs) ORDER BY nomor FOR UPDATE;
 IF p_delete THEN
  DELETE FROM surat_aset WHERE kode_aset=p_old_kode; DELETE FROM aset WHERE kode=p_old_kode; v_changed:=true;
 ELSE
  IF p_asset IS NULL THEN RAISE EXCEPTION 'ASSET_PAYLOAD_REQUIRED'; END IF;
  UPDATE aset SET kode=coalesce(nullif(p_asset->>'kode',''),v_old.kode),nama=p_asset->>'nama',
   kategori=coalesce(p_asset->>'kategori',''),nilai=(p_asset->>'nilai')::numeric,
   kondisi=p_asset->>'kondisi',status=p_asset->>'status',updated_at=v_now
  WHERE kode=p_old_kode RETURNING * INTO v_new;
  IF v_new.kode<>v_old.kode THEN UPDATE surat_aset SET kode_aset=v_new.kode WHERE kode_aset=p_old_kode; END IF;
  -- Only fields rendered by src/lib/pdf.ts invalidate. kategori/status are workflow metadata.
  v_changed:=(v_new.kode,v_new.nama,v_new.nilai,v_new.kondisi)
    IS DISTINCT FROM (v_old.kode,v_old.nama,v_old.nilai,v_old.kondisi);
 END IF;
 IF v_changed THEN FOREACH v_nomor IN ARRAY v_docs LOOP
  v_digest:=document_digest_from_database(v_nomor);
  UPDATE external_signing_token SET state='revoked',revoked_at=v_now
   WHERE nomor_surat=v_nomor AND state IN ('active','exchanged');
  UPDATE signing_session SET state='revoked' WHERE nomor_surat=v_nomor AND state IN ('active','read_only');
  UPDATE surat SET document_version=document_version+1,document_digest=v_digest WHERE nomor=v_nomor;
  INSERT INTO audit_log(event,nomor_surat,outcome,correlation_id,document_version,document_digest,actor_type,metadata,retain_until)
  SELECT 'document.version_bumped',v_nomor,'success',p_correlation_id,document_version,document_digest,'internal_user',
   jsonb_build_object('reason','asset_changed','asset_code',p_old_kode,'operation',CASE WHEN p_delete THEN 'delete' ELSE 'update' END),v_now+interval '12 months'
  FROM surat WHERE nomor=v_nomor;
  v_count:=v_count+1;
 END LOOP; END IF;
 RETURN QUERY SELECT true,CASE WHEN p_delete THEN NULL ELSE to_jsonb(v_new) END,v_count;
END $$;

REVOKE ALL ON FUNCTION document_digest_from_database(TEXT),mutate_asset_and_invalidate_documents(TEXT,JSONB,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION document_digest_from_database(TEXT),mutate_asset_and_invalidate_documents(TEXT,JSONB,BOOLEAN,TEXT) TO service_role;
COMMIT;
