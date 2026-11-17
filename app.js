'use strict';

/* ================= PENGATURAN ================= */
// Opsional: isi alamat Web App di sini agar tidak perlu mengetik di HP. Boleh dikosongkan.
const URL_SERVER_AWAL = '';
const KATEGORI_TABUNGAN = ['Tabungan Kuliah PPAr', 'Tabungan'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const NAMA_BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const KUNCI = { url: 'keuangan.url', kode: 'keuangan.kode', metode: 'keuangan.metode' };
const JUDUL = { beranda: 'Beranda', analisis: 'Analisis', riwayat: 'Riwayat', anggaran: 'Anggaran' };
const STATUS = {
  aman: { teks: 'Aman', kelas: 'aman' },
  pas: { teks: 'Tercapai / Pas', kelas: 'pas' },
  lebih: { teks: 'Melebihi Anggaran', kelas: 'lebih' }
};
const GALAT_AKSES = ['KODE_SALAH', 'TERKUNCI', 'BELUM_SETUP'];
const PESAN_NOMINAL = {
  kosong: 'Nominal wajib diisi.',
  negatif: 'Nominal tidak boleh negatif. Isi angka lebih dari 0.',
  besar: 'Nominal terlalu besar.'
};
const SKELETON = '<div class="halaman" aria-busy="true"><div class="sk sk-hero"></div><div class="sk-grid"><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div></div><div class="sk sk-pos"></div><div class="sk sk-pos"></div></div>';

const S = {
  url: '', kode: '', data: null, hariIni: '', bulan: '', halaman: 'beranda',
  memuat: false, menyimpan: false, form: null, hapus: null,
  f: { cari: '', jenis: '', kategori: '', dari: '', sampai: '', semua: false }
};

/* ================= UTILITAS ================= */
const $ = (sel, el) => (el || document).querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const penyimpanan = {
  baca(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  tulis(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } },
  hapus(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
};

const fmtAngka = n => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtRp = n => (n < 0 ? '-' : '') + 'Rp ' + fmtAngka(n);
const fmtPersen = p => Math.round(p * 100) + '%';
const nilaiInput = n => (n < 0 ? '-' : '') + fmtAngka(n);
const kompak = n => {
  const a = Math.abs(n);
  if (a >= 1e6) return (a / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' jt';
  if (a >= 1e3) return Math.round(a / 1e3) + ' rb';
  return String(Math.round(a));
};
const labelBulan = b => NAMA_BULAN[+b.slice(5, 7) - 1] + ' ' + b.slice(0, 4);
const hariDalamBulan = b => new Date(+b.slice(0, 4), +b.slice(5, 7), 0).getDate();
const geserBulan = (b, d) => {
  let y = +b.slice(0, 4);
  let m = +b.slice(5, 7) - 1 + d;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return y + '-' + String(m + 1).padStart(2, '0');
};
const fmtTanggal = t => (t ? (+t.slice(8, 10)) + ' ' + NAMA_BULAN_PENDEK[+t.slice(5, 7) - 1] + ' ' + t.slice(0, 4) : '(tanpa tanggal)');
const kosong = teks => '<div class="kosong"><div class="kosong-ikon" aria-hidden="true">🗒️</div><p>' + esc(teks) + '</p></div>';
const galat = (pesan, kode) => { const e = new Error(pesan); e.kode = kode; return e; };

// Membaca angka rupiah dari teks isian. Titik ribuan diabaikan; tanda minus di depan dikenali agar bisa ditolak.
function bacaRupiah(teks, bolehNegatif) {
  const s = String(teks || '').trim();
  if (!s) return { galat: 'kosong' };
  const negatif = /^[-−–]/.test(s);
  const digit = s.replace(/\D/g, '');
  if (!digit) return { galat: 'kosong' };
  if (digit.length > 12) return { galat: 'besar' };
  const n = Number(digit);
  if (negatif && n !== 0 && !bolehNegatif) return { galat: 'negatif' };
  return { nilai: negatif && n !== 0 ? -n : n };
}

function formatInputRp(el) {
  const s = el.value;
  const minus = /^\s*[-−–]/.test(s) ? '-' : '';
  const digit = s.replace(/\D/g, '').slice(0, 12);
  el.value = digit ? minus + fmtAngka(Number(digit)) : minus;
}

function pesanRp(g, label) {
  if (g === 'kosong') return label + ' wajib diisi (isi 0 jika tidak ada).';
  if (g === 'negatif') return label + ' tidak boleh negatif.';
  return label + ' terlalu besar.';
}

function toast(teks, jenis) {
  const el = document.createElement('div');
  el.className = 'toast ' + (jenis || 'info');
  el.setAttribute('role', jenis === 'gagal' ? 'alert' : 'status');
  el.textContent = (jenis === 'sukses' ? '✓ ' : jenis === 'gagal' ? '⚠ ' : '') + teks;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('keluar');
    setTimeout(() => el.remove(), 320);
  }, jenis === 'gagal' ? 6500 : 3200);
}

/* ================= API ================= */
async function api(aksi, data) {
  const kontrol = new AbortController();
  const timer = setTimeout(() => kontrol.abort(), 30000);
  let res;
  try {
    res = await fetch(S.url, {
      method: 'POST',
      // text/plain agar browser tidak mengirim preflight yang ditolak Apps Script
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ kode: S.kode, aksi: aksi }, data || {})),
      signal: kontrol.signal,
      cache: 'no-store'
    });
  } catch (e) {
    throw galat(e && e.name === 'AbortError'
      ? 'Server terlalu lama menjawab. Coba lagi.'
      : 'Tidak bisa terhubung ke server. Cek koneksi internet, lalu coba lagi.', 'JARINGAN');
  } finally {
    clearTimeout(timer);
  }
  let j;
  try {
    j = await res.json();
  } catch (e) {
    throw galat('Balasan server tidak dikenali. Pastikan alamat Web App benar dan aksesnya diatur ke "Siapa saja".', 'FORMAT');
  }
  if (!j || !j.ok) throw galat((j && j.pesan) || 'Terjadi kesalahan.', (j && j.kode) || 'SERVER');
  return j.data;
}

