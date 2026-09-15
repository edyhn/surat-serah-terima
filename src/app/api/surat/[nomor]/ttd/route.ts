import { NextResponse } from "next/server";
import { apiError, readJson, type RouteContext } from "@/lib/api";
import { findSurat, linkMap, listLinks, loadTtd, parseTtd, saveFile, saveTtd, ttdDataUrls, updateSurat } from "@/lib/data";
import { buatPdf } from "@/lib/pdf";
import { ttdSchema } from "@/lib/schemas";
import { assetsForCodes } from "@/lib/surat-service";
export async function POST(request: Request, context: RouteContext) { try { const { nomor } = await context.params; const surat = await findSurat(nomor); if (!surat) return NextResponse.json({ error: "Surat tidak ditemukan." }, { status: 404 }); const input = ttdSchema.parse(await readJson(request)); const signatures = parseTtd(input.ttd); if (input.nama && Object.keys(signatures).length === 1 && signatures.hrd) { surat.namaHrd = input.nama; await updateSurat(nomor, surat); } await saveTtd(nomor, signatures); const stored = await loadTtd(nomor); surat.ttd = stored; surat.aset = await assetsForCodes(linkMap(await listLinks())[nomor] ?? []); const pdf = await buatPdf(surat); await saveFile(pdf.namaFile, pdf.buffer, "application/pdf"); return NextResponse.json({ ...surat, pdf: pdf.namaFile, ttd: ttdDataUrls(stored) }); } catch (error) { return apiError(error, "Gagal menyimpan tanda tangan."); } }
