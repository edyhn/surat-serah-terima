import { NextResponse } from "next/server";
export const configData = { kota: "Tangerang", deptPengelola: "HR - Umum", namaInstansi: "PT SRT", alamatInstansi: "Tangerang", departemen: ["IT", "Keuangan", "HRD", "Umum", "Pemasaran", "Produksi", "Gudang"] };
export async function GET() { return NextResponse.json(configData); }
