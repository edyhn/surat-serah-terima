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
});
