"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { rupiah } from "@/lib/utils";
import type { Aset } from "@/types";

export function AsetTable({ data, busy, onEdit, onDelete }: { data: Aset[]; busy: string; onEdit: (aset: Aset) => void; onDelete: (kode: string) => void }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Daftar inventaris aset</caption><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Aset</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Nilai</th><th className="px-4 py-3">Kondisi</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((aset) => <tr key={aset.kode} className="hover:bg-slate-50"><td className="px-4 py-4"><strong className="block">{aset.nama}</strong><span className="text-xs text-slate-500">{aset.kode}</span></td><td className="px-4 py-4">{aset.kategori || "—"}</td><td className="px-4 py-4 font-medium">{rupiah(aset.nilai)}</td><td className="px-4 py-4">{aset.kondisi}</td><td className="px-4 py-4"><Badge tone={aset.status === "tersedia" ? "green" : aset.status === "dipakai" ? "blue" : "amber"}>{aset.status}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><Button aria-label={`Edit ${aset.kode}`} className="min-w-11 bg-white px-3 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" disabled={Boolean(busy)} onClick={() => onEdit(aset)}><Pencil className="size-4"/></Button><Button aria-label={`Hapus ${aset.kode}`} className="min-w-11 bg-white px-3 text-red-700 ring-1 ring-slate-200 hover:bg-red-50" disabled={Boolean(busy)} onClick={() => onDelete(aset.kode)}><Trash2 className="size-4"/></Button></div></td></tr>)}</tbody></table></div>;
}
