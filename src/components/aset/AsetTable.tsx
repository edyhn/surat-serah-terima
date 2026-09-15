"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { rupiah } from "@/lib/utils";
import type { Aset } from "@/types";

export interface AsetTableProps {
  data: Aset[];
  busy: string;
  onEdit: (aset: Aset) => void;
  onDelete: (kode: string) => void;
  onMarkReady?: (kode: string) => void;
}

export function AsetTable({
  data,
  busy,
  onEdit,
  onDelete,
  onMarkReady,
}: AsetTableProps) {
  function getStatusBadge(status: Aset["status"]) {
    switch (status) {
      case "proses_qc":
        return { tone: "amber" as const, label: "Proses QC" };
      case "siap_pakai":
      case "tersedia":
        return { tone: "blue" as const, label: "Siap Pakai" };
      case "dipakai":
        return { tone: "green" as const, label: "Dipakai" };
      case "perbaikan":
        return { tone: "rose" as const, label: "Perbaikan" };
      case "rusak":
        return { tone: "rose" as const, label: "Rusak" };
      case "hilang":
      case "dihapus":
        return { tone: "slate" as const, label: status };
      default:
        return { tone: "slate" as const, label: status };
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[780px] text-left text-xs">
        <caption className="sr-only">Daftar inventaris aset</caption>
        <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3">Aset & Kode</th>
            <th scope="col" className="px-4 py-3">Kategori</th>
            <th scope="col" className="px-4 py-3">Nilai</th>
            <th scope="col" className="px-4 py-3">Kondisi</th>
            <th scope="col" className="px-4 py-3">Status Aset</th>
            <th scope="col" className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((aset) => {
            const statusInfo = getStatusBadge(aset.status);
            const isQc = aset.status === "proses_qc";

            return (
              <tr key={aset.kode} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3.5">
                  <strong className="block text-slate-900 font-bold">{aset.nama}</strong>
                  <span className="font-mono text-[11px] text-slate-500">{aset.kode}</span>
                </td>
                <td className="px-4 py-3.5 text-slate-600">{aset.kategori || "—"}</td>
                <td className="px-4 py-3.5 font-medium text-slate-800">{rupiah(aset.nilai)}</td>
                <td className="px-4 py-3.5 capitalize text-slate-600">{aset.kondisi}</td>
                <td className="px-4 py-3.5">
                  <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {isQc && onMarkReady && (
                      <button
                        type="button"
                        title="Tandai Lolos QC / Siap Pakai"
                        disabled={Boolean(busy)}
                        onClick={() => onMarkReady(aset.kode)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        Lolos QC
                      </button>
                    )}
                    <Button
                      aria-label={`Edit ${aset.kode}`}
                      className="min-w-8 bg-white px-2.5 py-1 text-slate-700 border border-slate-200 shadow-none hover:bg-slate-100"
                      disabled={Boolean(busy)}
                      onClick={() => onEdit(aset)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      aria-label={`Hapus ${aset.kode}`}
                      className="min-w-8 bg-white px-2.5 py-1 text-red-600 border border-slate-200 shadow-none hover:bg-red-50 hover:border-red-200"
                      disabled={Boolean(busy)}
                      onClick={() => onDelete(aset.kode)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
