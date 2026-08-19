const form = document.getElementById('form-surat');
const btnSimpan = document.getElementById('btn-simpan');
const btnBatal = document.getElementById('btn-batal');
const pesan = document.getElementById('pesan');
const formSection = document.getElementById('form-section');
const suratSection = document.getElementById('surat-section');
const suratEl = document.getElementById('surat');
const tbody = document.querySelector('#tabel-riwayat tbody');
const kosong = document.getElementById('kosong');

const LABEL_KATEGORI = { penyerahan: 'Penyerahan', pengembalian: 'Pengembalian' };

let cfg = { kota: 'Tangerang', deptPengelola: 'HR - Umum' };
let editNomor = null;
let semuaRiwayat = [];
let semuaAset = [];
let asetTerpilih = [];
let editAsetKode = null;
let padsTtd = {};
let previewNomor = null;
let sigRiwayat = '';
let sigPreview = '';
let pollJalan = false;
let asetPilihSemua = false;

function ttdSig(ttd) {
  return ttd ? [ttd.menyerahkan, ttd.menerima, ttd.hrd].map((b) => (b ? '1' : '0')).join('') : '000';
}

async function lihatSurat(nomor) {
  try {
    const res = await fetch(`/api/surat/${encodeURIComponent(nomor)}`);
    if (!res.ok) throw new Error('Surat tidak ditemukan.');
    const data = await res.json();
    renderSurat(data);
    previewNomor = data.nomor;
    sigPreview = ttdSig(data.ttd);
    formSection.hidden = true;
    suratSection.hidden = false;
    resetEdit();
    document.getElementById('surat-section').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    tampilPesan(err.message, 'error');
  }
}

async function pollPembaruan() {
  if (pollJalan) return;
  pollJalan = true;
  try {
    const res = await fetch('/api/riwayat');
    if (!res.ok) return;
    const daftar = await res.json();
    const sigBaru = daftar.map((r) => String(r.nomor) + ':' + ttdSig(r.ttd)).join('|');
    if (sigBaru !== sigRiwayat) {
      sigRiwayat = sigBaru;
      semuaRiwayat = daftar;
      tampilRiwayat();
    }
    if (previewNomor && !editNomor && !suratSection.hidden) {
      const baris = daftar.find((r) => String(r.nomor) === String(previewNomor));
      const sigP = baris ? ttdSig(baris.ttd) : '';
      if (sigP !== sigPreview) {
        sigPreview = sigP;
        const satu = await fetch(`/api/surat/${encodeURIComponent(previewNomor)}`);
        if (satu.ok) renderSurat(await satu.json());
      }
    }
  } catch {
    /* abaikan, coba lagi di siklus berikutnya */
  } finally {
    pollJalan = false;
  }
}

const PER_HALAMAN = 10;
let halamanSekarang = 1;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function tampilPesan(teks, tipe) {
  pesan.textContent = teks;
  pesan.className = `pesan ${tipe}`;
  pesan.hidden = false;
}

