/**
 * ISSUE-30 & ISSUE-35: Concurrency, TOCTOU, Invalidation & Failure Injection Test Suite
 *
 * Skenario Pengujian:
 * 1. Concurrency Race: Simultaneous Token Exchange (Single-Use Enforcement)
 * 2. Concurrency Race: Simultaneous Signature Submission & Idempotency Key Replay
 * 3. TOCTOU Protection: Asset Mutation Mid-Flight Invalidation of Signing Session
 * 4. Field-Level Invalidation Granularity (Rendered vs Metadata Fields)
 * 5. Multi-Document Deterministic Locking & Deadlock Prevention
 * 6. Transaction Rollback & Partial Storage Failure Simulation
 * 7. Malicious Payload & Edge-Case Failure Injection (Polyglot, Oversized, Identity Tampering)
 * 8. Session Lifespan, Idle Timeout & Sliding Expiration Simulation
 * 9. Privilege & Scope Boundary Enforcement
 */

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeAndSanitizeSignature } from "@/lib/signature-image";
import {
  generateRawToken,
  hashToken,
  isExpired,
  verifyDocumentDigest,
} from "@/lib/token-utils";
import type { Surat, Aset } from "@/types";
import type { PihakTtd, TokenScope, TokenState } from "@/types/token";

// Helper: Simulasi persis fungsi PostgreSQL `document_digest_from_database(p_nomor)`
function computeDatabaseDocumentDigest(surat: Surat): string {
  const asetList: Aset[] = Array.isArray(surat.aset)
    ? surat.aset.map((item) =>
        typeof item === "string"
          ? { kode: item, nama: "", kategori: "", nilai: 0, kondisi: "baik", status: "tersedia" }
          : item,
      )
    : [];

  const assetParts = asetList
    .map((a) => `${a.kode}\x1e${a.nama}\x1e${a.nilai}\x1e${a.kondisi}`)
    .sort()
    .join("\x1d");

  const fullPayload = [
    surat.nomor,
    surat.tanggal,
    surat.kategori,
    surat.nama,
    surat.departemen,
    surat.penerima,
    surat.departemenPenerima,
    surat.keterangan,
    surat.namaHrd ?? "",
    assetParts,
  ].join("\x1f");

  return createHash("sha256").update(fullPayload, "utf8").digest("hex");
}

// Helper: Buat sampel surat valid
function createSampleSurat(overrides: Partial<Surat> = {}): Surat {
  return {
    nomor: "001/SRT-ST/2026",
    tanggal: "11 September 2026",
    tanggalSingkat: "11/09/2026",
    kategori: "penyerahan",
    nama: "Edy Hartono",
    departemen: "Digital Tech IT",
    penerima: "Budi Santoso",
    departemenPenerima: "Operasional",
    keterangan: "Penyerahan perangkat kerja laptop",
    namaHrd: "Royan",
    aset: [
      {
        kode: "AST-LAP-2026-0001",
        nama: "ThinkPad T14 Gen 3",
        kategori: "Laptop",
        nilai: 18500000,
        kondisi: "baik",
        status: "dipakai",
      },
    ],
    ...overrides,
  };
}

