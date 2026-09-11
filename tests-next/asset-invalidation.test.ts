import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/004_asset_document_invalidation.sql", "utf8");

describe("ISSUE-35 asset/document invalidation contract", () => {
  it("maps every PDF-visible asset field into the database digest", () => {
    expect(migration).toContain("a.kode,a.nama,a.nilai::text,a.kondisi");
    expect(migration).not.toMatch(/concat_ws\([^)]*a\.status/);
  });

  it("locks linked documents deterministically before mutation", () => {
    expect(migration).toContain("array_agg(s.nomor ORDER BY s.nomor)");
    expect(migration).toContain("ORDER BY nomor FOR UPDATE");
  });

  it("revokes both old capabilities and bumps every affected document", () => {
    expect(migration).toContain("external_signing_token SET state='revoked'");
    expect(migration).toContain("signing_session SET state='revoked'");
    expect(migration).toContain("document_version=document_version+1");
    expect(migration).toContain("FOREACH v_nomor IN ARRAY v_docs");
  });

  it("keeps mutation, relationship update, audit, and invalidation in one RPC transaction", () => {
    expect(migration.trimStart()).toMatch(/^-- ISSUE-35/);
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("COMMIT;");
    expect(migration).toContain("INSERT INTO audit_log");
    expect(migration).toContain("UPDATE surat_aset SET kode_aset=v_new.kode");
  });
});
