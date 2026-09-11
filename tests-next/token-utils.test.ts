/**
 * ISSUE-30: Unit tests untuk token utilities.
 *
 * Test suite mencakup:
 * - generateRawToken: format, entropy, uniqueness
 * - hashToken + verifyToken: correctness, timing-safe, no false positive
 * - canonicalize + computeDocumentDigest: deterministic, key ordering, mutation detection
 * - verifyDocumentDigest: match/mismatch, timing-safe
 * - isExpired: clock skew, boundary
 * - redactToken: tidak bocorkan token di log
 * - generateCorrelationId: format
 */

import { describe, expect, it } from "vitest";
import {
  canonicalize,
  computeDocumentDigest,
  generateCorrelationId,
  generateRawToken,
  hashToken,
  isExpired,
  isValidPihak,
  isValidSha256Hex,
  isValidTtlMs,
  redactToken,
  verifyDocumentDigest,
  verifyToken,
} from "@/lib/token-utils";

// ─── generateRawToken ─────────────────────────────────────────────────────────

describe("generateRawToken", () => {
  it("menghasilkan string base64url yang valid", () => {
    const token = generateRawToken();
    expect(typeof token).toBe("string");
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("menghasilkan panjang ~43 karakter (256-bit base64url)", () => {
    const token = generateRawToken();
    // base64url dari 32 byte = 43 karakter (tanpa padding)
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token.length).toBeLessThanOrEqual(50);
  });

  it("setiap panggilan menghasilkan token yang berbeda", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateRawToken));
    expect(tokens.size).toBe(100);
  });
});

// ─── hashToken + verifyToken ──────────────────────────────────────────────────

