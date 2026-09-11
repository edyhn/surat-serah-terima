import { deleteSurat, findSurat, insertSurat, linkMap, listAset, listLinks, listSurat, loadTtd, parseTtd, pdfName, removeFiles, saveFile, saveTtd, setAssetStatus, setLinks, ttdDataUrls, ttdStatusMap, updateSurat } from "@/lib/data";
import { nextNomor } from "@/lib/nomor";
import { buatPdf } from "@/lib/pdf";
import type { Aset, Surat, SuratInput } from "@/types";

export async function assetsForCodes(codes: string[]) {
  const map = new Map((await listAset()).map((asset) => [asset.kode, asset]));
  return codes.map((code) => map.get(code)).filter((asset): asset is Aset => Boolean(asset));
}

async function assertAssets(codes: string[]) {
  const found = new Set((await listAset()).map((asset) => asset.kode));
  const missing = codes.filter((code) => !found.has(code));
  if (missing.length) throw new Error(`Kode aset tidak ditemukan: ${missing.join(", ")}`);
}

async function persistDocument(surat: Surat, input: SuratInput) {
  const signatures = parseTtd(input.ttd);
  if (Object.keys(signatures).length) await saveTtd(surat.nomor, signatures);
  const stored = await loadTtd(surat.nomor);
  surat.ttd = stored;
  surat.aset = await assetsForCodes(input.aset);
  const pdf = await buatPdf(surat);
  await saveFile(pdf.namaFile, pdf.buffer, "application/pdf");
  return { ...surat, pdf: pdf.namaFile, ttd: ttdDataUrls(stored) };
}

function resolveAssetStatus(input: SuratInput): Aset["status"] {
  if (input.statusAsetTujuan) return input.statusAsetTujuan;
  if (input.kategori === "pengadaan") return "proses_qc";
  if (input.kategori === "penyerahan") return "dipakai";
  return "proses_qc";
}

export async function createSurat(input: SuratInput) {
  await assertAssets(input.aset);
  const numbered = nextNomor((await listSurat()).map((item) => item.nomor));
  const surat: Surat = { ...input, ...numbered };
  await insertSurat(surat);
  await setLinks(surat.nomor, input.aset);
  await setAssetStatus(input.aset, resolveAssetStatus(input));
  return persistDocument(surat, input);
}

export async function editSurat(nomor: string, input: SuratInput) {
  const current = await findSurat(nomor);
  if (!current) return null;
  await assertAssets(input.aset);
  const surat: Surat = { ...current, ...input };
  await updateSurat(nomor, surat);
  await setLinks(nomor, input.aset);
  await setAssetStatus(input.aset, resolveAssetStatus(input));
  return persistDocument(surat, input);
}

export async function removeSurat(nomor: string) {
  if (!(await deleteSurat(nomor))) return false;
  await setLinks(nomor, []);
  try { await removeFiles([pdfName(nomor), ...["menyerahkan", "menerima", "hrd"].map((party) => `ttd/${nomor.replace(/[/\\]/g, "-")}-${party}.png`)]); } catch { /* Database deletion remains authoritative. */ }
  return true;
}

export async function detailedSurat(nomor: string) {
  const surat = await findSurat(nomor);
  if (!surat) return null;
  const links = linkMap(await listLinks());
  const ttd = await loadTtd(nomor);
  return { ...surat, aset: await assetsForCodes(links[nomor] ?? []), ttd: ttdDataUrls(ttd) };
}

export async function history() {
  const [surat, links, signatures] = await Promise.all([listSurat(), listLinks(), ttdStatusMap()]);
  const map = linkMap(links);
  return surat.map((item) => ({ ...item, aset: map[item.nomor] ?? [], ttd: signatures[item.nomor.replace(/[/\\]/g, "-")] ?? { menyerahkan: false, menerima: false, hrd: false } }));
}