function formHtml(s) {
  const isPS = s.kategori === 'penyerahan';
  const pernyataan = isPS
    ? 'Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas <strong>TELAH DISERAHKAN</strong> oleh yang bersangkutan untuk diterima dan dikelola sesuai ketentuan yang berlaku.'
    : 'Dengan ini menyatakan bahwa barang/aset sebagaimana keterangan di atas <strong>TELAH DIKEMBALIKAN</strong> oleh yang bersangkutan dan telah diterima kembali dalam kondisi yang baik.';
  return `
    <div class="surat-kop">
      <h2>SURAT SERAH TERIMA</h2>
      <div class="garis-ganda"></div>
      <div class="meta">
        <div class="nomor">Nomor&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${escapeHtml(s.nomor)}</div>
        <div class="kota">${escapeHtml(cfg.kota)}, ${escapeHtml(s.tanggal)}</div>
      </div>
    </div>
    <p class="teks">Telah diterima dari :</p>
    <table class="identitas">
      <tr><td class="k">Nama yang Menyerahkan</td><td>: ${escapeHtml(s.nama)}</td></tr>
      <tr><td class="k">Departemen Penyerah</td><td>: ${escapeHtml(s.departemen)}</td></tr>
      <tr><td class="k">Nama yang Menerima</td><td>: ${escapeHtml(s.penerima)}</td></tr>
      <tr><td class="k">Departemen Penerima</td><td>: ${escapeHtml(s.departemenPenerima)}</td></tr>
    </table>
    <div class="kotak">
      <div class="judul-kotak">Keterangan</div>
      <div class="isi">${escapeHtml(s.keterangan)}</div>
    </div>
    ${s.aset && s.aset.length ? `
    <div class="kotak">
      <div class="judul-kotak">Aset</div>
      <table class="table-aset">
        <tr><th>Kode</th><th>Nama Aset</th><th>Nilai</th><th>Kondisi</th></tr>
        ${s.aset.map((a) => `<tr><td>${escapeHtml(a.kode)}</td><td>${escapeHtml(a.nama || '')}</td><td>${formatRupiah(a.nilai)}</td><td>${escapeHtml(a.kondisi || '')}</td></tr>`).join('')}
      </table>
    </div>` : ''}
    <div class="isi pernyataan">${pernyataan}</div>
    <div class="kotak">
      <div class="judul-kotak">Kategori</div>
      <div class="isi kat">
        <span class="cek"><span class="cek-box${isPS ? ' cek-isi' : ''}"></span>Penyerahan</span>
        <span class="cek"><span class="cek-box${!isPS ? ' cek-isi' : ''}"></span>Pengembalian</span>
      </div>
    </div>
    <div class="ttd3">
      ${ttdKolom('Yang Menyerahkan,', s.nama, s.ttd && s.ttd.menyerahkan, 'menyerahkan')}
      ${ttdKolom('Yang Menerima,', s.penerima, s.ttd && s.ttd.menerima, 'menerima')}
      ${ttdKolom('HRD,', s.namaHrd || '', s.ttd && s.ttd.hrd, 'hrd')}
    </div>
    <div class="ttd-status">
      ${['menyerahkan', 'menerima', 'hrd'].map((k) =>
        `<span class="ttd-badge${s.ttd && s.ttd[k] ? ' oke' : ''}">${escapeHtml(LABEL_TTD[k])}${s.ttd && s.ttd[k] ? ' ✓' : ''}</span>`
      ).join('')}
    </div>
    <div class="bagikan">
      <div class="bagikan-info">
        <strong>Minta tanda tangan di HP lain</strong>
        <p>Pilih pihak, kirim tautan/QR; pihak tersebut membuka di HP-nya lalu menandatangani sendiri.</p>
        <div class="pihak-tab" id="pihak-tab">
          <button type="button" class="tab" data-pihak="menyerahkan">Menyerahkan</button>
          <button type="button" class="tab aktif" data-pihak="menerima">Menerima</button>
          <button type="button" class="tab" data-pihak="hrd">HRD</button>
        </div>
        <div class="baris-tautan">
          <input type="text" id="tautan-ttd" readonly value="${escapeHtml(ttdShareUrl(s.nomor, 'menerima'))}">
          <button type="button" id="salin-tautan">Salin</button>
        </div>
      </div>
      <img class="qr" id="qr-ttd" src="/api/surat/${encodeURIComponent(s.nomor)}/qr?pihak=menerima" alt="QR tanda tangan">
    </div>`;
}

const LABEL_TTD = { menyerahkan: 'Menyerahkan', menerima: 'Menerima', hrd: 'HRD' };

function ttdShareUrl(nomor, pihak) {
  let url = location.origin + '/ttd.html?nomor=' + encodeURIComponent(nomor);
  if (pihak) url += '&pihak=' + encodeURIComponent(pihak);
  return url;
}

function ttdMarks(ttd) {
  return ['menyerahkan', 'menerima', 'hrd']
    .map((k) => (ttd && ttd[k] ? '<b class="ok">✓</b>' : '<span class="no">·</span>'))
    .join('');
}

function ttdKolom(label, nama, dataUrl, pihak) {
  return `
    <div class="ttd-col">
      <div>${label}</div>
      <div class="ttd-slot">${dataUrl ? `<img class="ttd-img" src="${dataUrl}" alt="ttd">` : ''}</div>
      <div class="garis"></div>
      <div>${nama ? '(' + escapeHtml(nama) + ')' : '(................)'}</div>
    </div>`;
}

