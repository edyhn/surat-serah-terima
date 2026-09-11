/**
 * ISSUE-30: Dokumentasi keamanan untuk sistem signed token.
 *
 * File ini mendokumentasikan:
 * - Arsitektur dan alur keamanan token sekali pakai
 * - TTL, revocation, dan state machine
 * - Retensi audit dan prosedur darurat
 * - Risiko residual dan keputusan penerimaan risiko
 */

# SECURITY-SIGNING.md

## Arsitektur Token Sekali Pakai

### Alur End-to-End

```
Internal User
    │
    ▼
POST /api/signing/token  (autentikasi Supabase wajib)
    │
    ├── generate 256-bit CSPRNG raw token
    ├── hash SHA-256 → simpan ke DB (bukan raw token)
    ├── buat signing URL: BASE_URL/sign/exchange/{rawToken}
    │
    ▼
QR Code / Link → Pihak Eksternal
    │
    ▼
/sign/exchange/{token}  (route handler tanpa UI sensitif)
    │
    ▼
GET /sign/exchange/{rawToken}
    │
    ├── hash rawToken → lookup by token_hash
    ├── validasi state = 'active' dan belum expired
    ├── atomik exchange: state → 'exchanged', used_at diisi
    ├── buat signing_session (state='active', TTL 30 menit, idle 10 menit)
    ├── set cookie HttpOnly; Secure; SameSite=Strict; Path=/sign
    ├── REDACT token dari semua log
    │
    ▼
Redirect 303 ke /sign/session  (URL bersih, tanpa token atau metadata surat)
    │
    ▼
GET /api/signing/context  (cookie wajib)
    │
    ├── validasi sesi (atomik, update idle_expires_at)
    ├── verifikasi document_digest cocok dengan current digest
    ├── kembalikan data dokumen (tanpa token)
    │
    ▼
Halaman /sign/session  (render data dokumen + canvas TTD)
    │
    ▼
POST /api/signing/ttd  (cookie wajib, scope sign:ttd)
    │
    ├── validasi sesi
    ├── verifikasi digest dokumen (TOCTOU protection)
    ├── validasi PNG: magic bytes + batas ukuran
    ├── idempotency check
    ├── simpan TTD + buat PDF
    ├── simpan idempotency receipt
    ├── tandai sesi read_only (15 menit post-submit window)
    ├── audit event
    │
    ▼
Receipt: {ok: true, nomor, pihak, documentVersion}  (tanpa token)
```

## State Machine Token

```
active → exchanged  (exchange berhasil, sekali pakai)
active → expired    (expires_at lewat, oleh cleanup atau exchange)
active → revoked    (oleh operator internal, atau dokumen berubah versi)
exchanged → completed  (setelah semua pihak menandatangani)
```

## State Machine Sesi

```
active → read_only  (TTD berhasil disubmit, window 15 menit)
active → expired    (absolute TTL 30 menit atau idle 10 menit)
active → revoked    (oleh operator, atau dokumen berubah versi)
read_only → expired (read_only_until lewat)
```

## TTL dan Batas Waktu

| Parameter | Default | Range | Sumber Waktu |
|-----------|---------|-------|--------------|
| Token TTL | 48 jam | 15 menit – 72 jam | Server UTC |
| Session absolute TTL | 30 menit | Fixed | Server UTC |
| Session idle timeout | 10 menit | Fixed | Server UTC |
| Post-submit read-only | 15 menit | Fixed | Server UTC |
| Clock skew tolerance | 30 detik | Fixed | Server UTC |

Semua waktu menggunakan **server UTC**. Tidak ada ketergantungan pada waktu klien.

## Document Version & Digest

Setiap perubahan dokumen (edit surat, tambah aset) akan:
1. Menginkremen `document_version` di tabel `surat`
2. Menghitung ulang `document_digest` (SHA-256 dari canonical JSON)
3. **Mencabut semua token aktif** untuk versi lama
4. **Mencabut semua sesi aktif** terkait token yang dicabut

Sebelum commit TTD:
- Digest dokumen saat ini dibandingkan dengan digest saat token diterbitkan
- Jika tidak cocok → submit ditolak dengan 409 Conflict

## Keamanan Token

### Penyimpanan
- Raw token (256-bit CSPRNG) **hanya dikirim sekali** ke penerima melalui URL/QR
- Yang disimpan di DB: **hash SHA-256** dari raw token
- Raw token **tidak pernah di-log** (redaction via regex)

### Exchange Atomik
- RPC `exchange_signing_token` menggunakan `FOR UPDATE SKIP LOCKED`
- Race condition concurrent exchange → hanya satu yang berhasil
- Token langsung di-state 'exchanged' → replay ditolak

### Cookie Sesi
```
Set-Cookie: __signing_session={256-bit-secret}; HttpOnly; Secure; SameSite=Strict; Path=/sign; Max-Age={TTL}
```

Database hanya menyimpan hash SHA-256 secret sesi. Migrasi hardening
`002_signing_session_hardening.sql` mencabut sesi lama yang masih memakai UUID mentah.

## Revocation

### Prosedur Normal
```
DELETE /api/signing/token/{id}  (autentikasi Supabase wajib)
```

### Rotate (Cabut Lama + Terbitkan Baru)
```
POST /api/signing/token/{id}/rotate  (autentikasi Supabase wajib)
```

