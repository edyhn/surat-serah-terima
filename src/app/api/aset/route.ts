import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { insertAset, listAset } from "@/lib/data";
import { asetSchema } from "@/lib/schemas";
export async function GET() { try { return NextResponse.json(await listAset()); } catch (error) { return apiError(error, "Gagal membaca data aset."); } }
export async function POST(request: Request) { try { const parsed = asetSchema.parse(await readJson(request)); if (!parsed.kode) { const segment = parsed.kategori.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "ASET"; const regex = new RegExp(`^INV/${segment}-(\\d+)$`); const max = (await listAset()).reduce((value, item) => Math.max(value, Number(regex.exec(item.kode)?.[1] ?? 0)), 0); parsed.kode = `INV/${segment}-${String(max + 1).padStart(3, "0")}`; } return NextResponse.json(await insertAset(parsed)); } catch (error) { const duplicate = error instanceof Error && /duplicate|sudah dipakai/i.test(error.message); return apiError(error, duplicate ? "Kode aset sudah dipakai." : "Gagal menyimpan aset.", duplicate ? 400 : 500); } }