function renderSurat(s) {
  suratEl.innerHTML = formHtml(s);
}

function resetEdit() {
  editNomor = null;
  btnBatal.hidden = true;
  btnSimpan.textContent = 'Simpan & Tampilkan Surat';
}

function mulaiEdit(r) {
  editNomor = r.nomor;
  form.nama.value = r.nama || '';
  form.departemen.value = r.departemen || '';
  form.penerima.value = r.penerima || '';
  form['departemen-penerima'].value = r.departemenPenerima || '';
  form.keterangan.value = r.keterangan || '';
  form.kategori.value = r.kategori === 'pengembalian' ? 'pengembalian' : 'penyerahan';
  form['nama-hrd'].value = r.namaHrd || '';
  asetTerpilih = (r.aset || []).slice();
  cariAsetEl.value = '';
  asetPilihSemua = false;
  renderDaftarAsetPilih();
  bersihkanSemuaPad();
  pesan.hidden = true;
  formSection.hidden = false;
  suratSection.hidden = true;
  btnSimpan.textContent = 'Simpan Perubahan';
  btnBatal.hidden = false;
  formSection.scrollIntoView({ behavior: 'smooth' });
  form.nama.focus();
}

async function hapusSurat(nomor) {
  if (!confirm(`Hapus surat ${nomor}? Data akan dihapus dari Excel dan PDF.`)) return;
  const res = await fetch(`/api/surat/${encodeURIComponent(nomor)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    tampilPesan(data.error || 'Gagal menghapus.', 'error');
    return;
  }
  if (editNomor === nomor) resetEdit();
  muatRiwayat();
}

function ambilPayload() {
  return {
    nama: form.nama.value,
    departemen: form.departemen.value,
    penerima: form.penerima.value,
    departemenPenerima: form['departemen-penerima'].value,
    keterangan: form.keterangan.value,
    kategori: form.kategori.value,
    aset: asetTerpilih,
    namaHrd: form['nama-hrd'].value.trim(),
    ttd: {
      menyerahkan: captureTtd('menyerahkan'),
      menerima: captureTtd('menerima'),
      hrd: captureTtd('hrd'),
    },
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  pesan.hidden = true;
  btnSimpan.disabled = true;
  btnSimpan.textContent = 'Menyimpan...';

  const url = editNomor ? `/api/surat/${encodeURIComponent(editNomor)}` : '/api/surat';
  const method = editNomor ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ambilPayload()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan surat.');

    renderSurat(data);
    previewNomor = data.nomor;
    sigPreview = ttdSig(data.ttd);
    formSection.hidden = true;
    suratSection.hidden = false;
    form.reset();
    form.kategori.value = 'penyerahan';
    asetTerpilih = [];
    cariAsetEl.value = '';
    asetPilihSemua = false;
    renderDaftarAsetPilih();
    bersihkanSemuaPad();
    resetEdit();
    muatRiwayat();
    muatAset();
  } catch (err) {
    tampilPesan(err.message, 'error');
  } finally {
    btnSimpan.disabled = false;
    btnSimpan.textContent = editNomor ? 'Simpan Perubahan' : 'Simpan & Tampilkan Surat';
  }
});

btnBatal.addEventListener('click', () => {
  form.reset();
  form.kategori.value = 'penyerahan';
  asetTerpilih = [];
  cariAsetEl.value = '';
  asetPilihSemua = false;
  renderDaftarAsetPilih();
  bersihkanSemuaPad();
  resetEdit();
});

document.getElementById('btn-cetak').addEventListener('click', () => window.print());

suratEl.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('#pihak-tab .tab');
  if (tabBtn) {
    const pihak = tabBtn.dataset.pihak;
    suratEl.querySelectorAll('#pihak-tab .tab').forEach((t) => t.classList.toggle('aktif', t === tabBtn));
    const params = new URLSearchParams(document.getElementById('tautan-ttd').value.split('?')[1] || '');
    const nomor = params.get('nomor') || '';
    document.getElementById('tautan-ttd').value = ttdShareUrl(nomor, pihak);
    const qr = document.getElementById('qr-ttd');
    qr.src = '/api/surat/' + encodeURIComponent(nomor) + '/qr?pihak=' + pihak + '&t=' + Date.now();
    return;
  }
  if (e.target.id === 'salin-tautan') {
    const input = document.getElementById('tautan-ttd');
    input.select();
    if (navigator.clipboard) navigator.clipboard.writeText(input.value).catch(() => {});
    e.target.textContent = 'Tersalin ✓';
    setTimeout(() => (e.target.textContent = 'Salin'), 1600);
  }
});

document.getElementById('btn-baru').addEventListener('click', () => {
  resetEdit();
  form.reset();
  form.kategori.value = 'penyerahan';
  bersihkanSemuaPad();
  previewNomor = null;
  suratSection.hidden = true;
  formSection.hidden = false;
  document.getElementById('nama').focus();
});

document.getElementById('cari').addEventListener('input', () => {
  halamanSekarang = 1;
  tampilRiwayat();
});
document.getElementById('filter-kategori').addEventListener('change', () => {
  halamanSekarang = 1;
  tampilRiwayat();
});
document.getElementById('paginasi').addEventListener('click', (e) => {
  if (e.target.id === 'pg-prev' && halamanSekarang > 1) {
    halamanSekarang--;
    tampilRiwayat();
  } else if (e.target.id === 'pg-next') {
    halamanSekarang++;
    tampilRiwayat();
  }
});
document.getElementById('btn-unduh').addEventListener('click', () => {
  window.open('/api/riwayat/download', '_blank');
});

function bangunDatalistDepartemen() {
  const dl = document.getElementById('daftar-departemen');
  dl.innerHTML = '';
  (cfg.departemen || []).forEach((d) => {
    const o = document.createElement('option');
    o.value = d;
    dl.appendChild(o);
  });
}

function tampilRiwayat() {
  const q = document.getElementById('cari').value.toLowerCase().trim();
  const k = document.getElementById('filter-kategori').value;

  let data = semuaRiwayat;
  if (k) data = data.filter((r) => r.kategori === k);
  if (q) {
    data = data.filter((r) =>
      [r.nomor, r.tanggal, r.tanggalSingkat, r.nama, r.penerima, r.departemen, r.departemenPenerima, r.keterangan]
        .join(' ').toLowerCase().includes(q)
    );
  }

  const total = data.length;
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  if (halamanSekarang > totalHalaman) halamanSekarang = totalHalaman;
  const mulai = (halamanSekarang - 1) * PER_HALAMAN;
  const dataHal = data.slice(mulai, mulai + PER_HALAMAN);

  tbody.innerHTML = '';
  kosong.hidden = data.length > 0;
  kosong.textContent = 'Tidak ada data yang cocok.';

  dataHal.forEach((r) => {
    const tr = document.createElement('tr');
    const nomor = escapeHtml(r.nomor);
    tr.innerHTML = `
      <td>${escapeHtml(r.no)}</td>
      <td>${nomor}</td>
      <td>${escapeHtml(r.tanggal)}</td>
      <td>${escapeHtml(LABEL_KATEGORI[r.kategori] || r.kategori)}</td>
      <td>${escapeHtml(r.nama)}</td>
      <td>${escapeHtml(r.departemen)}</td>
      <td>${escapeHtml(r.penerima)}</td>
      <td>${escapeHtml(r.departemenPenerima)}</td>
      <td>${escapeHtml(r.keterangan)}</td>
      <td>${escapeHtml((r.aset || []).join(', '))}</td>
      <td class="ttd-cell">${ttdMarks(r.ttd)}</td>
      <td class="aksi">
        <button class="btn-aksi" data-nomor="${nomor}" data-act="detail">Detail</button>
        <button class="btn-aksi" data-nomor="${nomor}" data-act="edit">Edit</button>
        <button class="btn-aksi hapus" data-nomor="${nomor}" data-act="hapus">Hapus</button>
      </td>`;
    tbody.appendChild(tr);
  });

  renderPaginasi(total, mulai, totalHalaman);
}

function renderPaginasi(total, mulai, totalHalaman) {
  const el = document.getElementById('paginasi');
  if (total === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <button type="button" class="btn-pag" id="pg-prev" ${halamanSekarang <= 1 ? 'disabled' : ''}>‹ Sebelumnya</button>
    <span class="pg-info">${mulai + 1}–${Math.min(mulai + PER_HALAMAN, total)} dari ${total}</span>
    <button type="button" class="btn-pag" id="pg-next" ${halamanSekarang >= totalHalaman ? 'disabled' : ''}>Berikutnya ›</button>`;
}

tbody.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const nomor = btn.dataset.nomor;
  const act = btn.dataset.act;
  if (act === 'detail') {
    lihatSurat(nomor);
  } else if (act === 'edit') {
    const r = semuaRiwayat.find((x) => String(x.nomor) === String(nomor));
    if (r) mulaiEdit(r);
  } else if (act === 'hapus') {
    hapusSurat(nomor);
  }
});