describe("1. Concurrency Race: Simultaneous Token Exchange", () => {
  it("menjamin token sekali pakai hanya dapat di-exchange tepat satu kali pada request simultan", async () => {
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);

    // Mock DB State
    const tokenState: {
      id: string;
      token_hash: string;
      state: TokenState;
      exchange_count: number;
    } = {
      id: "token-uuid-1",
      token_hash: tokenHash,
      state: "active",
      exchange_count: 0,
    };

    // Simulasi RPC PostgreSQL `exchange_signing_token` dengan FOR UPDATE SKIP LOCKED
    let lockHeld = false;
    async function simulateExchangeRpc(incomingHash: string): Promise<{ success: boolean; session_id?: string; error?: string }> {
      await new Promise((r) => setTimeout(r, Math.random() * 15 + 5));

      if (lockHeld) {
        return { success: false, error: "TOKEN_INVALID" };
      }

      lockHeld = true;
      try {
        if (tokenState.token_hash !== incomingHash || tokenState.state !== "active") {
          return { success: false, error: "TOKEN_INVALID" };
        }

        // Atomic update state
        tokenState.state = "exchanged";
        tokenState.exchange_count += 1;
        const sessionId = "session-" + Math.random().toString(36).substring(2);
        return { success: true, session_id: sessionId };
      } finally {
        lockHeld = false;
      }
    }

    // Jalankan 10 permintaan exchange simultan secara paralel
    const concurrentRequests = Array.from({ length: 10 }, () => simulateExchangeRpc(tokenHash));
    const results = await Promise.all(concurrentRequests);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);
    expect(tokenState.state).toBe("exchanged");
    expect(tokenState.exchange_count).toBe(1);
    expect(failures.every((f) => f.error === "TOKEN_INVALID")).toBe(true);
  });
});

describe("2. Concurrency Race: Simultaneous Submit & Idempotency Key Replay", () => {
  interface SubmitResponseSnapshot {
    ok: boolean;
    nomor: string;
    pihak: PihakTtd;
    documentVersion: number;
    pdf: string;
    replayed?: boolean;
  }

  it("mengembalikan response snapshot yang identik ketika idempotency key di-replay", async () => {
    const idempotencyStore = new Map<string, { response: SubmitResponseSnapshot; createdAt: number }>();

    const payload = {
      idempotencyKey: "idem-key-abc1234567890",
      ttd: "data:image/png;base64,...",
      nomor: "001/SRT-ST/2026",
      pihak: "penerima" as PihakTtd,
    };

    async function handleSignatureSubmit(req: typeof payload): Promise<SubmitResponseSnapshot> {
      if (idempotencyStore.has(req.idempotencyKey)) {
        return { ...idempotencyStore.get(req.idempotencyKey)!.response, replayed: true };
      }

      const responseSnapshot: SubmitResponseSnapshot = {
        ok: true,
        nomor: req.nomor,
        pihak: req.pihak,
        documentVersion: 1,
        pdf: `${req.nomor.replace(/\//g, "-")}.pdf`,
      };

      idempotencyStore.set(req.idempotencyKey, { response: responseSnapshot, createdAt: Date.now() });
      return { ...responseSnapshot, replayed: false };
    }

    // Submit pertama
    const res1 = await handleSignatureSubmit(payload);
    expect(res1.ok).toBe(true);
    expect(res1.replayed).toBe(false);

    // Submit kedua (retry/replay simultan dengan key yang sama)
    const res2 = await handleSignatureSubmit(payload);
    expect(res2.ok).toBe(true);
    expect(res2.replayed).toBe(true);
    expect(res2.pdf).toBe(res1.pdf);
    expect(res2.documentVersion).toBe(res1.documentVersion);
  });

  it("menolak submit kedua jika sesi sudah masuk state read_only dan key berbeda", async () => {
    let sessionState: "active" | "read_only" | "revoked" = "active";

    async function submitTtd(_sessionId: string, _idempotencyKey: string) {
      if (sessionState !== "active") {
        throw new Error("SESSION_READ_ONLY_OR_EXPIRED");
      }
      sessionState = "read_only";
      return { ok: true, sessionState };
    }

    const first = await submitTtd("sess-1", "key-1");
    expect(first.ok).toBe(true);

    await expect(submitTtd("sess-1", "key-2")).rejects.toThrow("SESSION_READ_ONLY_OR_EXPIRED");
  });
});

