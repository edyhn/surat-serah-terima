import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listAset } from "@/lib/data";
import { history } from "@/lib/surat-service";
import { configData } from "@/app/api/config/route";
export async function GET() { try { return NextResponse.json({ config: configData, riwayat: await history(), aset: await listAset() }); } catch (error) { return apiError(error, "Gagal memuat data awal."); } }