function hitungStatistik() {
  const total = semuaRiwayat.length;
  const now = new Date();
  const thn = now.getFullYear();
  const bln = String(now.getMonth() + 1).padStart(2, '0');
  let bulan = 0;
  let ps = 0;
  let pk = 0;
  semuaRiwayat.forEach((r) => {
    if (r.kategori === 'penyerahan') ps++;
    else if (r.kategori === 'pengembalian') pk++;
    const t = String(r.tanggalSingkat || '');
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
      const m = t.split('/')[1];
      const y = t.split('/')[2];
      if (y === String(thn) && m === bln) bulan++;
    }
  });
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-bulan').textContent = bulan;
  document.getElementById('stat-ps').textContent = ps;
  document.getElementById('stat-pk').textContent = pk;
}

async function muatRiwayat() {
  try {
    const res = await fetch('/api/riwayat');
    semuaRiwayat = await res.json();
    sigRiwayat = semuaRiwayat.map((r) => String(r.nomor) + ':' + ttdSig(r.ttd)).join('|');
    tampilRiwayat();
    hitungStatistik();
  } catch {
    kosong.textContent = 'Gagal memuat riwayat.';
    kosong.hidden = false;
  }
}

async function muatConfig() {
  try {
    const res = await fetch('/api/config');
    cfg = await res.json();
    bangunDatalistDepartemen();
  } catch {
    /* pakai nilai bawaan */
  }
}