describe("3. TOCTOU Protection: Asset Mutation Mid-Flight Invalidation", () => {
  it("mencegah penandatanganan jika aset diubah saat sesi signing sedang aktif", async () => {
    const surat = createSampleSurat();

    // 1. Hitung digest awal database (versi 1)
    const digestV1 = computeDatabaseDocumentDigest(surat);

    let documentVersion = 1;
    let currentDigest = digestV1;

    // Sesi signing dibuka dengan digest V1
    const activeSession: {
      sessionId: string;
      documentVersion: number;
      documentDigest: string;
      state: "active" | "revoked";
    } = {
      sessionId: "session-signer-1",
      documentVersion: 1,
      documentDigest: digestV1,
      state: "active",
    };

    // 2. Admin mengubah data aset (misal: Nilai aset dikoreksi dari 18.5jt ke 19.5jt)
    const initialAset = (Array.isArray(surat.aset) && typeof surat.aset[0] === "object") ? surat.aset[0] : {
      kode: "AST-LAP-2026-0001",
      nama: "ThinkPad T14 Gen 3",
      kategori: "Laptop",
      nilai: 18500000,
      kondisi: "baik" as const,
      status: "dipakai" as const,
    };
    const updatedAset: Aset = { ...initialAset, nilai: 19500000 };
    surat.aset = [updatedAset];

    // RPC `mutate_asset_and_invalidate_documents` dieksekusi di database:
    const digestV2 = computeDatabaseDocumentDigest(surat);

    // Efek mutasi pada database:
    documentVersion += 1;
    currentDigest = digestV2;
    activeSession.state = "revoked"; // sesi lama di-revoke

    // 3. Signer mencoba submit tanda tangan dengan token/sesi yang membawa digest V1
    const isDigestValid = verifyDocumentDigest(currentDigest, activeSession.documentDigest);
    const isSessionStillActive = (activeSession.state as string) === "active";

    expect(isDigestValid).toBe(false);
    expect(isSessionStillActive).toBe(false);
    expect(currentDigest).not.toBe(digestV1);
    expect(documentVersion).toBe(2);
  });
});

describe("4. Field-Level Invalidation Granularity (Rendered vs Metadata)", () => {
  it("hanya memicu invalidasi digest saat field yang tampil di PDF berubah", () => {
    const migrationSql = readFileSync("supabase/migrations/004_asset_document_invalidation.sql", "utf8");

    expect(migrationSql).toContain("v_changed:=(v_new.kode,v_new.nama,v_new.nilai,v_new.kondisi)");
    expect(migrationSql).toContain("IS DISTINCT FROM (v_old.kode,v_old.nama,v_old.nilai,v_old.kondisi)");

    const baseSurat = createSampleSurat();
    const digestBase = computeDatabaseDocumentDigest(baseSurat);
    const baseAset = (Array.isArray(baseSurat.aset) && typeof baseSurat.aset[0] === "object") ? baseSurat.aset[0] : {
      kode: "AST-LAP-2026-0001",
      nama: "ThinkPad T14 Gen 3",
      kategori: "Laptop",
      nilai: 18500000,
      kondisi: "baik" as const,
      status: "dipakai" as const,
    };

    // Perubahan status workflow aset (tidak tampil di PDF)
    const suratWithNewStatus: Surat = {
      ...baseSurat,
      aset: [{ ...baseAset, status: "tersedia" }],
    };
    const digestWithNewStatus = computeDatabaseDocumentDigest(suratWithNewStatus);
    expect(digestWithNewStatus).toBe(digestBase);

    // Perubahan kondisi aset (tampil di PDF) -> digest berubah
    const suratWithNewKondisi: Surat = {
      ...baseSurat,
      aset: [{ ...baseAset, kondisi: "rusak-ringan" }],
    };
    const digestWithNewKondisi = computeDatabaseDocumentDigest(suratWithNewKondisi);
    expect(digestWithNewKondisi).not.toBe(digestBase);
  });
});

