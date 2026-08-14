const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} = require('docx');

const FONT = 'Times New Roman';

function p(children, opts = {}) {
  return new Paragraph({
    children: children.map((t) => (t instanceof TextRun ? t : new TextRun(t))),
    alignment: opts.alignment,
    spacing: opts.spacing,
    border: opts.border,
  });
}

const SINGLE = { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 1 };

function borderPenuh(style = BorderStyle.SINGLE, size = 4) {
  return { top: { ...SINGLE, size }, bottom: { ...SINGLE, size }, left: { ...SINGLE, size }, right: { ...SINGLE, size } };
}

function borderKosong() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 },
  };
}

const marginSel = { top: 100, bottom: 100, left: 120, right: 120 };

function teks(t, extra = {}) {
  return new TextRun({ text: t, font: FONT, size: 24, ...extra });
}

function buatIsi(pernyataan) {
  return [
    p([teks('SURAT SERAH TERIMA', { bold: true, size: 32 })], {
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.DOUBLE, size: 8, color: '000000', space: 2 } },
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: marginSel,
              borders: borderKosong(),
              children: [p([teks('Nomor     : ................................')], {})],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: marginSel,
              borders: borderKosong(),
              children: [p([teks('Tangerang, ................................')], { alignment: AlignmentType.RIGHT })],
            }),
          ],
        }),
      ],
    }),

    p([teks('Telah terima Dari :')], { spacing: { before: 160, after: 100 } }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: borderPenuh(),
      rows: [
        'Nama yang Menyerahkan',
        'Departemen Penyerah',
        'Nama yang Menerima',
        'Departemen Penerima',
      ].map((label) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
              margins: marginSel,
              borders: borderPenuh(),
              children: [p([teks(label, { bold: true })], {})],
            }),
            new TableCell({
              width: { size: 68, type: WidthType.PERCENTAGE },
              margins: marginSel,
              borders: borderPenuh(),
              children: [p([teks('')], { spacing: { before: 120, after: 120 } })],
            }),
          ],
        })
      ),
    }),

    p([teks('Keterangan', { bold: true })], { spacing: { before: 160, after: 60 } }),
    p([teks('')], { border: borderPenuh(), spacing: { before: 700, after: 700 } }),

    p([teks(pernyataan)], {
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 160, after: 100 },
    }),

    p([teks('□ Penyerahan                  □ Pengembalian')], {
      border: borderPenuh(),
      spacing: { before: 80, after: 80 },
    }),

    p([teks('')], { spacing: { before: 200 } }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ['Yang Menyerahkan,', 'Yang Menerima,', 'HRD,'].map((label) =>
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              margins: marginSel,
              borders: borderKosong(),
              children: [
                p([teks(label)], { alignment: AlignmentType.CENTER }),
                p([teks('')], { spacing: { before: 500 } }),
                p([teks('')], { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } } }),
                p([teks('(.....................................)')], { alignment: AlignmentType.CENTER, spacing: { before: 120 } }),
              ],
            })
          ),
        }),
      ],
    }),
  ];
}

const PERNYATAAN = {
  penyerahan:
    'Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas TELAH DISERAHKAN oleh yang bersangkutan untuk diterima dan dikelola sesuai ketentuan yang berlaku.',
  pengembalian:
    'Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas TELAH DIKEMBALIKAN oleh yang bersangkutan dan telah diterima kembali dalam kondisi yang baik.',
};

function buatDokumen(pernyataan) {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: buatIsi(pernyataan),
      },
    ],
  });
}

const PILIH = (process.argv[2] || '').toLowerCase();

Promise.all(
  [
    { nama: 'SURAT-SERAH-TERIMA-Template.docx', pernyataan: PERNYATAAN.penyerahan, kunci: 'penyerahan' },
    { nama: 'SURAT-SERAH-TERIMA-Pengembalian-Template.docx', pernyataan: PERNYATAAN.pengembalian, kunci: 'pengembalian' },
  ]
    .filter((o) => !PILIH || o.kunci === PILIH)
    .map(async (o) => {
      const buf = await Packer.toBuffer(buatDokumen(o.pernyataan));
      const file = path.join(__dirname, o.nama);
      fs.writeFileSync(file, buf);
      console.log('OK:', file, `(${buf.length} byte)`);
    })
).catch((err) => {
  console.error('Gagal:', err);
  process.exit(1);
});