// --- Kelola Aset ---
const cariAsetEl = document.getElementById('cari-aset');
const asetPilihEl = document.getElementById('daftar-aset-pilih');
const infoAsetPilih = document.getElementById('info-aset-pilih');
const tbodyAset = document.querySelector('#tabel-aset tbody');
const formAsetWrap = document.getElementById('form-aset-wrap');

const LABEL_STATUS = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  perbaikan: 'Dalam Perbaikan',
  rusak: 'Rusak',
  hilang: 'Hilang',
  dihapus: 'Dihapus',
};
const LABEL_KONDISI = {
  baru: 'Baru',
  'sangat-baik': 'Sangat Baik',
  baik: 'Baik',
  cukup: 'Cukup',
  'rusak-ringan': 'Rusak Ringan',
  'rusak-berat': 'Rusak Berat',
};

function formatRupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function formatRibuan(teks) {
  const digit = String(teks || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
  return digit ? digit.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

function formatNilaiInput() {
  document.getElementById('aset-nilai').value = formatRibuan(document.getElementById('aset-nilai').value);
}

const LIMIT_PILIH_ASET = 15;
const URUT_STATUS = { tersedia: 0, dipakai: 1, perbaikan: 2, rusak: 3, hilang: 4, dihapus: 5 };

function renderDaftarAsetPilih() {
  const q = cariAsetEl.value.toLowerCase().trim();
  let filtered = semuaAset.filter((a) =>
    [a.kode, a.nama, a.kategori].join(' ').toLowerCase().includes(q)
  );
  filtered.sort(
    (a, b) =>
      (URUT_STATUS[a.status] ?? 9) - (URUT_STATUS[b.status] ?? 9) ||
      String(a.kode).localeCompare(String(b.kode), undefined, { numeric: true })
  );
  const total = filtered.length;
  const tampilSemua = asetPilihSemua || q !== '';
  const daftar = tampilSemua ? filtered : filtered.slice(0, LIMIT_PILIH_ASET);

  asetPilihEl.innerHTML = '';
  if (total === 0) {
    asetPilihEl.innerHTML = '<div class="kosong-pilih">Tidak ada aset. Tambah dulu lewat Kelola Aset.</div>';
    return;
  }
  daftar.forEach((a) => {
    const label = document.createElement('label');
    label.classList.toggle('dipakai-warn', a.status === 'dipakai');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = asetTerpilih.includes(a.kode);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!asetTerpilih.includes(a.kode)) asetTerpilih.push(a.kode);
      } else {
        asetTerpilih = asetTerpilih.filter((k) => k !== a.kode);
      }
      infoAsetPilih.textContent = `${asetTerpilih.length} aset dipilih`;
      infoAsetPilih.className = 'pesan';
      infoAsetPilih.hidden = asetTerpilih.length === 0;
    });
    const span = document.createElement('span');
    span.textContent = `${a.kode} — ${a.nama}${a.nilai ? ' · ' + formatRupiah(a.nilai) : ''}`;
    const badge = document.createElement('span');
    badge.className = `badge ${a.status}`;
    badge.textContent = LABEL_STATUS[a.status] || a.status;
    if (a.status === 'dipakai') badge.title = 'Sedang dipakai oleh surat lain';
    label.append(cb, span, badge);
    asetPilihEl.appendChild(label);
  });

  const footer = document.createElement('div');
  footer.className = 'pilih-footer';
  if (total > LIMIT_PILIH_ASET && !tampilSemua) {
    footer.append(`Menampilkan ${LIMIT_PILIH_ASET} dari ${total} aset. `);
    const tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'pilih-tombol';
    tombol.textContent = `Tampilkan semua (${total})`;
    tombol.addEventListener('click', () => {
      asetPilihSemua = true;
      renderDaftarAsetPilih();
    });
    footer.appendChild(tombol);
  } else if (total > LIMIT_PILIH_ASET) {
    footer.textContent = `Menampilkan semua (${total} aset). Ketik kata kunci untuk mempersempit.`;
  } else if (total > 0) {
    footer.textContent = `${total} aset tersedia.`;
  }
  asetPilihEl.appendChild(footer);
}

