import { describe, expect, it } from "vitest";
import { POST as createRoute } from "@/app/api/surat/route";
import { GET as qrRoute } from "@/app/api/surat/[nomor]/qr/route";
import { bikinExcel } from "@/lib/excel";
import { nextNomor } from "@/lib/nomor";
import { buatPdf } from "@/lib/pdf";
import { asetSchema, suratSchema, ttdSchema } from "@/lib/schemas";
import type { Surat } from "@/types";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { GET as listSigningTokens, POST as issueSigningToken } from "@/app/api/signing/token/route";
import { DELETE as revokeSigningToken, POST as rotateSigningToken } from "@/app/api/signing/token/[id]/route";
import { GET as exchangeSigningToken } from "@/app/sign/exchange/[token]/route";
import { GET as signingPdf } from "@/app/api/signing/pdf/route";
import { GET as signingQr } from "@/app/api/signing/qr/route";

const surat: Surat = { nomor: "001/SRT-ST/2026", tanggal: "10 September 2026", tanggalSingkat: "10/09/2026", kategori: "penyerahan", nama: "Edy", departemen: "IT", penerima: "Mika", departemenPenerima: "HRD", keterangan: "Laptop untuk operasional", namaHrd: "HRD", aset: [{ kode: "INV/IT-001", nama: "Laptop", kategori: "IT", nilai: 10_000_000, kondisi: "baik", status: "dipakai" }] };

describe("API contracts tanpa Supabase", () => {
  it("menolak payload surat invalid sebelum mengakses database", async () => {
    const response = await createRoute(new Request("http://localhost/api/surat", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
    expect(Object.keys(await response.json())).toEqual(["error"]);
  });

  it("memvalidasi dan menormalisasi payload", () => {
    expect(suratSchema.parse({ ...surat, aset: ["A", "A"] }).aset).toEqual(["A"]);
    expect(asetSchema.parse({ nama: "Laptop" }).kondisi).toBe("baik");
    expect(() => ttdSchema.parse({ ttd: {} })).toThrow("Tidak ada tanda tangan");
  });

  it("mempertahankan format nomor surat", () => {
    expect(nextNomor(["001/SRT-ST/2026"], new Date(2026, 8, 10)).nomor).toBe("002/SRT-ST/2026");
  });

  it("menghasilkan PDF satu halaman", async () => {
    const result = await buatPdf(surat);
    expect(result.buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(result.buffer.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it("menghasilkan QR PNG", async () => {
    const response = await qrRoute(new Request("http://localhost/api/surat/001/qr?pihak=hrd"), { params: Promise.resolve({ nomor: surat.nomor }) });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer()).subarray(1, 4).toString()).toBe("PNG");
  });

  it("menghasilkan workbook Excel", async () => {
    const result = await bikinExcel([surat]);
    expect(result.subarray(0, 2).toString()).toBe("PK");
  });

  it("menutup API ketika konfigurasi auth tidak tersedia", async () => {
    const response = await middleware(new NextRequest("http://localhost/api/aset"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Layanan belum dikonfigurasi." });
  });

  it("menolak akses anonim langsung ke seluruh API pengelolaan token signing", async () => {
    const context = { params: Promise.resolve({ id: "token-id" }) };
    const responses = await Promise.all([
      listSigningTokens(new NextRequest("http://localhost/api/signing/token?nomor=001")),
      issueSigningToken(new NextRequest("http://localhost/api/signing/token", { method: "POST" })),
      revokeSigningToken(new NextRequest("http://localhost/api/signing/token/token-id", { method: "DELETE" }), context),
      rotateSigningToken(new NextRequest("http://localhost/api/signing/token/token-id", { method: "POST" }), context),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
  });

  it("exchange malformed memakai redirect generik, URL bersih, dan security headers", async () => {
    const response = await exchangeSigningToken(
      new NextRequest("https://app.example/sign/exchange/bad"),
      { params: Promise.resolve({ token: "bad" }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example/sign/invalid");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("resource PDF/QR signing menolak request tanpa sesi secara generik", async () => {
    const [pdf, qr] = await Promise.all([
      signingPdf(new NextRequest("https://app.example/api/signing/pdf")),
      signingQr(new NextRequest("https://app.example/api/signing/qr")),
    ]);
    expect([pdf.status, qr.status]).toEqual([403, 403]);
    expect(await pdf.json()).toEqual({ error: "Sesi tidak valid atau sudah berakhir." });
    expect(await qr.json()).toEqual({ error: "Sesi tidak valid atau sudah berakhir." });
    expect(pdf.headers.get("cache-control")).toContain("no-store");
    expect(qr.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
