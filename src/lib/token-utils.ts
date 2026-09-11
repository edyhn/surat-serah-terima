/**
 * ISSUE-30: Utilitas kriptografi untuk token sekali pakai.
 *
 * Semua primitive menggunakan Node.js built-in crypto — tidak ada library
 * pihak ketiga untuk operasi kriptografi inti.
 *
 * TTL defaults (dapat di-override oleh env):
 *   TOKEN_DEFAULT_TTL_MS   = 48 jam (range: 15 menit – 72 jam)
 *   SESSION_ABSOLUTE_MS    = 30 menit
 *   SESSION_IDLE_MS        = 10 menit
 *   SESSION_READONLY_MS    = 15 menit (post-submit)
 *   TOKEN_CLOCK_SKEW_MS    = 30 detik
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

// ─── TTL Configuration ────────────────────────────────────────────────────────

const MIN_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export const TOKEN_TTL_MS = Math.min(
  Math.max(
    parseInt(process.env.TOKEN_DEFAULT_TTL_MS ?? "") || DEFAULT_TOKEN_TTL_MS,
    MIN_TOKEN_TTL_MS,
  ),
  MAX_TOKEN_TTL_MS,
);

export const SESSION_ABSOLUTE_MS =
  parseInt(process.env.SESSION_ABSOLUTE_MS ?? "") || 30 * 60 * 1000;

export const SESSION_IDLE_MS =
  parseInt(process.env.SESSION_IDLE_MS ?? "") || 10 * 60 * 1000;

export const SESSION_READONLY_MS =
  parseInt(process.env.SESSION_READONLY_MS ?? "") || 15 * 60 * 1000;

/** Clock skew yang ditoleransi untuk validasi expiry */
export const CLOCK_SKEW_MS =
  parseInt(process.env.TOKEN_CLOCK_SKEW_MS ?? "") || 30 * 1000;

// ─── Token Generation ─────────────────────────────────────────────────────────

/**
 * Generate 256-bit (32 byte) cryptographically secure random token.
 * Dikembalikan dalam encoding URL-safe base64 (tidak mengandung +, /, =).
 */
export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hash raw token dengan SHA-256. Hash inilah yang disimpan di database,
 * bukan raw token. Raw token hanya dikirim sekali ke penerima melalui QR/link.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Verifikasi bahwa raw token cocok dengan stored hash.
 * Menggunakan timingSafeEqual untuk mencegah timing attack.
 */
export function verifyToken(rawToken: string, storedHash: string): boolean {
  try {
    const computedHash = hashToken(rawToken);
    const a = Buffer.from(computedHash, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Document Digest ──────────────────────────────────────────────────────────

/**
 * Buat canonical JSON deterministik dari field-field dokumen yang mempengaruhi
 * konten PDF/TTD. Field diurutkan secara leksikal untuk determinism.
 *
 * Canonical: sort object keys recursively, normalize strings, strip undefined.
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
    return "{" + pairs.join(",") + "}";
  }
  return JSON.stringify(value);
}

/**
 * Hitung document digest (SHA-256 hex) dari canonical JSON dokumen.
 * Field yang disertakan: semua field yang mempengaruhi isi PDF dan TTD.
 */
export function computeDocumentDigest(doc: {
  nomor: string;
  tanggal: string;
  kategori: string;
  nama: string;
  departemen: string;
  penerima: string;
  departemenPenerima: string;
  keterangan: string;
  namaHrd: string;
  asetKodes: string[];
}): string {
  const canonical = canonicalize({
    nomor: doc.nomor,
    tanggal: doc.tanggal,
    kategori: doc.kategori,
    nama: doc.nama,
    departemen: doc.departemen,
    penerima: doc.penerima,
    departemenPenerima: doc.departemenPenerima,
    keterangan: doc.keterangan,
    namaHrd: doc.namaHrd,
    // Aset diurutkan untuk determinism
    asetKodes: [...doc.asetKodes].sort(),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Verifikasi bahwa digest dokumen saat ini cocok dengan digest saat token/sesi dibuat.
 * Jika tidak cocok → dokumen telah berubah, submit harus ditolak.
 */
export function verifyDocumentDigest(currentDigest: string, expectedDigest: string): boolean {
  try {
    const a = Buffer.from(currentDigest, "hex");
    const b = Buffer.from(expectedDigest, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Time Utilities ────────────────────────────────────────────────────────────

/** Dapatkan waktu server UTC sekarang */
export function utcNow(): Date {
  return new Date();
}

/** Buat expiry Date sejumlah ms dari sekarang */
export function expiresIn(ms: number): Date {
  return new Date(Date.now() + ms);
}

/**
 * Cek apakah suatu expiry sudah lewat, dengan toleransi clock skew.
 * @param expiresAt ISO string atau Date
 */
export function isExpired(expiresAt: string | Date, skewMs = CLOCK_SKEW_MS): boolean {
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Date.now() > exp.getTime() + skewMs;
}

/**
 * Cek apakah TTL yang diminta valid (dalam range 15 menit – 72 jam).
 */
export function isValidTtlMs(ms: number): boolean {
  return ms >= MIN_TOKEN_TTL_MS && ms <= MAX_TOKEN_TTL_MS;
}

// ─── Session Cookie ───────────────────────────────────────────────────────────

/** Nama cookie sesi signing */
export const SIGNING_SESSION_COOKIE = "__signing_session";

/** Konfigurasi cookie sesi signing (nilai; options diset di route) */
export const SIGNING_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/sign",
};

// ─── Correlation ID ───────────────────────────────────────────────────────────

/** Generate correlation ID untuk request tracing */
export function generateCorrelationId(): string {
  return randomBytes(12).toString("hex");
}

// ─── Redaction ────────────────────────────────────────────────────────────────

/**
 * Redact raw token dari string (untuk logging aman).
 * Mengganti pola base64url 40+ karakter dengan [REDACTED].
 */
export function redactToken(text: string): string {
  return text.replace(/[A-Za-z0-9_-]{40,}/g, "[REDACTED]");
}

// ─── Validation ────────────────────────────────────────────────────────────────

/** Validasi bahwa string adalah hex SHA-256 (64 karakter hex) */
export function isValidSha256Hex(s: string): boolean {
  return /^[0-9a-f]{64}$/.test(s);
}

/** Validasi bahwa pihak adalah salah satu nilai yang valid */
export function isValidPihak(pihak: string): pihak is import("@/types/token").PihakTtd {
  return ["menyerahkan", "menerima", "hrd"].includes(pihak);
}