function renderTabelAset() {
  const q = document.getElementById('cari-aset-admin').value.toLowerCase().trim();
  const filtered = semuaAset.filter((a) =>
    [a.kode, a.nama, a.kategori].join(' ').toLowerCase().includes(q)
  );
  tbodyAset.innerHTML = '';
  document.getElementById('kosong-aset').hidden = semuaAset.length > 0;
  filtered.forEach((a) => {
    const tr = document.createElement('tr');
    const kode = escapeHtml(a.kode);
    tr.innerHTML = `
      <td>${kode}</td>
      <td>${escapeHtml(a.nama)}</td>
      <td>${escapeHtml(a.kategori)}</td>
      <td>${formatRupiah(a.nilai)}</td>
      <td>${escapeHtml(LABEL_KONDISI[a.kondisi] || a.kondisi)}</td>
      <td><span class="badge ${a.status}">${escapeHtml(LABEL_STATUS[a.status] || a.status)}</span></td>
      <td class="aksi">
        <button class="btn-aksi" data-kode="${kode}" data-act="riwayat">Riwayat</button>
        <button class="btn-aksi" data-kode="${kode}" data-act="edit">Edit</button>
        <button class="btn-aksi hapus" data-kode="${kode}" data-act="hapus">Hapus</button>
      </td>`;
    tbodyAset.appendChild(tr);
  });
}

