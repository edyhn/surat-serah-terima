"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { asetSchema } from "@/lib/schemas";
import { fetchJson } from "@/lib/utils";
import type { Aset } from "@/types";

type Values = z.input<typeof asetSchema>;
export function AsetForm({ initial, onSaved, onCancel }: { initial?: Aset; onSaved: (aset: Aset) => void; onCancel: () => void }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(asetSchema), defaultValues: initial ?? { kode: "", nama: "", kategori: "", nilai: 0, kondisi: "baik", status: "tersedia" } });
  async function submit(values: Values) { try { onSaved(await fetchJson<Aset>(initial ? `/api/aset/${encodeURIComponent(initial.kode)}` : "/api/aset", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) })); } catch (cause) { setError("root", { message: cause instanceof Error ? cause.message : "Aset gagal disimpan." }); } }
  return <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Input label="Kode (kosongkan untuk otomatis)" error={errors.kode?.message} disabled={isSubmitting || Boolean(initial)} {...register("kode")}/><Input label="Nama aset" error={errors.nama?.message} disabled={isSubmitting} {...register("nama")}/><Input label="Kategori" error={errors.kategori?.message} disabled={isSubmitting} {...register("kategori")}/><Input label="Nilai aset" type="number" min="0" error={errors.nilai?.message} disabled={isSubmitting} {...register("nilai")}/><Select label="Kondisi" error={errors.kondisi?.message} disabled={isSubmitting} {...register("kondisi")}><option value="baru">Baru</option><option value="sangat-baik">Sangat baik</option><option value="baik">Baik</option><option value="cukup">Cukup</option><option value="rusak-ringan">Rusak ringan</option><option value="rusak-berat">Rusak berat</option></Select><Select label="Status" error={errors.status?.message} disabled={isSubmitting} {...register("status")}><option value="tersedia">Tersedia</option><option value="dipakai">Dipakai</option><option value="perbaikan">Perbaikan</option><option value="rusak">Rusak</option><option value="hilang">Hilang</option><option value="dihapus">Dihapus</option></Select></div>{errors.root && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{errors.root.message}</p>}<div className="flex justify-end gap-3"><Button className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" onClick={onCancel} disabled={isSubmitting}>Batal</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Menyimpan…" : "Simpan aset"}</Button></div></form>;
}
