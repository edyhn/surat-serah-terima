import { NextResponse } from "next/server";
import { apiError, readJson, type RouteContext } from "@/lib/api";
import { deleteAset, listAset, updateAset } from "@/lib/data";
import { asetSchema } from "@/lib/schemas";

export async function GET(_: Request, context: RouteContext) {
  try {
    const { kode } = await context.params;
    const aset = (await listAset()).find((item) => item.kode === kode);
    return aset
      ? NextResponse.json(aset)
      : NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Gagal membaca aset.");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { kode } = await context.params;
    const aset = await updateAset(kode, asetSchema.parse(await readJson(request)));
    return aset
      ? NextResponse.json(aset)
      : NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Gagal mengubah aset.");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { kode } = await context.params;
    return (await deleteAset(kode))
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Gagal menghapus aset.");
  }
}