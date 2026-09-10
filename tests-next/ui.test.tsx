import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

describe("UI states dan aksesibilitas dasar", () => {
  it("merender label, validation state, dan disabled state", () => { const html = renderToStaticMarkup(<><Input name="nama" label="Nama" error="Wajib diisi"/><Button disabled>Simpan</Button></>); expect(html).toContain("aria-invalid=\"true\""); expect(html).toContain("role=\"alert\""); expect(html).toContain("disabled=\"\""); });
  it("merender loading, empty, error, dan badge state", () => { const html = renderToStaticMarkup(<><LoadingSpinner/><EmptyState title="Kosong" description="Belum ada data"/><ErrorState message="API gagal"/><Badge tone="green">tersedia</Badge></>); expect(html).toContain("role=\"status\""); expect(html).toContain("role=\"alert\""); expect(html).toContain("Belum ada data"); expect(html).toContain("tersedia"); });
});