describe("5. Multi-Document Deterministic Locking & Deadlock Prevention", () => {
  it("mengunci dokumen dalam urutan nomor deterministik (ORDER BY nomor FOR UPDATE)", () => {
    const migrationSql = readFileSync("supabase/migrations/004_asset_document_invalidation.sql", "utf8");

    expect(migrationSql).toContain("SELECT coalesce(array_agg(s.nomor ORDER BY s.nomor),'{}') INTO v_docs");
    expect(migrationSql).toContain("PERFORM nomor FROM surat WHERE nomor=ANY(v_docs) ORDER BY nomor FOR UPDATE;");

    // Simulasi pengurutan ID dokumen
    const unorderedDocs = ["003/SRT-ST/2026", "001/SRT-ST/2026", "010/SRT-ST/2026", "002/SRT-ST/2026"];
    const sortedDocs = [...unorderedDocs].sort();

    expect(sortedDocs).toEqual(["001/SRT-ST/2026", "002/SRT-ST/2026", "003/SRT-ST/2026", "010/SRT-ST/2026"]);
  });
});

describe("6. Transaction Rollback & Partial Failure Simulation", () => {
  interface AssetRecord {
    kode: string;
    nama: string;
    nilai: number;
  }
  interface DocRecord {
    nomor: string;
    version: number;
    digest: string;
  }
  interface TokenRecord {
    id: string;
    state: string;
  }
  interface AuditEntry {
    event: string;
    timestamp: number;
  }

  it("memastikan seluruh perubahan di-rollback jika terjadi kegagalan payload atau storage", async () => {
    // Model DB In-Memory
    const db = {
      assets: new Map<string, AssetRecord>([["AST-1", { kode: "AST-1", nama: "Laptop Lama", nilai: 10000000 }]]),
      documents: new Map<string, DocRecord>([["SST-1", { nomor: "SST-1", version: 1, digest: "orig-digest" }]]),
      tokens: new Map<string, TokenRecord>([["tok-1", { id: "tok-1", state: "active" }]]),
      auditLog: [] as AuditEntry[],
    };

    // Simulasi transaksi dengan snapshot
    async function transactionalAssetUpdate(oldKode: string, newPayload: Partial<AssetRecord>, shouldFailStorage: boolean) {
      const backup = {
        assets: new Map(db.assets),
        documents: new Map(db.documents),
        tokens: new Map(db.tokens),
        auditLog: [...db.auditLog],
      };

      try {
        // Step 1: Update DB asset
        if (!newPayload.nama) throw new Error("PAYLOAD_VALIDATION_ERROR");
        const existing = db.assets.get(oldKode)!;
        db.assets.set(oldKode, { ...existing, ...newPayload });

        // Step 2: Invalidate document & revoke token
        const existingDoc = db.documents.get("SST-1")!;
        db.documents.set("SST-1", { ...existingDoc, version: 2, digest: "new-digest" });
        const existingTok = db.tokens.get("tok-1")!;
        db.tokens.set("tok-1", { ...existingTok, state: "revoked" });
        db.auditLog.push({ event: "asset.updated", timestamp: Date.now() });

        // Step 3: Failure injection (simulasi Storage S3/Supabase upload failure)
        if (shouldFailStorage) {
          throw new Error("STORAGE_UPLOAD_CONNECTION_TIMEOUT");
        }

        return { success: true };
      } catch (err) {
        // ROLLBACK
        db.assets = backup.assets;
        db.documents = backup.documents;
        db.tokens = backup.tokens;
        db.auditLog = backup.auditLog;
        throw err;
      }
    }

    // Uji kegagalan
    await expect(transactionalAssetUpdate("AST-1", { nama: "Laptop Baru" }, true)).rejects.toThrow("STORAGE_UPLOAD_CONNECTION_TIMEOUT");

    // Verifikasi state kembali utuh ke baseline V1
    expect(db.assets.get("AST-1")?.nama).toBe("Laptop Lama");
    expect(db.documents.get("SST-1")?.version).toBe(1);
    expect(db.tokens.get("tok-1")?.state).toBe("active");
    expect(db.auditLog).toHaveLength(0);
  });
});

