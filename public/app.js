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
    <p class="teks">Telah terima Dari :</p>
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
    <div class="isi pernyataan">${pernyataan}</div>
    <div class="kotak">
      <div class="judul-kotak">Kategori</div>
      <div class="isi kat">
        <span class="cek"><span class="cek-box${isPS ? ' cek-isi' : ''}"></span>Penyerahan</span>
        <span class="cek"><span class="cek-box${!isPS ? ' cek-isi' : ''}"></span>Pengembalian</span>
      </div>
    </div>
    <div class="ttd3">
      <div class="ttd-col">
        <div>Yang Menyerahkan,</div>
        <div class="garis"></div>
        <div>(${escapeHtml(s.nama)})</div>
      </div>
      <div class="ttd-col">
        <div>Yang Menerima,</div>
        <div class="garis"></div>
        <div>(${escapeHtml(s.penerima)})</div>
      </div>
      <div class="ttd-col">
        <div>HRD,</div>
        <div class="garis"></div>
        <div>(................)</div>
      </div>
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
    formSection.hidden = true;
    suratSection.hidden = false;
    form.reset();
    form.kategori.value = 'penyerahan';
    resetEdit();
    muatRiwayat();
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
  resetEdit();
});

document.getElementById('btn-cetak').addEventListener('click', () => window.print());

document.getElementById('btn-baru').addEventListener('click', () => {
  resetEdit();
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
      <td class="aksi">
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
  if (act === 'edit') {
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

muatConfig();
muatRiwayat();