function kodeAsetOtomatis(kategori) {
  const seg =
    String(kategori || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ASET';
  let maks = 0;
  const pola = new RegExp(`^INV/${seg.replace(/[-/\\]/g, '\\-')}-(\\d+)$`);
  semuaAset.forEach((a) => {
    const m = pola.exec(String(a.kode).toUpperCase());
    if (m) maks = Math.max(maks, parseInt(m[1], 10));
  });
  return `INV/${seg}-${String(maks + 1).padStart(3, '0')}`;
}

function isiFormAset(a) {
  document.getElementById('aset-kode').value = (a && a.kode) || '';
  document.getElementById('aset-nama').value = (a && a.nama) || '';
  document.getElementById('aset-kategori').value = (a && a.kategori) || '';
  document.getElementById('aset-nilai').value = a && a.nilai ? formatRibuan(String(a.nilai)) : '';
  document.getElementById('aset-kondisi').value = (a && a.kondisi) || 'baru';
  document.getElementById('aset-status').value = (a && a.status) || 'tersedia';
}

function bukaFormAset(a) {
  editAsetKode = a ? a.kode : null;
  document.getElementById('judul-form-aset').textContent = a ? 'Edit Aset' : 'Tambah Aset';
  isiFormAset(a);
  if (!a) {
    document.getElementById('aset-kode').value = kodeAsetOtomatis(document.getElementById('aset-kategori').value);
  }
  formAsetWrap.hidden = false;
  document.getElementById('pesan-aset').hidden = true;
  document.getElementById('aset-nama').focus();
}

function tutupFormAset() {
  editAsetKode = null;
  formAsetWrap.hidden = true;
}

async function simpanAset() {
  const pesanAset = document.getElementById('pesan-aset');
  pesanAset.hidden = true;
  const payload = {
    kode: document.getElementById('aset-kode').value.trim(),
    nama: document.getElementById('aset-nama').value.trim(),
    kategori: document.getElementById('aset-kategori').value.trim(),
    nilai: document.getElementById('aset-nilai').value.replace(/\D/g, ''),
    kondisi: document.getElementById('aset-kondisi').value,
    status: document.getElementById('aset-status').value,
  };
  const url = editAsetKode ? `/api/aset/${encodeURIComponent(editAsetKode)}` : '/api/aset';
  const method = editAsetKode ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan aset.');
    tutupFormAset();
    await muatAset();
  } catch (err) {
    pesanAset.textContent = err.message;
    pesanAset.className = 'pesan error';
    pesanAset.hidden = false;
  }
}

