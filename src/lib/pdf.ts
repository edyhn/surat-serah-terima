import PDFDocument from "pdfkit";
import type { Aset, PihakTtd, Surat } from "@/types";

const CITY = "Tangerang";
const INK = "#111827";
const statements = {
  penyerahan: "Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas TELAH DISERAHKAN oleh yang bersangkutan untuk diterima dan dikelola sesuai ketentuan yang berlaku.",
  pengembalian: "Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas TELAH DIKEMBALIKAN oleh yang bersangkutan dan telah diterima kembali dalam kondisi yang baik.",
};

function identityTable(doc: PDFKit.PDFDocument, surat: Surat, x: number, y: number, width: number) {
  const rows = [["Nama yang Menyerahkan", surat.nama], ["Departemen Penyerah", surat.departemen], ["Nama yang Menerima", surat.penerima], ["Departemen Penerima", surat.departemenPenerima]];
  const labelWidth = 165;
  for (const [label, value] of rows) {
    doc.fillColor("#f3f4f6").rect(x, y, labelWidth, 25).fill().fillColor(INK);
    doc.rect(x, y, labelWidth, 25).stroke().rect(x + labelWidth, y, width - labelWidth, 25).stroke();
    doc.font("Helvetica-Bold").fontSize(10).text(label, x + 8, y + 7);
    doc.font("Helvetica").text(`: ${value}`, x + labelWidth + 8, y + 7);
    y += 25;
  }
  return y;
}

function signature(doc: PDFKit.PDFDocument, x: number, y: number, width: number, surat: Surat) {
  const labels = ["Yang Menyerahkan,", "Yang Menerima,", "HRD,"];
  const names = [surat.nama, surat.penerima, surat.namaHrd || "............."];
  const parties: PihakTtd[] = ["menyerahkan", "menerima", "hrd"];
  const column = width / 3;
  parties.forEach((party, index) => {
    const center = x + column * index + column / 2;
    doc.font("Helvetica").fontSize(10).text(labels[index], x + column * index, y, { width: column, align: "center" });
    const image = surat.ttd?.[party];
    if (Buffer.isBuffer(image)) doc.image(image, center - 50, y + 22, { fit: [100, 35], align: "center" });
    doc.moveTo(center - 60, y + 70).lineTo(center + 60, y + 70).stroke();
    doc.text(`(${names[index]})`, x + column * index, y + 78, { width: column, align: "center" });
  });
}

export function buatPdf(surat: Surat): Promise<{ namaFile: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 46, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve({ namaFile: `${surat.nomor.replace(/[/\\]/g, "-")}.pdf`, buffer: Buffer.concat(chunks) }));

    const x = 46;
    const width = doc.page.width - 92;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text("SURAT SERAH TERIMA", x, 40, { width, align: "center", characterSpacing: 2.5 });
    doc.lineWidth(1.4).moveTo(x, 68).lineTo(x + width, 68).stroke();
    doc.font("Helvetica").fontSize(10).text(`Nomor      : ${surat.nomor}`, x, 84).text(`${CITY}, ${surat.tanggal}`, x + width - 220, 84, { width: 220, align: "right" });
    doc.text("Telah diterima dari :", x, 108);
    let y = identityTable(doc, surat, x, 126, width) + 14;

    doc.rect(x, y, width, 58).stroke().font("Helvetica-Bold").text("Keterangan", x + 10, y + 10).font("Helvetica").text(surat.keterangan, x + 10, y + 27, { width: width - 20 });
    y += 72;
    const assets = (surat.aset ?? []).filter((item): item is Aset => typeof item !== "string");
    if (assets.length) {
      doc.rect(x, y, width, 25 + assets.length * 22).stroke().font("Helvetica-Bold").text("Aset", x + 10, y + 8);
      assets.forEach((asset, index) => doc.font("Helvetica").text(`${asset.kode} — ${asset.nama} — Rp ${asset.nilai.toLocaleString("id-ID")} — ${asset.kondisi}`, x + 10, y + 29 + index * 22, { width: width - 20 }));
      y += 39 + assets.length * 22;
    }
    doc.font("Helvetica").text(statements[surat.kategori], x, y, { width, align: "justify" });
    y = doc.y + 14;
    doc.rect(x, y, width, 48).stroke().font("Helvetica-Bold").text("Kategori", x + 10, y + 9).font("Helvetica").text(`${surat.kategori === "penyerahan" ? "☒" : "☐"} Penyerahan     ${surat.kategori === "pengembalian" ? "☒" : "☐"} Pengembalian`, x + 10, y + 27);
    signature(doc, x, Math.min(y + 75, 670), width, surat);
    doc.end();
  });
}