/* ================= PERHITUNGAN ================= */
function hitungBulan(bulan) {
  const D = S.data;
  const h = { pemasukan: 0, pengeluaran: 0, sebelum: 0, tabungan: 0, jumlah: 0, perKatPeng: {}, perKatPem: {}, harian: {} };
  D.transaksi.forEach(t => {
    if (!t.tanggal) return;
    const masuk = t.jenis === 'Pemasukan';
    if (!masuk && t.jenis !== 'Pengeluaran') return;
    const m = t.tanggal.slice(0, 7);
    if (m < bulan) h.sebelum += masuk ? t.nominal : -t.nominal;
    if (m === bulan) {
      h.jumlah++;
      if (masuk) {
        h.pemasukan += t.nominal;
        h.perKatPem[t.kategori] = (h.perKatPem[t.kategori] || 0) + t.nominal;
      } else {
        h.pengeluaran += t.nominal;
        h.perKatPeng[t.kategori] = (h.perKatPeng[t.kategori] || 0) + t.nominal;
        const hari = +t.tanggal.slice(8, 10);
        h.harian[hari] = (h.harian[hari] || 0) + t.nominal;
      }
    }
    if (m <= bulan && !masuk && KATEGORI_TABUNGAN.indexOf(t.kategori) !== -1) h.tabungan += t.nominal;
  });
  h.saldoAwal = D.anggaran.saldoAwal + h.sebelum;
  h.arus = h.pemasukan - h.pengeluaran;
  h.saldoAkhir = h.saldoAwal + h.arus;
  h.dana = h.tabungan + h.saldoAkhir;
  h.pos = D.anggaran.pos.map(p => {
    const real = h.perKatPeng[p.nama] || 0;
    return {
      nama: p.nama, anggaran: p.anggaran, real: real, sisa: p.anggaran - real,
      persen: p.anggaran > 0 ? real / p.anggaran : 0,
      status: real > p.anggaran ? 'lebih' : (real === p.anggaran ? 'pas' : 'aman')
    };
  });
  h.target = D.anggaran.target.map(t => {
    const real = h.perKatPem[t.nama] || 0;
    return { nama: t.nama, target: t.target, real: real, selisih: real - t.target, persen: t.target > 0 ? real / t.target : 0 };
  });
  return h;
}

function agregatBulanan() {
  const m = {};
  S.data.transaksi.forEach(t => {
    if (!t.tanggal) return;
    const b = t.tanggal.slice(0, 7);
    const x = m[b] || (m[b] = { pem: 0, peng: 0 });
    if (t.jenis === 'Pemasukan') x.pem += t.nominal;
    else if (t.jenis === 'Pengeluaran') x.peng += t.nominal;
  });
  return m;
}

