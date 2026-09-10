const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function nextNomor(daftarNomor: string[], sekarang = new Date()) {
  const tahun = sekarang.getFullYear();
  const pola = new RegExp(`^(\\d+)/SRT-ST/${tahun}$`);
  const maks = daftarNomor.reduce((nilai, nomor) => {
    const cocok = pola.exec(nomor);
    return cocok ? Math.max(nilai, Number.parseInt(cocok[1], 10)) : nilai;
  }, 0);
  const pad = (nilai: number) => String(nilai).padStart(2, "0");
  return {
    nomor: `${String(maks + 1).padStart(3, "0")}/SRT-ST/${tahun}`,
    tanggal: `${sekarang.getDate()} ${BULAN[sekarang.getMonth()]} ${tahun}`,
    tanggalSingkat: `${pad(sekarang.getDate())}/${pad(sekarang.getMonth() + 1)}/${tahun}`,
  };
}
