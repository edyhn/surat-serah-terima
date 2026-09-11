import ExcelJS from "exceljs";
import type { Surat } from "@/types";

const columns = [
  { header: "No", key: "no", width: 6 }, { header: "No Surat", key: "nomor", width: 20 },
  { header: "Tanggal", key: "tanggal", width: 18 }, { header: "Tanggal Singkat", key: "tanggalSingkat", width: 16 },
  { header: "Kategori", key: "kategori", width: 15 }, { header: "Nama", key: "nama", width: 25 },
  { header: "Departemen", key: "departemen", width: 15 }, { header: "Penerima", key: "penerima", width: 25 },
  { header: "Dept. Penerima", key: "departemenPenerima", width: 15 }, { header: "Keterangan", key: "keterangan", width: 45 },
  { header: "Nama HRD", key: "namaHrd", width: 25 }, { header: "Aset", key: "aset", width: 45 },
];

export async function bikinExcel(daftar: Surat[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Riwayat");
  sheet.columns = columns;
  [...daftar].reverse().forEach((surat, index) => sheet.addRow({ ...surat, no: index + 1, aset: (surat.aset ?? []).map((item) => typeof item === "string" ? item : item.kode).join(", ") }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (sheet.rowCount > 1) sheet.autoFilter = { from: "A1", to: `L${sheet.rowCount}` };
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
