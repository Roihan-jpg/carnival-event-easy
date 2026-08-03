# DESIGN — UI/UX Sistem Penjurian Karnaval

> Tujuan: admin yang bersih, cepat, dan tegas dengan nuansa carnival budaya.
> Hindari AI slop: glow berlebihan, glassmorphism, gradient ramai, floating card tanpa fungsi, hover berlebihan, dan dashboard penuh grafik dekoratif.

## 0. Prinsip desain

1. **Operasional lebih penting daripada dekorasi.**
2. Nuansa budaya muncul lewat warna, tekstur tipis, tipografi judul, dan detail pola; bukan ornamen di setiap komponen.
3. Tabel, form nilai, status, dan aksi utama harus terbaca dalam sekali pandang.
4. Interaksi desktop dan layar sentuh sama-sama nyaman.
5. Setiap animasi harus menjelaskan perubahan status, bukan sekadar pamer.

## 1. Karakter visual

Kata kunci:

- hangat
- tertib
- berwibawa
- budaya lokal
- administratif
- tidak kaku
- tidak futuristik

Arah visual:

- Latar utama krem sangat muda.
- Sidebar cokelat tua.
- Aksen terracotta/copper.
- Kartu putih hangat dengan border, bukan bayangan berat.
- Motif budaya geometris sangat halus hanya pada header/login/empty state.
- Foto atau ilustrasi carnival tidak digunakan sebagai background halaman kerja.

## 2. Design tokens

Implementasikan sebagai CSS custom properties pada `styles/tokens.css`.

```css
:root {
  --color-bg: #f6f1e8;
  --color-surface: #fffdf9;
  --color-surface-muted: #eee5d8;
  --color-border: #d9ccbc;

  --color-brand-900: #3b2418;
  --color-brand-800: #523123;
  --color-brand-700: #6b3f2a;
  --color-brand-600: #855037;
  --color-accent: #b7653f;
  --color-accent-soft: #f0d9c9;

  --color-text: #2a211c;
  --color-text-muted: #6f6259;
  --color-success: #2f6b4f;
  --color-warning: #9a6717;
  --color-danger: #a33c32;
  --color-info: #3f6275;

  --font-sans: "Inter", "Segoe UI", Arial, sans-serif;
  --font-display: "Lora", Georgia, serif;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --shadow-sm: 0 1px 2px rgb(59 36 24 / 0.08);
  --shadow-md: 0 8px 24px rgb(59 36 24 / 0.10);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
}
```

Catatan:

- Pastikan kombinasi warna final lolos WCAG AA.
- `Lora` hanya untuk judul/identitas event, bukan tabel atau form.
- Jangan menambah warna baru langsung di komponen; tambahkan token semantik.

## 3. Tipografi

| Elemen | Font | Ukuran rekomendasi |
|---|---|---:|
| Page title | Lora 600 | 28–32px |
| Section title | Inter 650 | 20–24px |
| Card title | Inter 650 | 16–18px |
| Body | Inter 400 | 14–16px |
| Label | Inter 600 | 13–14px |
| Table | Inter 400/600 | 13–14px |
| Score | Inter 700 | 20–28px |

- Line-height body minimal 1.5.
- Jangan memakai uppercase panjang.
- Angka nilai menggunakan `font-variant-numeric: tabular-nums`.

## 4. Layout aplikasi

### Desktop

- Sidebar: 248px, dapat diperkecil menjadi 72px.
- Topbar: 64px.
- Content max-width: 1440px.
- Padding content: 24–32px.
- Grid dashboard maksimal 12 kolom, tetapi gunakan hanya bila membantu.

### Tablet/mobile

- Sidebar menjadi drawer.
- Topbar tetap ringkas.
- Padding content: 16px.
- Tabel operasional boleh berubah menjadi list/card hanya bila kolom tidak lagi terbaca.
- Form penilaian tidak boleh memakai modal.
- Tombol submit tetap mudah dijangkau, tetapi jangan menutupi konten.

## 5. Navigasi per role

### Admin

- Ringkasan
- Peserta
- Jadwal & Status
- Penjurian
- Atraksi Wajib
- Penalti
- Hasil
- Pengguna
- Pengaturan Event
- Audit Log

### Juri

- Penilaian
- Riwayat Nilai Saya
- Panduan

### Operator

- Monitor Peserta
- Atraksi Wajib
- Insiden

Menu yang tidak berhak diakses tidak ditampilkan dan tetap dijaga di route/API.

## 6. Halaman inti

### 6.1 Login

- Panel identitas event yang sederhana.
- Form email dan password.
- Tidak memakai carousel, video, atau ilustrasi generik kantor.
- Motif budaya tipis maksimal 8–12% opacity.
- Pesan error spesifik tetapi tidak membocorkan keamanan.

### 6.2 Dashboard admin

Urutan informasi:

1. Event header dan status
2. Alert operasional penting
3. KPI ringkas
4. Tabel progres per peserta
5. Penalti/atraksi yang perlu tindakan
6. Grafik hanya bila benar-benar membantu