/* ================= TAMPILAN: KERANGKA ================= */
function render(opsi) {
  opsi = opsi || {};
  const hal = S.halaman;
  $('#judulHalaman').textContent = JUDUL[hal];
  $('#bulanNav').hidden = hal === 'anggaran';
  $('#bulanInput').value = S.bulan;
  document.querySelectorAll('.bottomnav button').forEach(b => {
    const aktif = b.dataset.hal === hal;
    b.classList.toggle('aktif', aktif);
    if (aktif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  renderBanner();
  if (!S.data) return;
  const konten = $('#konten');
  if (opsi.animasi) {
    konten.classList.add('masuk');
    setTimeout(() => konten.classList.remove('masuk'), 340);
  }
  konten.innerHTML = ({ beranda: htmlBeranda, analisis: htmlAnalisis, riwayat: htmlRiwayat, anggaran: htmlAnggaran })[hal]();
}

function renderBanner() {
  const b = $('#banner');
  const info = S.data && S.data.info;
  if (info && info.peringatan) {
    b.hidden = false;
    b.className = 'banner ' + (info.penuh ? 'bahaya' : 'waspada');
    b.textContent = info.peringatan;
  } else {
    b.hidden = true;
  }
}

/* ================= TAMPILAN: BERANDA ================= */
function htmlBeranda() {
  const h = hitungBulan(S.bulan);
  const nama = labelBulan(S.bulan);
  const kpi = (label, nilai, nada, lebar) =>
    '<div class="kpi' + (lebar ? ' lebar' : '') + '"><div class="kpi-label">' + label + '</div><div class="kpi-nilai ' + (nada || '') + '">' + fmtRp(nilai) + '</div></div>';
  return '<section class="halaman" aria-label="Ringkasan ' + esc(nama) + '">' +
    '<div class="hero"><div class="hero-label">Saldo Akhir Kas · ' + esc(nama) + '</div>' +
    '<div class="hero-nilai">' + fmtRp(h.saldoAkhir) + '</div>' +
    '<div class="hero-sub">Saldo awal + arus kas bersih bulan ini</div></div>' +
    '<div class="kpi-grid">' +
    kpi('Saldo Awal', h.saldoAwal) +
    kpi('Arus Kas Bersih', h.arus, h.arus < 0 ? 'neg' : 'pos') +
    kpi('Total Pemasukan', h.pemasukan, 'pos') +
    kpi('Total Pengeluaran', h.pengeluaran, 'neg') +
    kpi('Total Dana Tersimpan', h.dana, '', true) +
    '</div>' +
    (h.jumlah === 0 ? kosong('Belum ada transaksi di ' + nama + '. Tekan "+ Tambah Transaksi" untuk mulai mencatat.') : '') +
    '<h2 class="judul-bagian">Anggaran vs Realisasi</h2>' +
    (h.pos.length ? h.pos.map(htmlPos).join('') : kosong('Belum ada pos anggaran di spreadsheet.')) +
    '<h2 class="judul-bagian">Target vs Realisasi Pemasukan</h2>' +
    (h.target.length ? h.target.map(htmlTarget).join('') : kosong('Belum ada target pemasukan di spreadsheet.')) +
    '</section>';
}

function htmlPos(p) {
  const st = STATUS[p.status];
  const lebar = Math.min(p.persen, 1) * 100;
  return '<article class="pos-item"><div class="pos-kepala"><h3>' + esc(p.nama) + '</h3><span class="badge ' + st.kelas + '">' + st.teks + '</span></div>' +
    '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(p.persen, 1) * 100) + '" aria-label="Terpakai ' + fmtPersen(p.persen) + '"><span class="' + st.kelas + '" style="width:' + lebar + '%"></span></div>' +
    '<dl class="pos-angka">' +
    '<div><dt>Anggaran</dt><dd>' + fmtRp(p.anggaran) + '</dd></div>' +
    '<div><dt>Realisasi</dt><dd>' + fmtRp(p.real) + '</dd></div>' +
    '<div><dt>Sisa</dt><dd class="' + (p.sisa < 0 ? 'neg' : '') + '">' + fmtRp(p.sisa) + '</dd></div>' +
    '<div><dt>% Terpakai</dt><dd>' + fmtPersen(p.persen) + '</dd></div>' +
    '</dl></article>';
}

function htmlTarget(t) {
  const lebar = Math.min(t.persen, 1) * 100;
  return '<article class="pos-item"><div class="pos-kepala"><h3>' + esc(t.nama) + '</h3></div>' +
    '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(t.persen, 1) * 100) + '" aria-label="Tercapai ' + fmtPersen(t.persen) + '"><span class="teal" style="width:' + lebar + '%"></span></div>' +
    '<dl class="pos-angka">' +
    '<div><dt>Target</dt><dd>' + fmtRp(t.target) + '</dd></div>' +
    '<div><dt>Realisasi</dt><dd>' + fmtRp(t.real) + '</dd></div>' +
    '<div><dt>Selisih</dt><dd class="' + (t.selisih < 0 ? 'neg' : (t.selisih > 0 ? 'pos' : '')) + '">' + (t.selisih > 0 ? '+' : '') + fmtRp(t.selisih) + '</dd></div>' +
    '<div><dt>% Capaian</dt><dd>' + fmtPersen(t.persen) + '</dd></div>' +
    '</dl></article>';
}

/* ================= TAMPILAN: ANALISIS (INSIGHT + GRAFIK) ================= */
function htmlAnalisis() {
  const h = hitungBulan(S.bulan);
  const kartu = (judul, isi) => '<section class="kartu"><h2>' + judul + '</h2>' + isi + '</section>';
  return '<section class="halaman" aria-label="Analisis ' + esc(labelBulan(S.bulan)) + '">' +
    '<h2 class="judul-bagian">Insight · ' + esc(labelBulan(S.bulan)) + '</h2>' +
    htmlInsight(h) +
    '<h2 class="judul-bagian">Grafik</h2>' +
    kartu('Pengeluaran per kategori', grafikKategori(h)) +
    kartu('Tren pengeluaran harian', grafikHarian(h)) +
    kartu('Pemasukan vs pengeluaran', grafikPemVsPeng(h)) +
    kartu('Perbandingan 6 bulan terakhir', grafikAntarBulan()) +
    '</section>';
}

function htmlInsight(h) {
  const kartu = [];
  const urut = Object.keys(h.perKatPeng).sort((a, b) => h.perKatPeng[b] - h.perKatPeng[a]);
  if (urut.length) {
    const v = h.perKatPeng[urut[0]];
    kartu.push(['🏆', 'Pengeluaran terbesar', urut[0] + ' — ' + fmtRp(v) + ' (' + fmtPersen(v / h.pengeluaran) + ' dari total pengeluaran)', '']);
  } else {
    kartu.push(['🏆', 'Pengeluaran terbesar', 'Belum ada pengeluaran di bulan ini.', '']);
  }

  const bulanIni = S.hariIni.slice(0, 7);
  const hari = S.bulan === bulanIni ? +S.hariIni.slice(8, 10) : hariDalamBulan(S.bulan);
  kartu.push(['📅', 'Rata-rata pengeluaran harian', fmtRp(Math.round(h.pengeluaran / hari)) + ' per hari (dihitung dari ' + hari + ' hari)', '']);

  const prevB = geserBulan(S.bulan, -1);
  const prev = (agregatBulanan()[prevB] || { peng: 0 }).peng;
  let teks, nada = '';
  if (!prev && !h.pengeluaran) {
    teks = 'Belum ada data pengeluaran di bulan ini maupun ' + labelBulan(prevB) + '.';
  } else if (!prev) {
    teks = 'Tidak ada pengeluaran tercatat di ' + labelBulan(prevB) + ', jadi belum bisa dibandingkan.';
  } else {
    const sel = h.pengeluaran - prev;
    if (sel === 0) {
      teks = 'Sama dengan ' + labelBulan(prevB) + ' (' + fmtRp(prev) + ').';
    } else {
      teks = (sel > 0 ? 'Naik ' : 'Turun ') + fmtRp(Math.abs(sel)) + ' (' + fmtPersen(Math.abs(sel) / prev) + ') dibanding ' + labelBulan(prevB) + ' (' + fmtRp(prev) + ').';
      nada = sel > 0 ? 'waspada' : 'aman';
    }
  }
  kartu.push(['📈', 'Dibanding bulan sebelumnya', teks, nada]);

  const lebih = h.pos.filter(p => p.status === 'lebih').sort((a, b) => (b.real - b.anggaran) - (a.real - a.anggaran));
  const hampir = h.pos.filter(p => p.status !== 'lebih' && p.anggaran > 0 && p.persen >= 0.8);
  lebih.forEach(p => kartu.push(['⚠️', 'Melebihi anggaran: ' + p.nama, 'Terpakai ' + fmtRp(p.real) + ' dari ' + fmtRp(p.anggaran) + ', lebih ' + fmtRp(p.real - p.anggaran) + '.', 'bahaya']));
  hampir.forEach(p => kartu.push(['🔔', (p.status === 'pas' ? 'Anggaran habis pas: ' : 'Hampir habis: ') + p.nama, 'Terpakai ' + fmtPersen(p.persen) + ' (' + fmtRp(p.real) + ' dari ' + fmtRp(p.anggaran) + '), sisa ' + fmtRp(p.sisa) + '.', 'waspada']));
  if (!lebih.length && !hampir.length) {
    kartu.push(['✅', 'Anggaran terkendali', 'Tidak ada pos yang hampir atau sudah melebihi anggaran.', 'aman']);
  }

  return kartu.map(k =>
    '<article class="insight ' + k[3] + '"><span class="insight-ikon" aria-hidden="true">' + k[0] + '</span><div><h3>' + esc(k[1]) + '</h3><p>' + esc(k[2]) + '</p></div></article>'
  ).join('');
}

function grafikKategori(h) {
  const urut = Object.keys(h.perKatPeng).sort((a, b) => h.perKatPeng[b] - h.perKatPeng[a]);
  if (!urut.length) return kosong('Belum ada pengeluaran di bulan ini.');
  const maks = h.perKatPeng[urut[0]];
  return '<ul class="batang-daftar">' + urut.map(k => {
    const v = h.perKatPeng[k];
    return '<li><div class="batang-kepala"><span>' + esc(k) + '</span><span>' + fmtRp(v) + ' · ' + fmtPersen(v / h.pengeluaran) + '</span></div>' +
      '<div class="batang"><span style="width:' + (v / maks * 100) + '%"></span></div></li>';
  }).join('') + '</ul>';
}

function grafikPemVsPeng(h) {
  const maks = Math.max(h.pemasukan, h.pengeluaran);
  if (!maks) return kosong('Belum ada transaksi di bulan ini.');
  const baris = (label, v, kelas) =>
    '<li><div class="batang-kepala"><span>' + label + '</span><span>' + fmtRp(v) + '</span></div><div class="batang ' + kelas + '"><span style="width:' + (v / maks * 100) + '%"></span></div></li>';
  return '<ul class="batang-daftar">' + baris('Pemasukan', h.pemasukan, 'pem') + baris('Pengeluaran', h.pengeluaran, '') + '</ul>' +
    '<p class="bantu" style="margin-top:10px">Arus kas bersih: <strong>' + fmtRp(h.arus) + '</strong></p>';
}

function grafikHarian(h) {
  const n = hariDalamBulan(S.bulan);
  const nilai = [];
  for (let i = 1; i <= n; i++) nilai.push(h.harian[i] || 0);
  const maks = Math.max.apply(null, nilai);
  if (!maks) return kosong('Belum ada pengeluaran di bulan ini.');
  const W = 320, H = 150, L = 4, R = 4, T = 16, B = 22;
  const slot = (W - L - R) / n;
  const bw = Math.max(2, slot * 0.66);
  const area = H - T - B;
  let isi = '<line class="svg-garis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + area) + '" y2="' + (T + area) + '"/>';
  nilai.forEach((v, i) => {
    const tinggi = v / maks * area;
    const x = L + i * slot + (slot - bw) / 2;
    isi += '<rect class="svg-bar" x="' + x.toFixed(1) + '" y="' + (T + area - tinggi).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + tinggi.toFixed(1) + '" rx="2"><title>Tanggal ' + (i + 1) + ': ' + fmtRp(v) + '</title></rect>';
  });
  [1, 8, 15, 22, n].filter((d, i, a) => a.indexOf(d) === i).forEach(d => {
    isi += '<text class="svg-label" x="' + (L + (d - 0.5) * slot).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + d + '</text>';
  });
  isi += '<text class="svg-label" x="' + L + '" y="10">Tertinggi ' + kompak(maks) + '</text>';
  return '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pengeluaran harian ' + esc(labelBulan(S.bulan)) + ', tertinggi ' + fmtRp(maks) + '">' + isi + '</svg>';
}

function grafikAntarBulan() {
  const ag = agregatBulanan();
  const baris = [];
  for (let i = 5; i >= 0; i--) {
    const b = geserBulan(S.bulan, -i);
    const x = ag[b] || { pem: 0, peng: 0 };
    baris.push({ b: b, pem: x.pem, peng: x.peng });
  }
  const maks = Math.max.apply(null, baris.reduce((a, r) => a.concat([r.pem, r.peng]), []));
  if (!maks) return kosong('Belum ada transaksi pada 6 bulan terakhir.');
  const W = 320, H = 170, L = 4, R = 4, T = 16, B = 24;
  const slot = (W - L - R) / 6;
  const bw = Math.min(20, slot * 0.4);
  const area = H - T - B;
  let isi = '<line class="svg-garis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + area) + '" y2="' + (T + area) + '"/>';
  baris.forEach((r, i) => {
    const cx = L + slot * i + slot / 2;
    [['pem', r.pem, cx - bw - 1], ['peng', r.peng, cx + 1]].forEach(q => {
      const v = q[1], x = q[2];
      const tinggi = v / maks * area;
      isi += '<rect class="svg-bar ' + (q[0] === 'pem' ? 'pem' : '') + '" x="' + x.toFixed(1) + '" y="' + (T + area - tinggi).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + tinggi.toFixed(1) + '" rx="3"><title>' + NAMA_BULAN[+r.b.slice(5, 7) - 1] + ' ' + (q[0] === 'pem' ? 'pemasukan' : 'pengeluaran') + ': ' + fmtRp(v) + '</title></rect>';
      if (v > 0) isi += '<text class="svg-nilai" x="' + (x + bw / 2).toFixed(1) + '" y="' + (T + area - tinggi - 3).toFixed(1) + '" text-anchor="middle">' + kompak(v) + '</text>';
    });
    isi += '<text class="svg-label' + (r.b === S.bulan ? ' tebal' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + NAMA_BULAN_PENDEK[+r.b.slice(5, 7) - 1] + '</text>';
  });
  return '<div class="legenda"><span class="pem">Pemasukan</span><span>Pengeluaran</span></div>' +
    '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Perbandingan pemasukan dan pengeluaran 6 bulan terakhir">' + isi + '</svg>';
}

/* ================= TAMPILAN: RIWAYAT ================= */
function htmlRiwayat() {
  const f = S.f, D = S.data;
  const semuaKat = [];
  D.kategori.pemasukan.concat(D.kategori.pengeluaran).forEach(k => { if (semuaKat.indexOf(k.nama) === -1) semuaKat.push(k.nama); });
  const opsi = semuaKat.map(n => '<option value="' + esc(n) + '"' + (f.kategori === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  const jenis = [['', 'Semua'], ['Pemasukan', 'Pemasukan'], ['Pengeluaran', 'Pengeluaran']].map(j =>
    '<button type="button" data-aksi="filter-jenis" data-nilai="' + j[0] + '" aria-pressed="' + (f.jenis === j[0]) + '">' + j[1] + '</button>').join('');
  return '<section class="halaman">' +
    '<div class="kartu">' +
    '<label class="field"><span class="sr">Cari transaksi</span><input id="rCari" type="search" placeholder="Cari kategori, keterangan, nominal…" value="' + esc(f.cari) + '" autocomplete="off"></label>' +
    '<div class="segmen kecil" role="group" aria-label="Filter jenis">' + jenis + '</div>' +
    '<div class="baris2"><label class="field"><span>Kategori</span><select id="rKategori"><option value="">Semua kategori</option>' + opsi + '</select></label>' +
    '<label class="field cek"><input type="checkbox" id="rSemua"' + (f.semua ? ' checked' : '') + '><span>Semua bulan</span></label></div>' +
    '<div class="baris2"><label class="field"><span>Dari tanggal</span><input id="rDari" type="date" value="' + esc(f.dari) + '"></label>' +
    '<label class="field"><span>Sampai tanggal</span><input id="rSampai" type="date" value="' + esc(f.sampai) + '"></label></div>' +
    '<button type="button" class="tombol tipis" data-aksi="reset-filter">Reset filter</button>' +
    '</div>' +
    '<div id="hasilRiwayat">' + htmlHasilRiwayat() + '</div>' +
    '</section>';
}

function daftarRiwayat() {
  const f = S.f;
  const q = f.cari.trim().toLowerCase();
  const semua = f.semua || f.dari || f.sampai;
  return S.data.transaksi.filter(t => {
    if (!semua && t.tanggal.slice(0, 7) !== S.bulan) return false;
    if (f.dari && (!t.tanggal || t.tanggal < f.dari)) return false;
    if (f.sampai && (!t.tanggal || t.tanggal > f.sampai)) return false;
    if (f.jenis && t.jenis !== f.jenis) return false;
    if (f.kategori && t.kategori !== f.kategori) return false;
    if (q) {
      const gabung = [t.kategori, t.subkategori, t.keterangan, t.metode, t.jenis, t.nominal, fmtAngka(t.nominal)].join(' ').toLowerCase();
      if (gabung.indexOf(q) === -1) return false;
    }
    return true;
  }).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.baris - a.baris);
}

function htmlHasilRiwayat() {
  const f = S.f;
  const daftar = daftarRiwayat();
  const cakupan = (f.dari || f.sampai) ? 'rentang tanggal pilihanmu' : (f.semua ? 'semua bulan' : labelBulan(S.bulan));
  let masuk = 0, keluar = 0;
  daftar.forEach(t => { if (t.jenis === 'Pemasukan') masuk += t.nominal; else keluar += t.nominal; });
  const ringkas = '<div class="ringkas"><span>Menampilkan ' + esc(cakupan) + ': <strong>' + daftar.length + ' transaksi</strong></span>' +
    '<span>Pemasukan ' + fmtRp(masuk) + ' · Pengeluaran ' + fmtRp(keluar) + '</span></div>';
  if (!daftar.length) return ringkas + kosong('Tidak ada transaksi yang cocok. Coba ubah pencarian atau filter.');
  return ringkas + '<ul class="daftar">' + daftar.map(htmlItem).join('') + '</ul>';
}

function htmlItem(t) {
  const masuk = t.jenis === 'Pemasukan';
  const sub = t.subkategori ? ' · ' + esc(t.subkategori) : '';
  const ket = t.keterangan ? ' · ' + esc(t.keterangan) : '';
  return '<li class="item"><div class="ikon ' + (masuk ? 'masuk' : 'keluar') + '" aria-hidden="true">' + (masuk ? '↓' : '↑') + '</div>' +
    '<div><div class="item-judul">' + esc(t.kategori) + sub + '</div>' +
    '<div class="item-sub">' + fmtTanggal(t.tanggal) + ' · ' + esc(t.metode) + ket + '</div></div>' +
    '<div class="item-kanan"><div class="nominal ' + (masuk ? 'pos' : 'neg') + '">' + (masuk ? '+' : '-') + fmtRp(t.nominal) + '</div>' +
    '<div class="item-aksi"><button type="button" data-aksi="edit" data-baris="' + t.baris + '">Ubah</button>' +
    '<button type="button" data-aksi="hapus" data-baris="' + t.baris + '">Hapus</button></div></div></li>';
}

function segarkanRiwayat() {
  const el = $('#hasilRiwayat');
  if (el) el.innerHTML = htmlHasilRiwayat();
}

/* ================= TAMPILAN: ANGGARAN ================= */
function htmlAnggaran() {
  const A = S.data.anggaran;
  const baris = (atribut, nama, nilai) =>
    '<label class="baris-input"><span>' + esc(nama) + '</span><span class="rp"><span>Rp</span><input type="text" inputmode="numeric" autocomplete="off" data-rp ' + atribut + '="' + esc(nama) + '" value="' + nilaiInput(nilai) + '"></span></label>';
  return '<section class="halaman">' +
    '<form id="formAnggaran" class="kartu" novalidate>' +
    '<h2>Saldo awal</h2>' +
    '<label class="baris-input"><span>Saldo awal bulan pertama</span><span class="rp"><span>Rp</span><input id="aSaldo" type="text" inputmode="numeric" autocomplete="off" data-rp value="' + nilaiInput(A.saldoAwal) + '"></span></label>' +
    '<p class="bantu">Titik awal saldo. Bulan-bulan berikutnya otomatis mengikuti saldo akhir bulan sebelumnya.</p>' +
    '<h2>Anggaran bulanan per pos</h2>' +
    (A.pos.length ? A.pos.map(p => baris('data-pos', p.nama, p.anggaran)).join('') : '<p class="bantu">Belum ada pos anggaran di spreadsheet.</p>') +
    '<h2>Target pemasukan per kategori</h2>' +
    (A.target.length ? A.target.map(t => baris('data-target', t.nama, t.target)).join('') : '<p class="bantu">Belum ada target pemasukan di spreadsheet.</p>') +
    '<p id="aGalat" class="galat" role="alert" hidden></p>' +
    '<button id="aSimpan" class="tombol utama" type="submit">Simpan Anggaran</button>' +
    '</form>' +
    '<div class="kartu"><h2>Perangkat ini</h2>' +
    '<p class="bantu">Keluar akan menghapus kode akses dari perangkat ini. Data di spreadsheet tidak ikut terhapus.</p>' +
    '<button type="button" class="tombol tipis" data-aksi="keluar">Keluar dari perangkat ini</button></div>' +
    '</section>';
}

async function simpanAnggaran() {
  if (S.menyimpan) return;
  const galatEl = $('#aGalat');
  const tampil = pesan => { galatEl.textContent = pesan; galatEl.hidden = false; };
  galatEl.hidden = true;

  const saldo = bacaRupiah($('#aSaldo').value, true);
  if (saldo.galat) return tampil(pesanRp(saldo.galat, 'Saldo awal'));

  const anggaran = [], target = [];
  const pos = document.querySelectorAll('[data-pos]');
  for (let i = 0; i < pos.length; i++) {
    const r = bacaRupiah(pos[i].value, false);
    if (r.galat) return tampil(pesanRp(r.galat, 'Anggaran "' + pos[i].dataset.pos + '"'));
    anggaran.push({ nama: pos[i].dataset.pos, nilai: r.nilai });
  }
  const tgt = document.querySelectorAll('[data-target]');
  for (let i = 0; i < tgt.length; i++) {
    const r = bacaRupiah(tgt[i].value, false);
    if (r.galat) return tampil(pesanRp(r.galat, 'Target "' + tgt[i].dataset.target + '"'));
    target.push({ nama: tgt[i].dataset.target, nilai: r.nilai });
  }

  S.menyimpan = true;
  aturTombol('#aSimpan', true, 'Menyimpan…', 'Simpan Anggaran');
  try {
    S.data.anggaran = await api('simpanAnggaran', { saldoAwal: saldo.nilai, anggaran: anggaran, target: target });
    S.menyimpan = false;
    render();
    toast('Anggaran tersimpan', 'sukses');
  } catch (e) {
    S.menyimpan = false;
    if (GALAT_AKSES.indexOf(e.kode) !== -1) return keLayarMasuk(e);
    aturTombol('#aSimpan', false, '', 'Simpan Anggaran');
    tampil(e.message);
    toast('Gagal menyimpan anggaran', 'gagal');
  }
}

/* ================= FORM TRANSAKSI ================= */
let fokusSebelum = null;

function bukaLembar(html) {
  fokusSebelum = document.activeElement;
  $('#lembarKonten').innerHTML = html;
  $('#lembar').hidden = false;
  document.body.classList.add('kunci');
}

function tutupLembar() {
  if (S.menyimpan) return;
  $('#lembar').hidden = true;
  $('#lembarKonten').innerHTML = '';
  document.body.classList.remove('kunci');
  S.form = null;
  S.hapus = null;
  if (fokusSebelum && fokusSebelum.focus) { try { fokusSebelum.focus(); } catch (e) { /* abaikan */ } }
}

function aturTombol(sel, sibuk, teksSibuk, teksNormal) {
  const b = $(sel);
  if (!b) return;
  b.disabled = sibuk;
  b.innerHTML = sibuk ? '<span class="spin" aria-hidden="true"></span> ' + esc(teksSibuk) : esc(teksNormal);
}

function bukaForm(t) {
  const D = S.data;
  const edit = !!t;
  S.form = {
    baris: edit ? t.baris : null,
    sidik: edit ? t.sidik : '',
    jenis: edit ? t.jenis : 'Pengeluaran',
    kategori: edit ? t.kategori : ''
  };
  const terakhir = penyimpanan.baca(KUNCI.metode);
  const metodeAwal = edit ? t.metode : (D.metode.indexOf(terakhir) !== -1 ? terakhir : (D.metode[0] || ''));
  const daftarMetode = metodeAwal && D.metode.indexOf(metodeAwal) === -1 ? [metodeAwal].concat(D.metode) : D.metode;

  bukaLembar(
    '<form id="formTransaksi" novalidate style="display:grid;gap:14px">' +
    '<div class="lembar-kepala"><h2 id="lembarJudul">' + (edit ? 'Ubah Transaksi' : 'Tambah Transaksi') + '</h2>' +
    '<button type="button" class="ikon-tombol" data-aksi="tutup" aria-label="Tutup">✕</button></div>' +
    '<div class="segmen" role="group" aria-label="Jenis transaksi">' +
    '<button type="button" data-aksi="pilih-jenis" data-jenis="Pengeluaran" aria-pressed="' + (S.form.jenis === 'Pengeluaran') + '">Pengeluaran</button>' +
    '<button type="button" data-aksi="pilih-jenis" data-jenis="Pemasukan" aria-pressed="' + (S.form.jenis === 'Pemasukan') + '">Pemasukan</button></div>' +
    '<label class="field nominal-besar"><span>Nominal</span><span class="rp"><span>Rp</span>' +
    '<input id="fNominal" data-rp type="text" inputmode="numeric" autocomplete="off" placeholder="0"></span></label>' +
    '<div class="field"><span class="lbl" id="lblKategori">Kategori</span><div id="chipKategori" class="chips" role="radiogroup" aria-labelledby="lblKategori"></div></div>' +
    '<div class="baris2"><label class="field"><span>Tanggal</span><input id="fTanggal" type="date"></label>' +
    '<label class="field"><span>Metode / Rekening</span><select id="fMetode">' +
    daftarMetode.map(m => '<option value="' + esc(m) + '">' + esc(m) + '</option>').join('') + '</select></label></div>' +
    '<label class="field"><span>Subkategori (opsional)</span><input id="fSub" type="text" list="daftarSaran" maxlength="100" autocomplete="off"></label>' +
    '<datalist id="daftarSaran"></datalist>' +
    '<label class="field"><span>Keterangan (opsional)</span><input id="fKet" type="text" maxlength="300" autocomplete="off"></label>' +
    '<p id="fGalat" class="galat" role="alert" hidden></p>' +
    '<div class="lembar-aksi"><button id="fSimpan" class="tombol utama" type="submit">' + (edit ? 'Simpan Perubahan' : 'Simpan') + '</button></div>' +
    '</form>'
  );

  $('#fMetode').value = metodeAwal;
  $('#fTanggal').value = edit ? t.tanggal : S.hariIni;
  if (edit) {
    $('#fNominal').value = fmtAngka(t.nominal);
    $('#fSub').value = t.subkategori;
    $('#fKet').value = t.keterangan;
  }
  isiKategori();
  setTimeout(() => { const n = $('#fNominal'); if (n) n.focus(); }, 80);
}

function isiKategori() {
  const f = S.form, D = S.data;
  const daftar = f.jenis === 'Pemasukan' ? D.kategori.pemasukan : D.kategori.pengeluaran;
  const nama = daftar.map(k => k.nama);
  if (nama.indexOf(f.kategori) === -1) f.kategori = '';
  $('#chipKategori').innerHTML = nama.length
    ? nama.map(n => '<button type="button" class="chip" role="radio" aria-checked="' + (n === f.kategori) + '" data-aksi="pilih-kategori" data-nama="' + esc(n) + '">' + esc(n) + '</button>').join('')
    : '<p class="bantu">Belum ada kategori di tab "Daftar Kategori".</p>';
  const k = daftar.filter(x => x.nama === f.kategori)[0];
  $('#daftarSaran').innerHTML = (k ? k.saran : []).map(s => '<option value="' + esc(s) + '"></option>').join('');
}

async function simpanForm() {
  if (S.menyimpan || !S.form) return;
  const f = S.form;
  const galatEl = $('#fGalat');
  const tampil = pesan => { galatEl.textContent = pesan; galatEl.hidden = false; };
  galatEl.hidden = true;

  const nom = bacaRupiah($('#fNominal').value, false);
  if (nom.galat) return tampil(PESAN_NOMINAL[nom.galat]);
  if (!(nom.nilai > 0)) return tampil('Nominal harus lebih dari 0.');
  if (!f.kategori) return tampil('Pilih kategori dulu.');
  const tanggal = $('#fTanggal').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return tampil('Tanggal wajib diisi.');
  const metode = $('#fMetode').value;
  if (!metode) return tampil('Pilih metode / rekening.');

  const payload = {
    jenis: f.jenis, nominal: nom.nilai, kategori: f.kategori, tanggal: tanggal, metode: metode,
    subkategori: $('#fSub').value.trim(), keterangan: $('#fKet').value.trim()
  };
  const edit = !!f.baris;
  const teksNormal = edit ? 'Simpan Perubahan' : 'Simpan';

  S.menyimpan = true;
  aturTombol('#fSimpan', true, 'Menyimpan…', teksNormal);
  try {
    const hasil = edit
      ? await api('edit', { baris: f.baris, sidik: f.sidik, transaksi: payload })
      : await api('tambah', { transaksi: payload });
    const daftar = S.data.transaksi;
    const i = daftar.findIndex(x => x.baris === hasil.transaksi.baris);
    if (i >= 0) daftar[i] = hasil.transaksi; else daftar.push(hasil.transaksi);
    if (hasil.info) S.data.info = hasil.info;
    penyimpanan.tulis(KUNCI.metode, metode);
    S.menyimpan = false;
    tutupLembar();
    render();
    const bulanTrans = tanggal.slice(0, 7);
    toast((edit ? 'Perubahan tersimpan' : 'Transaksi tersimpan') + (bulanTrans !== S.bulan ? ' di ' + labelBulan(bulanTrans) : ''), 'sukses');
    muatData({ senyap: true });
  } catch (e) {
    S.menyimpan = false;
    if (GALAT_AKSES.indexOf(e.kode) !== -1) { tutupLembar(); return keLayarMasuk(e); }
    if (e.kode === 'BERUBAH' || e.kode === 'BARIS') {
      tutupLembar();
      toast(e.message, 'gagal');
      muatData({ senyap: true });
      return;
    }
    aturTombol('#fSimpan', false, '', teksNormal);
    tampil(e.message);
    toast('Gagal menyimpan', 'gagal');
  }
}

function konfirmasiHapus(t) {
  S.hapus = t;
  const masuk = t.jenis === 'Pemasukan';
  bukaLembar(
    '<div class="lembar-kepala"><h2 id="lembarJudul">Hapus transaksi ini?</h2></div>' +
    '<p class="bantu">Isi barisnya akan dikosongkan dari spreadsheet. Tindakan ini tidak bisa dibatalkan dari aplikasi.</p>' +
    '<div class="ringkas-hapus"><strong>' + esc(t.kategori) + (t.subkategori ? ' · ' + esc(t.subkategori) : '') + '</strong>' +
    '<span>' + (masuk ? '+' : '-') + fmtRp(t.nominal) + ' · ' + fmtTanggal(t.tanggal) + '</span>' +
    (t.keterangan ? '<span class="bantu">' + esc(t.keterangan) + '</span>' : '') + '</div>' +
    '<div class="tombol-baris"><button type="button" class="tombol tipis" data-aksi="tutup">Batal</button>' +
    '<button id="btnHapusYa" type="button" class="tombol bahaya" data-aksi="hapus-ya">Ya, hapus</button></div>'
  );
}

async function hapusYa() {
  const t = S.hapus;
  if (!t || S.menyimpan) return;
  S.menyimpan = true;
  aturTombol('#btnHapusYa', true, 'Menghapus…', 'Ya, hapus');
  try {
    await api('hapus', { baris: t.baris, sidik: t.sidik });
    S.data.transaksi = S.data.transaksi.filter(x => x.baris !== t.baris);
    S.menyimpan = false;
    tutupLembar();
    render();
    toast('Transaksi dihapus', 'sukses');
    muatData({ senyap: true });
  } catch (e) {
    S.menyimpan = false;
    tutupLembar();
    if (GALAT_AKSES.indexOf(e.kode) !== -1) return keLayarMasuk(e);
    toast(e.message, 'gagal');
    if (e.kode === 'BERUBAH' || e.kode === 'BARIS') muatData({ senyap: true });
  }
}

/* ================= MEMUAT DATA ================= */
async function muatData(opsi) {
  opsi = opsi || {};
  if (S.memuat) return;
  S.memuat = true;
  if (!opsi.senyap && !S.data) $('#konten').innerHTML = SKELETON;
  $('#btnMuat').classList.add('berputar');
  try {
    S.data = await api('ambilData');
    S.hariIni = S.data.hariIni;
    if (!S.bulan) S.bulan = S.hariIni.slice(0, 7);
    render();
  } catch (e) {
    if (GALAT_AKSES.indexOf(e.kode) !== -1) {
      keLayarMasuk(e);
    } else if (!S.data) {
      $('#konten').innerHTML = '<div class="kosong"><div class="kosong-ikon" aria-hidden="true">📡</div><p>' + esc(e.message) + '</p>' +
        '<button type="button" class="tombol utama" data-aksi="muat">Coba lagi</button></div>';
    } else {
      toast(e.message + ' Data yang tampil mungkin belum terbaru.', 'gagal');
    }
  } finally {
    S.memuat = false;
    $('#btnMuat').classList.remove('berputar');
  }
}

/* ================= MASUK / KELUAR ================= */
function tampilM(pesan) {
  const el = $('#mGalat');
  el.textContent = pesan || '';
  el.hidden = !pesan;
}

function tampilkanMasuk(pesan) {
  $('#aplikasi').hidden = true;
  $('#layarMasuk').hidden = false;
  $('#mUrl').value = S.url || URL_SERVER_AWAL;
  $('#mKode').value = '';
  tampilM(pesan);
}

function keLayarMasuk(e) {
  if (e.kode === 'KODE_SALAH' || e.kode === 'BELUM_SETUP') {
    penyimpanan.hapus(KUNCI.kode);
    S.kode = '';
  }
  S.data = null;
  tampilkanMasuk(e.message);
}

function tampilkanApp() {
  $('#layarMasuk').hidden = true;
  $('#aplikasi').hidden = false;
  $('#konten').innerHTML = SKELETON;
}

async function masuk() {
  const url = $('#mUrl').value.trim();
  const kode = $('#mKode').value.trim();
  if (!/^https:\/\/script\.google\.com\//i.test(url) || !/\/exec(\?.*)?$/.test(url)) {
    return tampilM('Alamat harus diawali https://script.google.com/ dan berakhiran /exec.');
  }
  if (!kode) return tampilM('Kode akses wajib diisi.');
  S.url = url;
  S.kode = kode;
  tampilM('');
  aturTombol('#mMasuk', true, 'Memeriksa…', 'Masuk');
  try {
    await api('ping');
    penyimpanan.tulis(KUNCI.url, url);
    penyimpanan.tulis(KUNCI.kode, kode);
    aturTombol('#mMasuk', false, '', 'Masuk');
    S.data = null;
    tampilkanApp();
    muatData();
  } catch (e) {
    aturTombol('#mMasuk', false, '', 'Masuk');
    S.kode = '';
    tampilM(e.message);
  }
}

function keluar() {
  penyimpanan.hapus(KUNCI.kode);
  S.kode = '';
  S.data = null;
  tampilkanMasuk('Kamu sudah keluar dari perangkat ini.');
}

/* ================= EVENT ================= */
function pasangEvent() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-aksi]');
    if (!el) return;
    const aksi = el.dataset.aksi;
    const trans = () => S.data.transaksi.filter(t => t.baris === +el.dataset.baris)[0];
    switch (aksi) {
      case 'nav':
        if (!S.data) return;
        S.halaman = el.dataset.hal;
        render({ animasi: true });
        window.scrollTo(0, 0);
        break;
      case 'bulan':
        if (!S.data) return;
        S.bulan = geserBulan(S.bulan, +el.dataset.arah);
        render();
        break;
      case 'muat': muatData(); break;
      case 'tambah': if (S.data) bukaForm(); else toast('Data belum selesai dimuat.', 'info'); break;
      case 'tutup': tutupLembar(); break;
      case 'pilih-jenis':
        if (!S.form) return;
        S.form.jenis = el.dataset.jenis;
        S.form.kategori = '';
        document.querySelectorAll('[data-aksi="pilih-jenis"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.jenis === S.form.jenis)));
        isiKategori();
        break;
      case 'pilih-kategori':
        if (!S.form) return;
        S.form.kategori = el.dataset.nama;
        isiKategori();
        break;
      case 'edit': { const t = trans(); if (t) bukaForm(t); break; }
      case 'hapus': { const t = trans(); if (t) konfirmasiHapus(t); break; }
      case 'hapus-ya': hapusYa(); break;
      case 'filter-jenis': S.f.jenis = el.dataset.nilai; render(); break;
      case 'reset-filter':
        S.f = { cari: '', jenis: '', kategori: '', dari: '', sampai: '', semua: false };
        render();
        break;
      case 'keluar': keluar(); break;
    }
  });

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('[data-rp]')) formatInputRp(el);
    else if (el.id === 'rCari') { S.f.cari = el.value; segarkanRiwayat(); }
  });

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'bulanInput') {
      if (/^\d{4}-\d{2}$/.test(el.value)) { S.bulan = el.value; render(); }
      return;
    }
    if (el.id === 'rKategori') S.f.kategori = el.value;
    else if (el.id === 'rSemua') S.f.semua = el.checked;
    else if (el.id === 'rDari') S.f.dari = el.value;
    else if (el.id === 'rSampai') S.f.sampai = el.value;
    else return;
    segarkanRiwayat();
  });

  document.addEventListener('submit', e => {
    e.preventDefault();
    const id = e.target.id;
    if (id === 'formMasuk') masuk();
    else if (id === 'formTransaksi') simpanForm();
    else if (id === 'formAnggaran') simpanAnggaran();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#lembar').hidden) tutupLembar();
  });
}

/* ================= MULAI ================= */
function mulai() {
  S.url = penyimpanan.baca(KUNCI.url);
  S.kode = penyimpanan.baca(KUNCI.kode);
  pasangEvent();
  if (!S.url || !S.kode) {
    tampilkanMasuk('');
    return;
  }
  tampilkanApp();
  muatData();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ }); });
}
mulai();
