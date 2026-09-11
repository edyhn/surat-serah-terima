import { createAdminClient, PDF_BUCKET } from "@/lib/supabase-admin";
import type { Aset, PihakTtd, Surat, SuratInput } from "@/types";

interface SuratRow { nomor: string; tanggal: string; tanggal_singkat: string; kategori: "penyerahan" | "pengembalian"; nama: string; departemen: string; penerima: string; departemen_penerima: string; keterangan: string; nama_hrd: string | null }
interface LinkRow { nomor_surat: string; kode_aset: string }
const PIHAK: PihakTtd[] = ["menyerahkan", "menerima", "hrd"];

function mapSurat(row: SuratRow): Surat {
  return { nomor: row.nomor, tanggal: row.tanggal, tanggalSingkat: row.tanggal_singkat, kategori: row.kategori, nama: row.nama, departemen: row.departemen, penerima: row.penerima, departemenPenerima: row.departemen_penerima, keterangan: row.keterangan, namaHrd: row.nama_hrd ?? "" };
}

function toRow(surat: Surat) {
  return { nomor: surat.nomor, tanggal: surat.tanggal, tanggal_singkat: surat.tanggalSingkat, kategori: surat.kategori, nama: surat.nama, departemen: surat.departemen, penerima: surat.penerima, departemen_penerima: surat.departemenPenerima, keterangan: surat.keterangan, nama_hrd: surat.namaHrd || null };
}

export async function listSurat(): Promise<Surat[]> {
  const { data, error } = await createAdminClient().from("surat").select("*").order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw error;
  return (data as SuratRow[]).map(mapSurat);
}

export async function findSurat(nomor: string) {
  const { data, error } = await createAdminClient().from("surat").select("*").eq("nomor", nomor).maybeSingle();
  if (error) throw error;
  return data ? mapSurat(data as SuratRow) : null;
}

export async function insertSurat(surat: Surat) {
  const { error } = await createAdminClient().from("surat").insert(toRow(surat));
  if (error) throw error;
}

export async function updateSurat(nomor: string, surat: Surat) {
  const { data, error } = await createAdminClient().from("surat").update(toRow(surat)).eq("nomor", nomor).select().maybeSingle();
  if (error) throw error;
  return data ? mapSurat(data as SuratRow) : null;
}

export async function deleteSurat(nomor: string) {
  const { count, error } = await createAdminClient().from("surat").delete({ count: "exact" }).eq("nomor", nomor);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function listAset(): Promise<Aset[]> {
  const { data, error } = await createAdminClient().from("aset").select("*").order("kode");
  if (error) throw error;
  return (data ?? []) as Aset[];
}

export async function insertAset(aset: Aset) {
  const { data, error } = await createAdminClient().from("aset").insert(aset).select().single();
  if (error) throw error;
  return data as Aset;
}

export async function updateAset(kode: string, aset: Aset) {
  const { data, error } = await createAdminClient().from("aset").update(aset).eq("kode", kode).select().maybeSingle();
  if (error) throw error;
  return data as Aset | null;
}

export async function deleteAset(kode: string) {
  const db = createAdminClient();
  const { count, error } = await db.from("aset").delete({ count: "exact" }).eq("kode", kode);
  if (error) throw error;
  if (count) { const result = await db.from("surat_aset").delete().eq("kode_aset", kode); if (result.error) throw result.error; }
  return (count ?? 0) > 0;
}

export async function listLinks(): Promise<LinkRow[]> {
  const { data, error } = await createAdminClient().from("surat_aset").select("nomor_surat,kode_aset");
  if (error) throw error;
  return (data ?? []) as LinkRow[];
}

export function linkMap(rows: LinkRow[]) {
  return rows.reduce<Record<string, string[]>>((map, row) => { (map[row.nomor_surat] ??= []).push(row.kode_aset); return map; }, {});
}

export async function setLinks(nomor: string, kode: string[]) {
  const db = createAdminClient();
  const removed = await db.from("surat_aset").delete().eq("nomor_surat", nomor);
  if (removed.error) throw removed.error;
  if (kode.length) { const added = await db.from("surat_aset").insert(kode.map((item) => ({ nomor_surat: nomor, kode_aset: item }))); if (added.error) throw added.error; }
}

export async function setAssetStatus(kode: string[], status: Aset["status"]) {
  if (!kode.length) return;
  const { error } = await createAdminClient().from("aset").update({ status }).in("kode", kode);
  if (error) throw error;
}

const ttdPath = (nomor: string, pihak: PihakTtd) => `ttd/${nomor.replace(/[/\\]/g, "-")}-${pihak}.png`;
export const pdfName = (nomor: string) => `${nomor.replace(/[^A-Za-z0-9.-]/g, "-")}.pdf`;

export async function saveFile(path: string, buffer: Buffer, contentType: string) {
  const { error } = await createAdminClient().storage.from(PDF_BUCKET).upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
}

export async function loadFile(path: string) {
  const { data, error } = await createAdminClient().storage.from(PDF_BUCKET).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeFiles(paths: string[]) {
  const { error } = await createAdminClient().storage.from(PDF_BUCKET).remove(paths);
  if (error) throw error;
}

export function parseTtd(input?: SuratInput["ttd"]): Partial<Record<PihakTtd, Buffer>> {
  const result: Partial<Record<PihakTtd, Buffer>> = {};
  for (const pihak of PIHAK) { const value = input?.[pihak]; if (value) { const buffer = Buffer.from(value.slice(value.indexOf(",") + 1), "base64"); const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); if (!png) throw new Error("Isi tanda tangan bukan PNG yang valid."); if (buffer.length > 0 && buffer.length <= 1_048_576) result[pihak] = buffer; } }
  return result;
}

export async function saveTtd(nomor: string, ttd: Partial<Record<PihakTtd, Buffer>>) {
  await Promise.all(Object.entries(ttd).map(([pihak, buffer]) => saveFile(ttdPath(nomor, pihak as PihakTtd), buffer, "image/png")));
}

export async function loadTtd(nomor: string) {
  const result: Partial<Record<PihakTtd, Buffer>> = {};
  await Promise.all(PIHAK.map(async (pihak) => { try { result[pihak] = await loadFile(ttdPath(nomor, pihak)); } catch { /* Missing signatures are valid. */ } }));
  return result;
}

export async function ttdStatusMap() {
  const { data, error } = await createAdminClient().storage.from(PDF_BUCKET).list("ttd", { limit: 1000 });
  if (error) throw error;
  const result: Record<string, Partial<Record<PihakTtd, boolean>>> = {};
  for (const item of data ?? []) for (const pihak of PIHAK) { const suffix = `-${pihak}.png`; if (item.name.endsWith(suffix)) (result[item.name.slice(0, -suffix.length)] ??= {})[pihak] = true; }
  return result;
}

export function ttdDataUrls(ttd: Partial<Record<PihakTtd, Buffer>>) {
  return Object.fromEntries(Object.entries(ttd).map(([key, value]) => [key, `data:image/png;base64,${value.toString("base64")}`]));
}
