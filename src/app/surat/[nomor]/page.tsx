import { SuratDetail } from "@/components/surat/SuratDetail";
import { ErrorState } from "@/components/ui/ErrorState";
import { headers } from "next/headers";
import type { Surat } from "@/types";

interface Props { params: Promise<{ nomor: string }> }

export default async function SuratDetailPage({ params }: Props) {
  const { nomor } = await params; const headerStore = await headers(); const host = headerStore.get("host") ?? "localhost:3000"; const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  let surat: Surat | null = null; let message = "";
  try { const response = await fetch(`${protocol}://${host}/api/surat/${encodeURIComponent(nomor)}`, { cache: "no-store", headers: { cookie: headerStore.get("cookie") ?? "" } }); if (!response.ok) throw new Error((await response.json() as { error?: string }).error); surat = await response.json() as Surat; } catch (error) { message = error instanceof Error ? error.message : "Surat gagal dimuat."; }
  return surat ? <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10"><SuratDetail initial={surat}/></main> : <main className="mx-auto max-w-4xl px-4 py-10"><ErrorState message={message}/></main>;
}