### Emergency Revoke Semua Token Aktif Satu Surat
Jalankan di Supabase SQL Editor:
```sql
UPDATE external_signing_token
SET state = 'revoked', revoked_at = NOW()
WHERE nomor_surat = '{NOMOR_SURAT}'
  AND state = 'active';

UPDATE signing_session
SET state = 'revoked'
WHERE nomor_surat = '{NOMOR_SURAT}'
  AND state IN ('active','read_only');
```

### Emergency Revoke Semua Token Aktif (Seluruh Sistem)
```sql
-- HANYA dijalankan oleh DBA/admin saat insiden keamanan kritis
UPDATE external_signing_token SET state = 'revoked', revoked_at = NOW() WHERE state = 'active';
UPDATE signing_session SET state = 'revoked' WHERE state IN ('active','read_only');
-- Tambahkan entry audit manual setelah tindakan ini
```

## Retensi Data

| Data | Retensi | Catatan |
|------|---------|---------|
| Token (tombstone) | 30 hari setelah state change | Tidak dihapus, hanya state change |
| Sesi signing | 30 hari setelah expired | Sama seperti token |
| Idempotency receipt | 5 tahun dari created_at | Atau retensi legal induk yang lebih panjang |
| Audit log | 12 bulan minimum | 5 tahun untuk event evidence TTD |
| PDF + TTD evidence | Ikuti kebijakan arsip dokumen | Tidak dihapus oleh cleanup job token |

**PENTING**: Konfirmasi retensi receipt 5 tahun dengan pemilik kebijakan arsip/legal
sebelum konfigurasi production dikunci.

## Cleanup Job

Endpoint: `POST /api/signing/cleanup` (internal key wajib via header `x-cleanup-key`)

Dijalankan setiap jam via Vercel Cron atau scheduler eksternal. Idempotent — aman
dijalankan berulang. Memanggil RPC `cleanup_expired_tokens_and_sessions()` di DB.

Konfigurasi vercel.json:
```json
{
  "crons": [{
    "path": "/api/signing/cleanup",
    "schedule": "0 * * * *"
  }]
}
```

Sertakan `x-cleanup-key` dari environment variable `SIGNING_CLEANUP_KEY` di request header.

## Ancaman dan Mitigasi

| Ancaman | Mitigasi |
|---------|---------|
| Token leakage via URL | Exchange segera redirect ke URL bersih; cookie HttpOnly menggantikan token di URL |
| Token leakage via log | Regex redaction; raw token tidak pernah di-log server-side |
| Token leakage via referrer | Referrer-Policy: no-referrer di semua halaman signing |
| Replay attack | Token sekali pakai (state → exchanged); cookie HttpOnly tidak bisa dicuri via JS |
| Session fixation | Session dibuat fresh saat exchange; session ID tidak dari client |
| TOCTOU document mutation | Digest diverifikasi ulang sebelum commit TTD |
| Race condition exchange | FOR UPDATE SKIP LOCKED di RPC; hanya satu exchange berhasil |
| Enumeration | Error response generik; tidak membedakan "expired" vs "sudah dipakai" |
| CSRF | SameSite=Strict cookie; tidak ada state-modifying GET endpoint |
| Clickjacking | X-Frame-Options: DENY; CSP frame-ancestors: none |
| Token leakage via analytics | Zero third-party scripts di halaman signing |
| Scope escalation | Scope diperiksa per endpoint; tidak ada privilege escalation |

## Risiko Residual

1. **Distributed rate limiting**: Implementasi saat ini mengandalkan rate limit di level
   Vercel/edge. Untuk produksi, tambahkan rate limiting berbasis IP di database atau
   Redis untuk endpoint exchange.

2. **Emergency revoke manual**: Prosedur emergency revoke masih memerlukan akses SQL
   manual. Pertimbangkan endpoint admin khusus dengan audit trail otomatis.

3. **Retensi receipt 5 tahun**: Perlu konfirmasi dari pemilik kebijakan arsip/legal
   bahwa 5 tahun sesuai regulasi yang berlaku (e.g., UU Kearsipan, regulasi industri).

4. **Security review independen**: Diperlukan sebelum acceptance final dan merge ke main.

5. **Cleanup monitoring**: Jika cleanup job gagal, token expired tidak langsung berbahaya
   (state machine masih benar), tapi database bisa bertumbuh. Tambahkan alerting untuk
   kegagalan cleanup job.

## Variabel Environment

```bash
# Wajib
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...  # service-role key, server-side only

# Opsional (ada defaults)
BASE_URL=https://app.example.com
TOKEN_DEFAULT_TTL_MS=172800000  # 48 jam default
SESSION_ABSOLUTE_MS=1800000     # 30 menit
SESSION_IDLE_MS=600000          # 10 menit
SESSION_READONLY_MS=900000      # 15 menit
TOKEN_CLOCK_SKEW_MS=30000       # 30 detik

# Cleanup job
SIGNING_CLEANUP_KEY=<random-secret>  # generate: openssl rand -hex 32
```

**PENTING**: `SUPABASE_SECRET_KEY` dan `SIGNING_CLEANUP_KEY` adalah server-side only.
Pastikan tidak masuk ke client bundle atau Git repository.
