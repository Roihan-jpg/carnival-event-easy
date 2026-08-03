# PRD — Sistem Penjurian Karnaval Kecamatan Randuagung 2026

> Status: Draft implementasi MVP
> Sumber aturan: `ATURAN UMUM KARNAVAL KECAMATAN RANDUAGUNG 2026`
> Dokumen terkait: [TASKS.md](./TASKS.md), [DESIGN.md](./DESIGN.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

## 0. Kontrak kerja Codex

1. Baca `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, lalu `TASKS.md`.
2. Kerjakan hanya fase aktif pada `TASKS.md`.
3. Jangan menambah fitur di luar scope tanpa mencatatnya di bagian `Open Decisions`.
4. Setelah tiap fase: jalankan lint, test, build; perbarui checklist; buat ringkasan perubahan.
5. Jangan menyimpan service-role key Supabase di frontend.
6. Utamakan kode sederhana, typed, dapat diuji, dan tidak berlebihan.

## 1. Ringkasan produk

Aplikasi web untuk membantu panitia dan juri Karnaval Kecamatan Randuagung 2026 mencatat nilai peserta secara konsisten, memantau kelengkapan penilaian di tiga titik, menerapkan pengurangan nilai yang sah, dan menghasilkan peringkat yang dapat diaudit.

Acara memiliki dua kategori peserta:

- Pendidikan
- Umum

Penilaian dilakukan oleh tiga juri independen di tiga lokasi:

1. Start
2. Simpang Tiga B. Edi, Gedangmas
3. Depan Kantor Kecamatan Randuagung / finish

Terdapat tiga titik atraksi wajib:

1. Simpang Tiga Junaidi, barat Balai Desa Gedangmas
2. Simpang Tiga B. Sul, timur Masjid Jamik Gedangmas
3. Depan Toko Aminah, Pasar Randuagung

## 2. Tujuan

- Mengurangi kesalahan hitung manual.
- Memastikan setiap peserta dinilai dengan rubrik yang sama.
- Menunjukkan penilaian yang belum lengkap secara real-time.
- Memisahkan nilai juri, poin atraksi wajib, dan penalti.
- Menyediakan hasil per kategori dan jejak audit.
- Tetap nyaman digunakan lewat tablet/ponsel di lapangan.

## 3. Pengguna dan hak akses

### 3.1 Super Admin

- Mengelola akun admin.
- Mengubah konfigurasi sensitif.
- Membuka kembali nilai yang telah dikunci.
- Melihat seluruh audit log.

### 3.2 Admin Panitia

- Mengelola event, peserta, nomor urut, kategori, lokasi, juri, dan jadwal.
- Mengatur rubrik serta metode agregasi sebelum penjurian dibuka.
- Mencatat titik atraksi wajib dan penalti.
- Memantau progres penilaian.
- Mengunci, memverifikasi, dan menerbitkan hasil.
- Mengekspor rekap.

### 3.3 Juri

- Melihat peserta sesuai lokasi penugasannya.
- Mengisi skor setiap kriteria dan catatan.
- Menyimpan draft.
- Mengirim dan mengunci nilai.
- Melihat status nilai miliknya sendiri.
- Tidak dapat melihat nilai juri lain selama penjurian berlangsung.

### 3.4 Operator Lapangan

- Memperbarui status peserta: antre, dipanggil, tampil, berangkat, tiba, selesai, bermasalah.
- Mencatat kehadiran dan waktu aktual.
- Mencatat kejadian lapangan.
- Tidak dapat mengubah nilai juri.

### 3.5 Viewer Hasil

- Melihat hasil yang telah diterbitkan.
- Tidak memiliki akses ke data internal, catatan sensitif, atau audit log.

## 4. Ruang lingkup MVP

### 4.1 Autentikasi dan otorisasi

- Login menggunakan Supabase Auth.
- Role-based access control.
- Satu akun juri hanya memiliki satu penugasan aktif per titik dalam event.
- Session timeout dan logout.
- Semua aksi penting terekam.

### 4.2 Manajemen event

Data minimum:

- Nama event
- Tahun
- Tanggal pelaksanaan
- Lokasi/rute
- Status: `draft`, `configured`, `scoring_open`, `scoring_closed`, `published`, `archived`
- Zona waktu: `Asia/Jakarta`
- Batas penampilan normal: 10 menit
- Tambahan di finish: 4 menit, tidak dinilai
- Metode agregasi
- Aturan pembulatan
- Aturan tie-break

Konfigurasi event 2026 yang telah dikunci:

| Konfigurasi | Nilai |
|---|---|
| Nama | Karnaval Kecamatan Randuagung 2026 |
| Tahun | 2026 |
| Tanggal pelaksanaan | Sabtu, 22 Agustus 2026 |
| Pembukaan | 10.00 WIB |
| Pelepasan pertama | 10.30 WIB |
| Jeda peserta | 15 menit |
| Rute | Pasar Desa Tunjung, barat Simpang Tiga Tunjung, sampai depan Kantor Kecamatan Randuagung |
| Zona waktu | `Asia/Jakarta` |
| Batas penampilan normal | 10 menit |
| Tambahan di finish | 4 menit, tidak dinilai |
| Metode agregasi event | Rata-rata nilai total tiga juri, skala 0–100 |
| Pembulatan | Dua desimal pada nilai akhir saja |
| Pemenang | Tiga pemenang per kategori |
| Status awal event | `draft` |
| Mode/poin atraksi | `fixed_points`; `performed` +2 poin per titik, maksimum +6 |

### 4.3 Manajemen peserta

Data minimum:

- Nomor urut
- Nama tim/lembaga
- Kategori: Pendidikan atau Umum
- Tema
- Nama koordinator
- Nomor kontak
- Jumlah anggota
- Jadwal berangkat dan tiba perkiraan
- Waktu aktual
- Status kehadiran/perjalanan
- Catatan panitia

Validasi:

- Nomor urut unik per event.
- Jumlah anggota minimal 30, tetapi admin dapat menyimpan pengecualian dengan alasan.
- Kategori wajib.
- Data peserta dapat diimpor dari CSV dan diedit manual.

### 4.4 Lokasi dan penugasan juri

- Tiga lokasi penilaian default sesuai aturan.
- Admin dapat mengaktifkan/nonaktifkan lokasi sebelum event dimulai.
- Satu lokasi dapat memiliki satu juri utama pada MVP.
- Juri hanya melihat lembar nilai lokasi penugasannya.
- Penggantian juri wajib tercatat dalam audit log.

### 4.5 Rubrik penilaian

| Kriteria | Maksimum |
|---|---:|
| Konsep dan orisinalitas | 20 |
| Alur cerita | 15 |
| Artistik visual | 20 |
| Koreografi dan penyajian | 15 |
| Nilai budaya | 10 |
| Entertainment value | 10 |
| Musik dan tata suara | 5 |
| Kedisiplinan dan kekompakan | 5 |
| **Total per juri** | **100** |

Aturan input:

- Nilai berupa angka bulat dari 0 sampai maksimum kriteria.
- Semua kriteria wajib sebelum submit.
- Total dihitung sistem, bukan diketik.
- Catatan umum opsional; alasan wajib bila nilai 0.
- Draft dapat diubah.
- Nilai submitted terkunci bagi juri.
- Hanya admin berwenang dapat membuka kembali nilai dengan alasan.

### 4.6 Atraksi wajib

Sistem menyediakan checklist untuk tiga titik atraksi wajib:

- `performed`
- `not_performed`
- `unable_to_verify`

Setiap catatan memuat petugas, waktu, dan catatan/evidensi opsional.

Sistem mendukung:

- poin tetap per titik; atau
- hanya status kepatuhan tanpa tambahan skor.

Konfigurasi resmi event 2026 menggunakan `fixed_points`:

- `performed`: +2 poin.
- `not_performed`: 0 poin.
- `unable_to_verify`: 0 poin sementara dan finalisasi diblokir sampai status
  diselesaikan menjadi `performed` atau `not_performed` berdasarkan verifikasi.
- Total poin atraksi maksimum: 6 poin.

### 4.7 Penalti

Tingkat penalti dan pengurangan resminya:

| Tingkat | Pengurangan |
|---|---:|
| Ringan | 2 poin |
| Sedang | 5 poin |
| Berat | 10 poin |

Pelanggaran dapat mencakup:

- Terlambat/belum siap ketika dipanggil.
- Tampil di lokasi yang tidak ditentukan.
- Menghambat peserta lain.
- Pelanggaran tata tertib lain yang diputuskan panitia.

Setiap penalti wajib memiliki:

- Peserta
- Jenis
- Besaran pengurangan
- Alasan
- Pencatat
- Waktu
- Status: `draft`, `confirmed`, `cancelled`
- Penyetuju bila dikonfirmasi

Penalti bersifat kumulatif. Pelanggaran berat wajib memperoleh persetujuan sebelum
penaltinya berstatus `confirmed`.

Penalti tidak boleh membuat nilai akhir kurang dari 0.

### 4.8 Dashboard admin

Ringkasan minimum:

- Jumlah peserta per kategori
- Status peserta di rute
- Penilaian selesai/belum per titik
- Peserta yang belum memiliki tiga penilaian
- Atraksi wajib belum terverifikasi
- Penalti menunggu konfirmasi
- Status publikasi hasil

Dashboard memprioritaskan tabel operasional, bukan dekorasi grafik.

### 4.9 Rekap dan peringkat

Sistem menghitung:

```text
nilai_juri_agregat = metode_agregasi(nilai_total_tiga_juri)
nilai_atraksi       = 2 × jumlah titik berstatus performed, maksimum 6
total_penalti       = jumlah penalti confirmed
nilai_akhir         = max(0, nilai_juri_agregat + nilai_atraksi - total_penalti)
nilai_tampil        = round(nilai_akhir, 2)
```

Peringkat dipisahkan per kategori.

Sistem tetap mendukung metode agregasi rata-rata dan jumlah sesuai scope MVP.
Konfigurasi resmi event 2026 adalah rata-rata nilai total dari tiga juri dengan
skala agregat 0–100. Bila waiver yang sah digunakan, rata-rata dihitung dari minimal
dua nilai juri yang tersedia. Pembulatan dua angka di belakang koma hanya diterapkan
pada nilai akhir, bukan pada nilai setiap juri atau hasil antara.

Urutan tie-break resmi:

1. Konsep dan orisinalitas
2. Artistik visual
3. Nilai budaya
4. Kedisiplinan dan kekompakan
5. Total penalti paling kecil
6. Keputusan Dewan Juri melalui berita acara

Setiap kategori memiliki tiga pemenang: Juara I, Juara II, dan Juara III.
Jumlah pemenang hanya dapat diubah sebelum penjurian dibuka.

Formula ranking ringkas:

```text
ranking per kategori = nilai_tampil DESC,
  konsep_dan_orisinalitas DESC,
  artistik_visual DESC,
  nilai_budaya DESC,
  kedisiplinan_dan_kekompakan DESC,
  total_penalti ASC,
  keputusan_dewan_juri
```

### 4.10 Publikasi dan ekspor

- Preview hasil sebelum publikasi.
- Publikasi hanya oleh admin.
- Halaman publik hanya menampilkan hasil berstatus `published`.
- Publik hanya melihat nilai agregat, poin atraksi, penalti, nilai akhir, dan peringkat.
- Rincian nilai masing-masing juri tidak dipublikasikan dan hanya dapat diakses Admin
  serta Super Admin untuk verifikasi dan audit.
- Ekspor CSV untuk data peserta, nilai per juri, penalti, dan hasil akhir.
- Print view rekap A4.
- PDF resmi bukan scope MVP kecuali ditambahkan kemudian.

### 4.11 Audit log

Wajib mencatat:

- Login penting/gagal berulang
- Perubahan konfigurasi event/rubrik
- Pembuatan dan perubahan peserta
- Submit, unlock, dan resubmit nilai
- Penambahan/konfirmasi/pembatalan penalti
- Perubahan penugasan juri
- Publikasi/pembatalan publikasi hasil

Audit log bersifat append-only dari aplikasi.

## 5. Alur utama

### 5.1 Persiapan

1. Admin membuat event.
2. Admin mengisi peserta atau impor CSV.
3. Admin memeriksa nomor urut dan jadwal.
4. Admin menetapkan tiga lokasi dan akun juri.
5. Admin mengunci rubrik, metode agregasi, poin atraksi, penalti, pembulatan, dan tie-break.
6. Sistem menjalankan readiness check.
7. Admin membuka penjurian.

### 5.2 Penilaian juri

1. Juri login.
2. Sistem menampilkan titik penugasan dan peserta sesuai nomor urut.
3. Juri membuka peserta.
4. Juri mengisi delapan kriteria.
5. Sistem autosave draft.
6. Juri meninjau total.
7. Juri submit dan mengunci nilai.

### 5.3 Operasional lapangan

1. Operator memperbarui status peserta.
2. Petugas mencatat atraksi wajib.
3. Panitia mencatat insiden atau penalti.
4. Admin memantau kelengkapan.

### 5.4 Finalisasi

1. Admin menutup input baru.
2. Sistem memeriksa nilai yang hilang.
3. Admin menyelesaikan pengecualian dan penalti.
4. Sistem menghitung peringkat.
5. Admin memverifikasi dan mempublikasikan hasil.

## 6. Aturan bisnis penting

- Rubrik maksimum 100 per juri.
- Juri tidak dapat menilai peserta di luar penugasannya.
- Nilai yang sudah submitted tidak dapat diubah tanpa unlock.
- Unlock wajib menyimpan pelaku, alasan, waktu, nilai sebelum, dan nilai sesudah.
- Finalisasi diblokir bila tiga nilai juri belum lengkap.
- Waiver hanya untuk keadaan luar biasa, memerlukan minimal dua dari tiga nilai juri,
  memakai rata-rata nilai yang tersedia, disetujui Super Admin, serta wajib memiliki
  alasan dan berita acara.
- Status waiver ditampilkan pada rekap internal.
- Atraksi berstatus `unable_to_verify` tidak memberi poin dan memblokir finalisasi
  sampai verifikasi diselesaikan.
- Nilai juri lain disembunyikan selama `scoring_open`.
- Konfigurasi skor dibekukan saat penjurian dibuka.
- Semua waktu disimpan sebagai UTC dan ditampilkan dalam `Asia/Jakarta`.
- Penghapusan data penting menggunakan soft delete atau status nonaktif.
- Perhitungan akhir dilakukan di backend/database, bukan hanya frontend.

## 7. Persyaratan nonfungsional

### Keandalan

- Autosave draft dengan indikator status.
- Retry aman tanpa membuat duplikasi.
- Optimistic UI hanya untuk aksi berisiko rendah.
- Form penilaian tetap mempertahankan input saat jaringan putus singkat.
- Endpoint submit harus idempotent.

### Performa

- Halaman operasional utama terasa responsif pada koneksi seluler.
- Pagination/filter untuk tabel.
- Hindari query N+1.
- Bundle frontend dijaga wajar; lazy-load halaman admin.

### Keamanan

- Supabase RLS aktif untuk seluruh tabel yang dapat diakses client.
- Backend memverifikasi JWT Supabase.
- Service-role key hanya di API server.
- Validasi request di backend.
- Rate limit login-sensitive/API mutasi.
- CORS dibatasi.
- Jangan log token atau data rahasia.
- Audit aksi administratif.

### Aksesibilitas

- Kontras minimum WCAG AA.
- Fokus keyboard terlihat.
- Label form eksplisit.
- Status tidak hanya dibedakan dengan warna.
- Target sentuh minimum sekitar 44px.

### Kompatibilitas

- Desktop admin: Chrome/Edge versi modern.
- Tablet/ponsel juri: Chrome Android modern.
- Layout minimum yang didukung: 360px.

## 8. Di luar scope MVP

- Pendaftaran peserta mandiri.
- Penjualan tiket.
- Live streaming.
- GPS tracking peserta.
- Integrasi WhatsApp/SMS.
- Penilaian publik.
- Aplikasi native Android/iOS.
- AI untuk memberi nilai.
- Pengelolaan izin keramaian.
- Manajemen keamanan/medis penuh.
- Multi-event kompleks lintas kecamatan.

## 9. Acceptance criteria MVP

MVP diterima bila:

1. Admin dapat menyiapkan event dan seluruh peserta.
2. Tiga juri dapat menilai tanpa melihat nilai satu sama lain.
3. Sistem mencegah skor melebihi batas kriteria.
4. Draft tersimpan dan submit bersifat terkunci.
5. Admin melihat kelengkapan penilaian per peserta dan titik.
6. Atraksi wajib dan penalti tercatat terpisah.
7. Nilai akhir dihitung konsisten sesuai konfigurasi.
8. Peringkat Pendidikan dan Umum terpisah.
9. Hasil hanya tampil publik setelah diterbitkan.
10. Aksi sensitif memiliki audit trail.
11. Lint, unit test utama, integration test utama, dan production build lulus.

## 10. Product decisions — wajib lengkap sebelum fase scoring

| ID | Status | Keputusan final |
|---|---|---|
| OD-01 | `DECIDED` | Rata-rata nilai total tiga juri; skala agregat 0–100. |
| OD-02 | `DECIDED` | `fixed_points`: `performed` +2, `not_performed` 0, `unable_to_verify` 0 sementara dan memblokir finalisasi; maksimum +6. |
| OD-03 | `DECIDED` | Ringan −2, sedang −5, berat −10; kumulatif dan pelanggaran berat memerlukan persetujuan. |
| OD-04 | `DECIDED` | Finalisasi diblokir bila tidak lengkap; waiver luar biasa minimal 2/3 nilai, rata-rata nilai tersedia, persetujuan Super Admin, alasan dan berita acara. |
| OD-05 | `DECIDED` | Nilai akhir dibulatkan dua desimal; nilai juri dan hasil antara tidak dibulatkan. |
| OD-06 | `DECIDED` | Konsep, artistik visual, nilai budaya, kedisiplinan/kekompakan, penalti terkecil, lalu keputusan Dewan Juri dengan berita acara. |
| OD-07 | `DECIDED` | Role Operator dengan penugasan khusus `Attraction Verifier` pada satu titik atraksi. |
| OD-08 | `DECIDED` | Sabtu, 8 Agustus 2026 pukul 09.00 WIB di Kantor Kecamatan Randuagung; undian terpisah per kategori dan perubahan memerlukan persetujuan tertulis Ketua Panitia. |
| OD-09 | `DECIDED` | Tiga pemenang per kategori: Juara I, II, dan III; perubahan hanya sebelum penjurian dibuka. |
| OD-10 | `DECIDED` | Rincian per juri tidak dipublikasikan; akses internal hanya untuk Admin dan Super Admin. |

### Rincian keputusan operasional

- Pengundian kategori Pendidikan menggunakan nomor 1–3.
- Pengundian kategori Umum menggunakan nomor 4–20.
- Hasil pengundian dituangkan dalam berita acara dan tidak dapat ditukar tanpa
  persetujuan tertulis Ketua Panitia.
- Attraction Verifier hanya memverifikasi titik penugasannya.
- Status awal event adalah `draft`. Perubahan ke `configured` hanya dilakukan
  setelah konfigurasi, data awal, dan penugasan akun lulus readiness check.
- Nilai +2 per atraksi menyetarakan satu atraksi dengan besaran penalti ringan,
  sementara batas maksimum +6 menjaga nilai juri sebagai komponen dominan.

### Akun awal

| Nama akun awal | Role | Penugasan awal |
|---|---|---|
| Super Admin Karnaval | `super_admin` | Seluruh event dan aksi sensitif |
| Admin Panitia Karnaval | `admin` | Konfigurasi dan operasional event |
| Juri Start | `judge` | Titik `START` |
| Juri Gedangmas B. Edi | `judge` | Titik `GEDANGMAS_B_EDI` |
| Juri Finish | `judge` | Titik `FINISH` |
| Verifier Atraksi Junaidi | `operator` | Attraction Verifier titik Junaidi |
| Verifier Atraksi B. Sul | `operator` | Attraction Verifier titik B. Sul |
| Verifier Atraksi Toko Aminah | `operator` | Attraction Verifier titik Toko Aminah |
| Operator Lapangan Utama | `operator` | Status peserta dan insiden lapangan |

Tidak ada akun `viewer` awal karena hasil berstatus `published` tersedia melalui
halaman publik. Akun viewer internal dapat dibuat kemudian bila ada kebutuhan resmi.

Nama di atas adalah label provisioning, bukan akun bersama. Sebelum akun diaktifkan,
setiap label wajib diikat ke satu petugas bernama lengkap dan email unik. Kredensial
tidak boleh dibagikan, sehingga pelaku pada audit log tetap dapat diidentifikasi.

## 11. Data awal dari aturan

- Pelaksanaan: Sabtu, 22 Agustus 2026.
- Pembukaan: 10.00 WIB.
- Pelepasan pertama: 10.30 WIB.
- Jeda peserta: 15 menit.
- Perkiraan waktu tempuh: sekitar 7 jam.
- Nomor 1–3: kategori Pendidikan.
- Nomor 4–20: kategori Umum.
- Jadwal rinci disiapkan sebagai seed data, tetapi tetap dapat diubah admin sebelum penjurian dibuka.