async function hapusAsetAdmin(kode) {
  if (!confirm(`Hapus aset ${kode}? Riwayat keterkaitannya ikut terhapus.`)) return;
  const res = await fetch(`/api/aset/${encodeURIComponent(kode)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Gagal menghapus aset.');
    return;
  }
  asetTerpilih = asetTerpilih.filter((k) => k !== kode);
  await muatAset();
}

async function lihatRiwayatAset(kode) {
  const aset = semuaAset.find((a) => a.kode === kode);
  try {
    const res = await fetch(`/api/aset/${encodeURIComponent(kode)}/riwayat`);
    const data = await res.json();
    document.getElementById('modal-aset-judul').textContent =
      `Riwayat Aset: ${kode}${aset ? ' — ' + aset.nama : ''}`;
    const isi = document.getElementById('modal-aset-isi');
    if (!Array.isArray(data) || data.length === 0) {
      isi.innerHTML = '<p class="pesan">Belum ada surat yang terkait aset ini.</p>';
    } else {
      isi.innerHTML = '<ul>' + data.map((s) =>
        `<li>${escapeHtml(s.nomor)} — ${escapeHtml(LABEL_KATEGORI[s.kategori] || s.kategori)} — ${escapeHtml(s.tanggal)}<br><small>${escapeHtml(s.nama)} → ${escapeHtml(s.penerima)}</small></li>`
      ).join('') + '</ul>';
    }
    document.getElementById('modal-aset').hidden = false;
  } catch {
    alert('Gagal memuat riwayat aset.');
  }
}

function perbaruiStatAset() {
  const dipakai = semuaAset.filter((a) => a.status === 'dipakai').length;
  document.getElementById('stat-aset-dipakai').textContent = dipakai;
}

async function muatAset() {
  try {
    const res = await fetch('/api/aset');
    semuaAset = await res.json();
    renderTabelAset();
    renderDaftarAsetPilih();
    perbaruiStatAset();
    const kategori = [...new Set(semuaAset.map((a) => a.kategori).filter(Boolean))];
    document.getElementById('daftar-kategori-aset').innerHTML =
      kategori.map((k) => `<option value="${escapeHtml(k)}">`).join('');
  } catch {
    /* biarkan */
  }
}

function inisialisasiPad() {
  const pads = {};
  document.querySelectorAll('.ttd-pad').forEach((canvas) => {
    const pihak = canvas.dataset.pihak;
    const pad = { canvas, ctx: canvas.getContext('2d'), isi: false, menggambar: false };
    canvas.addEventListener('pointerdown', (e) => {
      const { x, y } = posisiPad(e, pad.canvas);
      pad.ctx.strokeStyle = '#1e293b';
      pad.ctx.lineWidth = 2.5;
      pad.ctx.lineCap = 'round';
      pad.ctx.lineJoin = 'round';
      pad.ctx.beginPath();
      pad.ctx.moveTo(x, y);
      pad.ctx.lineTo(x + 0.1, y + 0.1);
      pad.ctx.stroke();
      pad.menggambar = true;
      pad.isi = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pad.menggambar) return;
      const { x, y } = posisiPad(e, pad.canvas);
      pad.ctx.lineTo(x, y);
      pad.ctx.stroke();
    });
    canvas.addEventListener('pointerup', () => (pad.menggambar = false));
    canvas.addEventListener('pointerleave', () => (pad.menggambar = false));
    pads[pihak] = pad;
  });
  return pads;
}

function posisiPad(e, canvas) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function hapusPad(pad) {
  pad.ctx.fillStyle = '#ffffff';
  pad.ctx.fillRect(0, 0, pad.canvas.width, pad.canvas.height);
  pad.isi = false;
  pad.menggambar = false;
}

function bersihkanSemuaPad() {
  Object.values(padsTtd).forEach(hapusPad);
}

function unggahPad(pad, file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const ctx = pad.ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pad.canvas.width, pad.canvas.height);
    const skala = Math.min(pad.canvas.width / img.width, pad.canvas.height / img.height);
    const w = img.width * skala;
    const h = img.height * skala;
    ctx.drawImage(img, (pad.canvas.width - w) / 2, (pad.canvas.height - h) / 2, w, h);
    URL.revokeObjectURL(url);
    pad.isi = true;
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function captureTtd(pihak) {
  const pad = padsTtd[pihak];
  if (!pad || !pad.isi) return '';
  return pad.canvas.toDataURL('image/png');
}

padsTtd = inisialisasiPad();
document.querySelectorAll('.ttd-unggah').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector(`.ttd-file[data-pihak="${btn.dataset.pihak}"]`).click();
  });
});
document.querySelectorAll('.ttd-file').forEach((input) => {
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) unggahPad(padsTtd[input.dataset.pihak], input.files[0]);
    input.value = '';
  });
});
document.querySelectorAll('.ttd-hapus').forEach((btn) => {
  btn.addEventListener('click', () => hapusPad(padsTtd[btn.dataset.pihak]));
});

document.getElementById('btn-aset-baru').addEventListener('click', () => bukaFormAset(null));
document.getElementById('btn-aset-batal').addEventListener('click', tutupFormAset);
document.getElementById('btn-aset-simpan').addEventListener('click', simpanAset);
document.getElementById('cari-aset-admin').addEventListener('input', renderTabelAset);
cariAsetEl.addEventListener('input', () => {
  asetPilihSemua = false;
  renderDaftarAsetPilih();
});
document.getElementById('aset-kategori').addEventListener('input', () => {
  if (!editAsetKode) {
    document.getElementById('aset-kode').value = kodeAsetOtomatis(document.getElementById('aset-kategori').value);
  }
});
document.getElementById('aset-nilai').addEventListener('input', formatNilaiInput);
tbodyAset.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const kode = btn.dataset.kode;
  const act = btn.dataset.act;
  if (act === 'riwayat') lihatRiwayatAset(kode);
  else if (act === 'edit') {
    const a = semuaAset.find((x) => x.kode === kode);
    if (a) bukaFormAset(a);
  } else if (act === 'hapus') hapusAsetAdmin(kode);
});
document.getElementById('btn-modal-tutup').addEventListener('click', () => {
  document.getElementById('modal-aset').hidden = true;
});
document.getElementById('modal-aset').addEventListener('click', (e) => {
  if (e.target.id === 'modal-aset') document.getElementById('modal-aset').hidden = true;
});

muatConfig();
muatRiwayat();
muatAset();
setInterval(pollPembaruan, 4000);
