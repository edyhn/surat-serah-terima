"use client";

import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Surat } from "@/types";

export function SuratTable({ data, deleting, onDelete }: { data: Surat[]; deleting: string; onDelete: (nomor: string) => void }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Daftar riwayat surat serah terima</caption><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th scope="col" className="px-4 py-3">Nomor</th><th scope="col" className="px-4 py-3">Tanggal</th><th scope="col" className="px-4 py-3">Pihak</th><th scope="col" className="px-4 py-3">Kategori</th><th scope="col" className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((surat) => <tr key={surat.nomor} className="hover:bg-slate-50"><td className="px-4 py-4 font-semibold text-slate-950">{surat.nomor}</td><td className="px-4 py-4 text-slate-600">{surat.tanggal}</td><td className="px-4 py-4"><span className="block">{surat.nama}</span><span className="text-xs text-slate-500">ke {surat.penerima}</span></td><td className="px-4 py-4"><Badge tone={surat.kategori === "penyerahan" ? "blue" : "green"}>{surat.kategori}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><Link href={`/surat/${encodeURIComponent(surat.nomor)}`} aria-label={`Lihat ${surat.nomor}`} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"><Eye className="size-4"/></Link><Button aria-label={`Hapus ${surat.nomor}`} className="min-w-11 bg-white px-3 text-red-700 ring-1 ring-slate-200 hover:bg-red-50" disabled={Boolean(deleting)} onClick={() => onDelete(surat.nomor)}><Trash2 className="size-4"/><span className="sr-only">Hapus</span></Button></div></td></tr>)}</tbody></table></div>;
}
