import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SuratForm } from "@/components/surat/SuratForm";

describe("UI states dan aksesibilitas dasar", () => {
  it("merender label, validation state, dan disabled state", () => { const html = renderToStaticMarkup(<><Input name="nama" label="Nama" error="Wajib diisi"/><Button disabled>Simpan</Button></>); expect(html).toContain("aria-invalid=\"true\""); expect(html).toContain("role=\"alert\""); expect(html).toContain("disabled=\"\""); });
  it("merender loading, empty, error, dan badge state", () => { const html = renderToStaticMarkup(<><LoadingSpinner/><EmptyState title="Kosong" description="Belum ada data"/><ErrorState message="API gagal"/><Badge tone="green">tersedia</Badge></>); expect(html).toContain("role=\"status\""); expect(html).toContain("role=\"alert\""); expect(html).toContain("Belum ada data"); expect(html).toContain("tersedia"); });
  it("departemen form dirender sebagai input teks bebas, bukan select", () => {
    const html = renderToStaticMarkup(<SuratForm assets={[]} onSaved={() => {}} />);
    expect(html).toContain('id="departemen"');
    expect(html).toContain('id="departemenPenerima"');
    expect(html).toContain('maxLength="100"');
    expect(html).toContain("Ketik nama departemen secara bebas.");
    expect(html).not.toMatch(/<select[^>]*id="departemen"/);
    expect(html).not.toMatch(/<select[^>]*id="departemenPenerima"/);
  });
  it("departemen lama yang non-allowlist tetap dirender pada form edit", () => {
    const html = renderToStaticMarkup(
      <SuratForm
        assets={[]}
        onSaved={() => {}}
        initial={{
          nomor: "001/SRT-ST/2026",
          tanggal: "10 September 2026",
          tanggalSingkat: "10/09/2026",
          kategori: "penyerahan",
          nama: "Edy",
          departemen: "Divisi Lama",
          penerima: "Mika",
          departemenPenerima: "Keuangan & Akuntansi",
          keterangan: "Laptop",
          namaHrd: "",
        }}
      />
    );
    expect(html).toContain('name="departemen"');
    expect(html).toContain('name="departemenPenerima"');
    expect(html).toContain("Simpan Perubahan");
    expect(html).not.toMatch(/<select[^>]*name="departemen"/);
    expect(html).not.toMatch(/<select[^>]*name="departemenPenerima"/);
  });
});
