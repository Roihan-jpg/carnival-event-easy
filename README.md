# Sistem Penjurian Karnaval Randuagung

SPA operasional Karnaval Kecamatan Randuagung menggunakan HTML, Tailwind CSS, JavaScript modular, Vite, dan Supabase langsung dari browser. Project memerlukan Node.js 22 dan tidak memakai backend Express maupun service-role key di frontend.

## Menjalankan project

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Isi `.env.local` dengan nilai project Supabase:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_OR_PUBLISHABLE_KEY
```

Kedua variable tersebut wajib. Jangan pernah memasukkan `service_role` ke variable `VITE_*`.

Verifikasi project:

```bash
npm run lint
npm run test
npm run build
```

## Menyiapkan Supabase

Migration harus diterapkan berurutan dengan CLI. Jangan menjalankan `supabase db reset` pada database produksi.

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase db push
npx supabase db lint --linked --level error
```

Di Supabase Dashboard, atur Authentication → URL Configuration:

- Site URL: domain Cloudflare Pages produksi.
- Redirect URL: domain produksi dan URL preview yang memang digunakan.

Pembuatan akun dilakukan di Authentication → Users. Setelah akun Auth tersedia, Super Admin membuka menu **Pengguna**, menambahkan profil memakai User ID, lalu mengatur role dan penugasan.

Akun minimum sebelum penjurian dibuka:

- 1 Super Admin yang tetap aktif;
- 3 akun Juri, masing-masing ditugaskan ke Start, B. Edi, dan Finish;
- 3 akun Operator verifikator, masing-masing ditugaskan ke satu titik atraksi;
- akun Admin, Operator lapangan umum, atau Viewer sesuai kebutuhan panitia.

Database akan menolak pembukaan penjurian sebelum delapan kriteria berjumlah 100, tiga lokasi/juri tersedia, dan tiga titik/verifikator atraksi lengkap.

## Deploy ke Cloudflare Pages

Hubungkan repository ke Cloudflare Pages lalu gunakan:

```text
Build command    : npm run build
Output directory : dist
Node version     : 22
```

Tambahkan environment variable produksi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada pengaturan Pages. Deploy ulang setelah variable berubah karena Vite menyisipkan konfigurasi saat build.

`public/_redirects` menyediakan fallback SPA untuk hard refresh. `public/_headers` menambahkan header keamanan, sedangkan source map produksi dinonaktifkan. Folder hasil build adalah `dist`.

## Alur penggunaan awal

1. Masuk sebagai Super Admin dan lengkapi profil akun petugas serta penugasannya.
2. Periksa Pengaturan → Kesiapan penjurian.
3. Buka penjurian setelah semua pemeriksaan hijau.
4. Juri mengisi draf, meninjau, lalu submit; lembar nilai akan terkunci.
5. Operator memperbarui status peserta, atraksi wajib, dan insiden.
6. Admin mengonfirmasi penalti dan menutup penjurian setelah operasional selesai.
7. Selesaikan waiver atau tie-break melalui Super Admin bila diperlukan.
8. Buat snapshot dan terbitkan hasil; `/hasil` hanya menampilkan snapshot published.