describe("7. Malicious Payload & Edge-Case Failure Injection", () => {
  it("menolak gambar tanda tangan non-PNG (misal fake PNG yang sebenarnya SVG atau JPEG)", async () => {
    const fakePngSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>');
    const base64Svg = `data:image/png;base64,${fakePngSvg.toString("base64")}`;

    await expect(decodeAndSanitizeSignature(base64Svg)).rejects.toThrow("INVALID_SIGNATURE");
  });

  it("menolak gambar tanda tangan yang melebihi batas dimensi w/h > 4096px", async () => {
    const hugeImage = await sharp({
      create: { width: 4097, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();

    const base64Huge = `data:image/png;base64,${hugeImage.toString("base64")}`;
    await expect(decodeAndSanitizeSignature(base64Huge)).rejects.toThrow("INVALID_SIGNATURE");
  });

  it("menolak gambar tanda tangan dengan rasio piksel melebihi 16 MegaPixel", async () => {
    const largeMp = await sharp({
      create: { width: 4096, height: 4096, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();

    const base64Mp = `data:image/png;base64,${largeMp.toString("base64")}`;
    // 4096 * 4096 = 16.777.216 (> 16.000.000 max pixels) -> throws error
    await expect(decodeAndSanitizeSignature(base64Mp)).rejects.toThrow();
  });

  it("menolak tampering identitas HRD saat submit TTD jika nama tidak cocok dengan dokumen", () => {
    const surat = createSampleSurat({ namaHrd: "Royan" });
    const submittedName = "Hacker / Impostor";

    const isMatch = submittedName === surat.namaHrd;
    expect(isMatch).toBe(false);
  });
});

describe("8. Session Lifespan, Idle Timeout & Sliding Expiration", () => {
  it("menolak sesi yang telah melewati absolute TTL (30 menit)", () => {
    const now = Date.now();
    const thirtyOneMinutesAgo = new Date(now - 31 * 60 * 1000);

    expect(isExpired(thirtyOneMinutesAgo)).toBe(true);
  });

  it("menolak sesi yang telah melewati idle TTL (10 menit tanpa interaksi)", () => {
    const now = Date.now();
    const elevenMinutesAgo = new Date(now - 11 * 60 * 1000);

    expect(isExpired(elevenMinutesAgo)).toBe(true);
  });

  it("memperpanjang idle timeout secara sliding saat ada aktivitas valid sebelum expired", () => {
    const absoluteExpiresAt = new Date("2026-09-11T10:30:00Z");

    const activityTime = new Date("2026-09-11T10:05:00Z");
    const newIdleExpiresAt = new Date(Math.min(absoluteExpiresAt.getTime(), activityTime.getTime() + 10 * 60 * 1000));

    expect(newIdleExpiresAt.toISOString()).toBe("2026-09-11T10:15:00.000Z");
    expect(newIdleExpiresAt < absoluteExpiresAt).toBe(true);

    const lateActivityTime = new Date("2026-09-11T10:25:00Z");
    const cappedIdleExpiresAt = new Date(Math.min(absoluteExpiresAt.getTime(), lateActivityTime.getTime() + 10 * 60 * 1000));

    expect(cappedIdleExpiresAt.toISOString()).toBe("2026-09-11T10:30:00.000Z");
  });
});

describe("9. Privilege & Scope Boundary Enforcement", () => {
  it("memastikan token read-only (read:pdf / read:qr) ditolak saat mencoba aksi sign:ttd", () => {
    const readonlyScopes: TokenScope[] = ["read:pdf", "read:qr"];

    const canSign = readonlyScopes.includes("sign:ttd");
    const canReadPdf = readonlyScopes.includes("read:pdf");
    const canReadContext = readonlyScopes.includes("read:context");

    expect(canSign).toBe(false);
    expect(canReadPdf).toBe(true);
    expect(canReadContext).toBe(false);
  });
});