KPI maksimum 5:

- Total peserta
- Sedang berjalan
- Nilai lengkap
- Nilai belum lengkap
- Isu perlu tindakan

Hindari:

- Delapan kartu statistik identik.
- Donut chart untuk semua data.
- Ikon besar tanpa informasi.
- “Welcome back” yang mengambil setengah layar.

### 6.3 Daftar peserta

- Toolbar: pencarian, kategori, status, import, tambah peserta.
- Tabel:
  - nomor urut
  - nama peserta
  - kategori
  - jadwal
  - status
  - progres nilai 0/3–3/3
  - isu
  - aksi
- Nomor urut menjadi penanda visual utama.
- Filter tersimpan di query params.
- Bulk action dibatasi untuk aksi aman.

### 6.4 Form penilaian juri

Ini halaman paling penting.

Header tetap ringkas:

- nomor peserta
- nama peserta
- kategori
- tema
- lokasi juri
- status draft/submitted

Setiap kriteria berupa baris atau section:

- nama kriteria
- penjelasan ringkas
- input angka
- maksimum
- error inline

Gunakan input angka besar dan tombol `−`/`+` opsional untuk layar sentuh. Jangan memakai slider karena kurang presisi.

Panel total:

- total real-time `/100`
- status autosave
- waktu simpan terakhir
- tombol simpan draft
- tombol review & submit

Sebelum submit tampilkan confirmation dialog berisi total, kriteria kosong, dan konsekuensi penguncian.

### 6.5 Monitor penjurian

Tabel matriks:

| Peserta | Start | B. Edi | Finish | Lengkap |
|---|---|---|---|---|

Status menggunakan ikon + teks:

- Belum dimulai
- Draft
- Submitted
- Dibuka kembali
- Waiver

Tidak memakai warna saja.

### 6.6 Penalti

- Daftar terpisah dari skor.
- Form meminta jenis, angka pengurangan, alasan, dan evidensi opsional.
- `Confirmed` memerlukan konfirmasi eksplisit.
- Penalti dibatalkan tidak dihapus dari sejarah.

### 6.7 Hasil

- Tab Pendidikan dan Umum.
- Tabel peringkat:
  - peringkat
  - nomor
  - peserta
  - nilai juri
  - poin atraksi
  - penalti
  - nilai akhir
  - status verifikasi
- Detail breakdown tersedia dalam drawer/halaman detail, bukan memenuhi tabel utama.
- Banner jelas bila hasil masih preview.
- Tombol publish berbahaya menggunakan dialog konfirmasi.

## 7. Komponen bersama

Buat seperlunya:

- `AppShell`
- `PageHeader`
- `StatusBadge`
- `DataTable`
- `EmptyState`
- `InlineAlert`
- `ConfirmDialog`
- `ScoreInput`
- `ScoreSummary`
- `AutosaveIndicator`
- `ProgressMatrix`
- `FilterBar`
- `AuditTimeline`

Jangan membuat design system raksasa sebelum komponen dipakai minimal dua tempat.

## 8. State visual

Semua halaman data harus memiliki:

- loading skeleton secukupnya
- empty state yang menjelaskan tindakan berikut
- error state dengan retry
- unauthorized state
- offline/reconnecting banner
- success feedback singkat

Toast:

- Untuk hasil aksi singkat.
- Maksimal satu–dua toast aktif.
- Error validasi tetap inline, bukan hanya toast.

## 9. Motion dan hover

- Durasi 120–180ms.
- Hanya opacity, transform kecil, atau perubahan warna.
- Card tidak “terangkat” saat hover kecuali benar-benar clickable.
- Tidak ada parallax, cursor effect, animated gradient, shimmer permanen, atau bounce.
- Hormati `prefers-reduced-motion`.

## 10. Ikon dan ilustrasi

- Gunakan satu library ikon outline.
- Ukuran umum 18–20px.
- Jangan mencampur gaya ikon.
- Ilustrasi budaya dibuat geometris/abstrak dan dipakai hemat.
- Emoji tidak dipakai sebagai ikon admin.

## 11. Konten dan bahasa

- Bahasa UI: Indonesia.
- Istilah konsisten:
  - Peserta
  - Juri
  - Titik Penilaian
  - Atraksi Wajib
  - Penalti
  - Nilai Akhir
  - Draf
  - Dikirim
  - Dikunci
- Hindari istilah teknis seperti “record”, “mutation”, atau “payload” pada UI.
- Konfirmasi aksi menjelaskan dampak, bukan hanya “Apakah Anda yakin?”.

## 12. Responsive acceptance criteria

- 360px: form penilaian dapat diisi tanpa scroll horizontal.
- 768px: juri dapat menilai nyaman dalam orientasi portrait.
- 1024px: tabel admin tetap terbaca.
- 1440px: konten tidak terlalu melebar.
- Aksi utama dapat dijangkau keyboard dan touch.