describe("hashToken / verifyToken", () => {
  it("hashToken menghasilkan SHA-256 hex 64 karakter", () => {
    const hash = hashToken("token123");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("hash yang sama untuk input yang sama", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("hash berbeda untuk input berbeda", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("verifyToken berhasil jika token cocok", () => {
    const raw = generateRawToken();
    const hash = hashToken(raw);
    expect(verifyToken(raw, hash)).toBe(true);
  });

  it("verifyToken gagal jika token tidak cocok", () => {
    const raw1 = generateRawToken();
    const raw2 = generateRawToken();
    const hash = hashToken(raw1);
    expect(verifyToken(raw2, hash)).toBe(false);
  });

  it("verifyToken gagal untuk hash yang dimanipulasi", () => {
    const raw = generateRawToken();
    const hash = hashToken(raw);
    const tamperedHash = hash.slice(0, -1) + (hash.endsWith("0") ? "1" : "0");
    expect(verifyToken(raw, tamperedHash)).toBe(false);
  });

  it("verifyToken tidak throw untuk input tidak valid", () => {
    expect(() => verifyToken("", "invalid")).not.toThrow();
    expect(verifyToken("", "invalid")).toBe(false);
  });
});

// ─── canonicalize ─────────────────────────────────────────────────────────────

describe("canonicalize", () => {
  it("menghasilkan output deterministik untuk objek yang sama", () => {
    const obj = { b: 2, a: 1, c: [3, 1, 2] };
    expect(canonicalize(obj)).toBe(canonicalize(obj));
  });

  it("kunci objek diurutkan secara leksikal", () => {
    const a = { z: 1, a: 2 };
    const b = { a: 2, z: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("array tidak diurutkan (urutan dipertahankan)", () => {
    expect(canonicalize([3, 1, 2])).not.toBe(canonicalize([1, 2, 3]));
  });

  it("null dan undefined di-handle", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(undefined)).toBe("null");
  });

  it("boolean dan number di-handle", () => {
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(42)).toBe("42");
  });

  it("string di-escape dengan benar", () => {
    expect(canonicalize('hello "world"')).toBe('"hello \\"world\\""');
  });
});

// ─── computeDocumentDigest ────────────────────────────────────────────────────

const baseDoc = {
  nomor: "SST/2026/001",
  tanggal: "2026-09-11",
  kategori: "penyerahan",
  nama: "Budi Santoso",
  departemen: "IT",
  penerima: "Andi Wijaya",
  departemenPenerima: "Keuangan",
  keterangan: "Serah terima laptop",
  namaHrd: "Siti Rahayu",
  asetKodes: ["LAP-001", "LAP-002"],
};

describe("computeDocumentDigest", () => {
  it("menghasilkan SHA-256 hex 64 karakter", () => {
    const digest = computeDocumentDigest(baseDoc);
    expect(digest).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(digest)).toBe(true);
  });

  it("deterministik: input sama → digest sama", () => {
    expect(computeDocumentDigest(baseDoc)).toBe(computeDocumentDigest({ ...baseDoc }));
  });

  it("aset diurutkan: urutan berbeda → digest sama", () => {
    const a = computeDocumentDigest({ ...baseDoc, asetKodes: ["LAP-001", "LAP-002"] });
    const b = computeDocumentDigest({ ...baseDoc, asetKodes: ["LAP-002", "LAP-001"] });
    expect(a).toBe(b);
  });

  it("perubahan nama menghasilkan digest berbeda", () => {
    const a = computeDocumentDigest(baseDoc);
    const b = computeDocumentDigest({ ...baseDoc, nama: "Lain Orang" });
    expect(a).not.toBe(b);
  });

  it("perubahan aset menghasilkan digest berbeda", () => {
    const a = computeDocumentDigest(baseDoc);
    const b = computeDocumentDigest({ ...baseDoc, asetKodes: ["LAP-001"] });
    expect(a).not.toBe(b);
  });

  it("perubahan keterangan menghasilkan digest berbeda", () => {
    const a = computeDocumentDigest(baseDoc);
    const b = computeDocumentDigest({ ...baseDoc, keterangan: "Keterangan berbeda" });
    expect(a).not.toBe(b);
  });

  it("perubahan namaHrd menghasilkan digest berbeda", () => {
    const a = computeDocumentDigest(baseDoc);
    const b = computeDocumentDigest({ ...baseDoc, namaHrd: "HRD Baru" });
    expect(a).not.toBe(b);
  });

  it("dokumen kosong aset menghasilkan digest berbeda dari ada aset", () => {
    const a = computeDocumentDigest({ ...baseDoc, asetKodes: [] });
    const b = computeDocumentDigest({ ...baseDoc, asetKodes: ["LAP-001"] });
    expect(a).not.toBe(b);
  });
});

// ─── verifyDocumentDigest ─────────────────────────────────────────────────────

describe("verifyDocumentDigest", () => {
  it("digest yang sama → cocok", () => {
    const digest = computeDocumentDigest(baseDoc);
    expect(verifyDocumentDigest(digest, digest)).toBe(true);
  });

  it("digest berbeda → tidak cocok", () => {
    const d1 = computeDocumentDigest(baseDoc);
    const d2 = computeDocumentDigest({ ...baseDoc, nama: "Lain" });
    expect(verifyDocumentDigest(d1, d2)).toBe(false);
  });

  it("tidak throw untuk input tidak valid (panjang berbeda)", () => {
    expect(() => verifyDocumentDigest("abc", "defgh")).not.toThrow();
    // Panjang berbeda → false (bukan hex valid)
    expect(verifyDocumentDigest("abc", "defgh")).toBe(false);
  });

  it("tidak throw untuk hex yang bukan 64 karakter", () => {
    // 63 karakter vs 64 karakter → panjang berbeda setelah Buffer.from
    const shortHash = "a".repeat(62);
    const fullHash = hashToken("test");
    expect(() => verifyDocumentDigest(shortHash, fullHash)).not.toThrow();
    expect(verifyDocumentDigest(shortHash, fullHash)).toBe(false);
  });
});

// ─── isExpired ────────────────────────────────────────────────────────────────

describe("isExpired", () => {
  it("waktu di masa lalu → expired", () => {
    const past = new Date(Date.now() - 60000).toISOString();
    expect(isExpired(past, 0)).toBe(true);
  });

  it("waktu di masa depan → belum expired", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isExpired(future, 0)).toBe(false);
  });

  it("skew: sedikit lewat tapi dalam toleransi → belum expired", () => {
    // expired 10 detik lalu, tapi skew 30 detik → masih dianggap valid
    const slightlyPast = new Date(Date.now() - 10000).toISOString();
    expect(isExpired(slightlyPast, 30000)).toBe(false);
  });

  it("menerima Date object", () => {
    const future = new Date(Date.now() + 60000);
    expect(isExpired(future, 0)).toBe(false);
  });
});

// ─── redactToken ─────────────────────────────────────────────────────────────

describe("redactToken", () => {
  it("mengganti token base64url dengan [REDACTED]", () => {
    const token = generateRawToken(); // ~43 karakter base64url
    const log = `Memproses token ${token} untuk surat 001`;
    const redacted = redactToken(log);
    expect(redacted).not.toContain(token);
    expect(redacted).toContain("[REDACTED]");
  });

  it("tidak mengganti string pendek", () => {
    const log = "Nomor: SST123";
    expect(redactToken(log)).toBe(log);
  });

  it("mengganti multiple tokens", () => {
    const t1 = generateRawToken();
    const t2 = generateRawToken();
    const log = `t1=${t1} t2=${t2}`;
    const redacted = redactToken(log);
    expect(redacted).not.toContain(t1);
    expect(redacted).not.toContain(t2);
  });
});

// ─── isValidSha256Hex ─────────────────────────────────────────────────────────

describe("isValidSha256Hex", () => {
  it("valid: SHA-256 hex 64 karakter", () => {
    const hash = hashToken("test");
    expect(isValidSha256Hex(hash)).toBe(true);
  });

  it("tidak valid: kurang dari 64 karakter", () => {
    expect(isValidSha256Hex("abc123")).toBe(false);
  });

  it("tidak valid: mengandung karakter non-hex", () => {
    expect(isValidSha256Hex("g".repeat(64))).toBe(false);
  });

  it("tidak valid: uppercase", () => {
    const hash = hashToken("test").toUpperCase();
    expect(isValidSha256Hex(hash)).toBe(false);
  });
});

// ─── isValidPihak ─────────────────────────────────────────────────────────────

describe("isValidPihak", () => {
  it("menyerahkan valid", () => expect(isValidPihak("menyerahkan")).toBe(true));
  it("menerima valid", () => expect(isValidPihak("menerima")).toBe(true));
  it("hrd valid", () => expect(isValidPihak("hrd")).toBe(true));
  it("lainnya tidak valid", () => expect(isValidPihak("admin")).toBe(false));
  it("string kosong tidak valid", () => expect(isValidPihak("")).toBe(false));
});

// ─── isValidTtlMs ─────────────────────────────────────────────────────────────

describe("isValidTtlMs", () => {
  it("15 menit valid", () => expect(isValidTtlMs(15 * 60 * 1000)).toBe(true));
  it("48 jam valid", () => expect(isValidTtlMs(48 * 60 * 60 * 1000)).toBe(true));
  it("72 jam valid", () => expect(isValidTtlMs(72 * 60 * 60 * 1000)).toBe(true));
  it("14 menit tidak valid", () => expect(isValidTtlMs(14 * 60 * 1000)).toBe(false));
  it("73 jam tidak valid", () => expect(isValidTtlMs(73 * 60 * 60 * 1000)).toBe(false));
  it("0 tidak valid", () => expect(isValidTtlMs(0)).toBe(false));
  it("negatif tidak valid", () => expect(isValidTtlMs(-1000)).toBe(false));
});

// ─── generateCorrelationId ────────────────────────────────────────────────────

describe("generateCorrelationId", () => {
  it("menghasilkan string hex 24 karakter (12 byte)", () => {
    const id = generateCorrelationId();
    expect(id).toHaveLength(24);
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });

  it("setiap panggilan menghasilkan ID berbeda", () => {
    const ids = new Set(Array.from({ length: 100 }, generateCorrelationId));
    expect(ids.size).toBe(100);
  });
});
