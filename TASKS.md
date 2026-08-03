# TASKS — Rencana Eksekusi Codex

> Kerjakan berurutan. Satu fase = satu unit kerja yang dapat diuji dan direview.
> Jangan mengerjakan fase berikutnya sebelum acceptance check fase aktif lulus.

## 0. Protokol eksekusi

Pada awal setiap sesi Codex:

```text
1. Baca docs/PRD.md, docs/DESIGN.md, docs/ARCHITECTURE.md.
2. Baca fase aktif pada docs/TASKS.md.
3. Periksa kondisi repository sebelum mengubah file.
4. Nyatakan asumsi hanya bila tidak tercantum di docs.
5. Implementasikan scope fase aktif saja.
6. Jalankan verification commands.
7. Perbarui checklist dan tulis ringkasan:
   - perubahan
   - test/build
   - risiko/keputusan tersisa
8. Berhenti pada checkpoint.
```

Aturan token/konteks:

- Jangan menyalin seluruh dokumen ke output.
- Referensikan heading/ID keputusan.
- Hindari membuat file abstraksi sebelum dipakai.
- Jangan refactor area di luar fase aktif.
- Gunakan diff kecil dan commit tematik.
- Bila aturan bisnis ambigu, tambahkan ke `Open decisions`, jangan menebak.

## Status fase

- [x] F0 — Kunci keputusan produk
- [x] F1 — Bootstrap monorepo
- [x] F2 — Supabase schema, seed, RLS
- [x] F3 — API foundation dan auth
- [x] F4 — App shell dan design foundation
- [x] F5 — Event, pengguna, lokasi, rubrik
- [ ] F6 — Peserta dan jadwal
- [ ] F7 — Penilaian juri
- [ ] F8 — Operasional, atraksi, penalti
- [ ] F9 — Rekap, ranking, publikasi
- [ ] F10 — Hardening dan UAT
- [ ] F11 — Deployment readiness

---

## F0 — Kunci keputusan produk

### Tasks

- [x] Konfirmasi OD-01 sampai OD-10 pada `PRD.md`.
- [x] Isi konfigurasi event final.
- [x] Tetapkan role dan nama akun awal.
- [x] Tetapkan kebijakan waiver nilai hilang.
- [x] Tetapkan poin atraksi resmi.
- [x] Tetapkan penalti resmi.
- [x] Tetapkan jumlah pemenang.
- [x] Tandai seluruh keputusan sebagai `DECIDED` dalam PRD.

### Acceptance check

- Tidak ada keputusan scoring kritis yang masih ambigu.
- Rubrik maksimum tepat 100.
- Metode ranking dapat dijelaskan dengan satu formula.

### Checkpoint

```bash
git add docs
git commit -m "docs: lock carnival judging product decisions"
```

### Phase report: F0

**Completed**

- OD-01 sampai OD-10 telah berstatus `DECIDED`.
- Konfigurasi event 2026, formula ranking, waiver, penalti, poin atraksi, pemenang,
  publikasi hasil, serta pengundian nomor telah dikunci.
- Status awal event ditetapkan `draft`.
- Role, label akun awal, dan penugasan operasional telah ditetapkan dengan kebijakan
  satu akun unik per petugas.

**Verification**

- F0 acceptance script: pass — 10/10 keputusan `DECIDED`, 0 `OPEN`.
- Rubrik: pass — 8 kriteria dengan total maksimum 100.
- Formula ranking: pass — nilai akhir dan seluruh tie-break memiliki urutan eksplisit.
- `git diff --cached --check`: pass.
- `npm run lint`: not applicable — workspace npm dibuat pada F1.
- `npm run test`: not applicable — workspace npm dibuat pada F1.
- `npm run build`: not applicable — workspace npm dibuat pada F1.

**Files/areas changed**

- `PRD.md`: konfigurasi final, keputusan produk, formula, aturan operasional, dan akun awal.
- `TASKS.md`: checklist dan laporan F0.

**Open decisions / risks**

- Tidak ada open decision produk untuk F0.
- Label akun provisioning wajib diikat ke nama lengkap dan email unik sebelum aktivasi.
- Kredensial plaintext yang tersimpan di luar spesifikasi harus dirotasi dan tidak boleh
  dimasukkan ke Git atau bundle aplikasi.

**Next allowed phase**

- F1 — Bootstrap monorepo.

---

## F1 — Bootstrap monorepo

### Tasks

- [x] Buat npm workspaces: `apps/web`, `apps/api`, `packages/contracts`.
- [x] Scaffold Angular 18 standalone + routing + SCSS.
- [x] Scaffold Express TypeScript.
- [x] Aktifkan TypeScript strict.
- [x] Tambahkan lint, format, test, build scripts root.
- [x] Tambahkan `.editorconfig`, `.gitignore`, `.env.example`.
- [x] Buat shared enums/DTO dasar tanpa business logic.
- [x] Tambahkan CI minimal lint + test + build.

### Root scripts minimum

```json
{
  "scripts": {
    "dev:web": "npm --workspace apps/web run start",
    "dev:api": "npm --workspace apps/api run dev",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "verify": "npm run lint && npm run test && npm run build"
  }
}
```

### Acceptance check

```bash
node --version
npm install
npm run lint
npm run test
npm run build
```

- Node major version 22.
- Web dan API dapat dijalankan lokal.
- Tidak ada secret di repository.

### Checkpoint

```bash
git add .
git commit -m "chore: bootstrap judging system monorepo"
```

### Phase report: F1

**Completed**

- npm workspaces dibuat untuk Angular web, Express API, dan shared contracts.
- TypeScript strict, ESLint, Prettier, test runners, production build, dan root
  verification scripts dikonfigurasi.
- CI minimal menjalankan `npm ci` dan `npm run verify` pada Node.js 22.
- Environment template dan dokumentasi local development ditambahkan tanpa secret.

**Verification**

- `node --version`: pass — `v22.22.0`.
- `npm install`: pass.
- `npm run lint`: pass.
- `npm run test`: pass — 6 test pada contracts, API, dan web.
- `npm run build`: pass — contracts/API TypeScript dan Angular production build.
- API runtime smoke: pass — Express merespons 404 pada route yang belum dibuat.
- Angular local serve command: pass — target `web` dikenali oleh `ng serve`.
- Secret scan: pass — tidak ada credential assignment berisi nilai.
- Code review: approve — tidak ada critical/required code finding.

**Files/areas changed**

- Root workspace/config: `package.json`, lockfile, TypeScript, lint, format, env,
  ignore rules, README, dan GitHub Actions.
- `packages/contracts`: enum wire, response/pagination DTO, test, dan build config.
- `apps/api`: Express bootstrap, server entrypoint, test, dan build config.
- `apps/web`: Angular 18 standalone scaffold minimal, lint, test, dan build config.

**Open decisions / risks**

- `npm audit --omit=dev` melaporkan 8 high severity pada Angular 18.2.14.
  Registry hanya menawarkan fix breaking ke Angular 21; upgrade tidak dilakukan karena
  `ARCHITECTURE.md` mengunci Angular 18. Risiko harus diselesaikan sebelum deployment.
- Validasi environment, security middleware, logger, dan health endpoints tetap scope F3.

**Next allowed phase**

- F2 — Supabase schema, seed, RLS.

---

## F2 — Supabase schema, seed, RLS

### Tasks

- [x] Buat migration enums dan tabel sesuai `ARCHITECTURE.md`.
- [x] Tambahkan FK, check constraint, unique constraint, index.
- [x] Buat trigger `updated_at`.
- [x] Buat policy RLS per role.
- [x] Buat proteksi audit log append-only.
- [x] Seed kategori, 3 lokasi juri, 8 kriteria, 3 titik atraksi.
- [x] Seed 20 peserta dan jadwal aturan:
  - peserta 1–3 Pendidikan
  - peserta 4–20 Umum
  - keberangkatan mulai 10.30 setiap 15 menit
  - estimasi finish +7 jam
- [x] Buat akun demo melalui script terpisah, bukan SQL berisi password.
- [x] Tambahkan test SQL/RLS positif dan negatif.

### Index minimum

- `participants(event_id, sequence_number)`
- `participants(event_id, category_id, status)`
- `score_sheets(event_id, participant_id, location_id)`
- `score_sheets(event_id, status)`
- `penalties(event_id, participant_id, status)`
- `attraction_checks(event_id, participant_id)`
- `audit_logs(event_id, created_at desc)`

### Acceptance check

```bash
supabase db reset
supabase db lint
npm run test
```

- Database dapat dibangun dari nol.
- Seed menghasilkan 20 peserta.
- Total max score criteria = 100.
- Judge A tidak dapat membaca sheet Judge B.
- Public tidak dapat membaca draft result.

### Checkpoint

```bash
git add supabase packages
git commit -m "feat: add judging database schema seed and rls"
```

### Phase report: F2

**Completed**

- Migration PostgreSQL mencakup enum, 17 tabel domain, FK, constraint, seluruh index
  minimum, trigger `updated_at`, dan proteksi audit append-only.
- RLS diaktifkan pada seluruh tabel dengan 44 policy untuk Super Admin, Admin, Juri,
  Operator/Attraction Verifier, Viewer/authenticated, dan public.
- Seed deterministik memuat event 2026 berstatus `draft`, dua kategori, tiga lokasi
  juri, delapan kriteria, tiga titik atraksi, tiga tingkat penalti, serta 20 peserta
  beserta jadwalnya.
- Script terpisah menyiapkan sembilan akun awal dan assignment tanpa menyimpan atau
  mencetak password; tidak ada akun Viewer awal sesuai keputusan F0.
- pgTAP mencakup schema/index, seed, angka skor bulat, isolasi sheet antarjuri,
  assignment verifier, akses hasil public, privilege minimum, dan audit append-only.

**Verification**

- `npm run db:reset`: pass — database berhasil dibangun dari nol dan seed diterapkan.
- `npm run db:lint`: pass — tidak ada error schema pada `public`/`extensions`.
- `npm run test:db`: pass — 32 test SQL/RLS positif dan negatif.
- `npm run test`: pass — 6 test contracts, API, dan web.
- `npm run verify`: pass — lint, seluruh test workspace, dan production build.
- Demo-user apply smoke: pass — 9 profil, 3 assignment juri, dan 3 assignment
  Attraction Verifier; credential sementara tidak dicetak dan database di-reset lagi.
- Privilege review: pass — 17/17 tabel memakai RLS; public hanya memiliki `SELECT`
  pada snapshot hasil dan authenticated hanya memiliki `SELECT` pada audit log.
- Secret scan dan `git diff --check`: pass.
- Code review: approve setelah privilege default `TRUNCATE` dicabut dan dilindungi
  regression test.

**Files/areas changed**

- `supabase/`: config lokal terisolasi, migration, seed, pgTAP/RLS test, dan script
  akun demo.
- Root tooling: Supabase CLI terpin, perintah database, environment template, lockfile,
  dan petunjuk penggunaan.
- `ARCHITECTURE.md`: model assignment Attraction Verifier dan waktu kejadian penalti
  diselaraskan dengan OD-03/OD-07.

**Open decisions / risks**

- Tidak ada Product Decision yang masih terbuka.
- `npm audit --omit=dev` tetap melaporkan 8 high severity pada Angular 18; full audit
  juga memuat vulnerability toolchain development. Fix yang tersedia memerlukan major
  upgrade Angular/Vitest di luar F2 dan harus diselesaikan sebelum deployment.
- Password akun awal tetap harus diberikan melalui environment saat provisioning;
  repository sengaja tidak menyimpan credential.

**Next allowed phase**

- F3 — API foundation dan auth.

---

## F3 — API foundation dan auth

### Tasks

- [x] Setup Express app, config validation, CORS, helmet, compression.
- [x] Tambahkan request ID dan structured logger.
- [x] Tambahkan error envelope dan error codes.
- [x] Implement JWT verification Supabase.
- [x] Implement `GET /api/v1/me`.
- [x] Implement role middleware dan event access guard.
- [x] Implement health endpoints.
- [x] Setup repository client Supabase/Postgres.
- [x] Tambahkan integration test auth/role.
- [x] Dokumentasikan endpoint secara ringkas.

### Acceptance check

- Missing/invalid token → 401.
- Role tidak sesuai → 403.
- Error tidak membocorkan stack di production.
- `/health/live` dan `/health/ready` bekerja.
- Logger tidak mencetak token.

### Verification

```bash
npm run lint
npm run test
npm run build
```

### Checkpoint

```bash
git add apps/api packages/contracts
git commit -m "feat: establish api auth and authorization foundation"
```

### Phase report: F3

**Completed**

- Express app memvalidasi environment saat startup dan memakai CORS allowlist,
  Helmet, compression, batas payload JSON, serta menonaktifkan `x-powered-by`.
- Semua response memakai envelope konsisten dengan request ID; error internal tidak
  mengirim stack atau detail provider dan structured logger meredaksi credential.
- Supabase access token diverifikasi melalui Auth API, lalu profil aktif dan role
  authoritative dibaca dari database untuk `GET /api/v1/me`.
- Middleware role dan event access tersedia untuk endpoint fase berikutnya: Juri
  memerlukan assignment aktif dan Viewer hanya dapat mengakses event published.
- Liveness dan readiness endpoint tersedia; readiness memeriksa koneksi repository.
- Dokumentasi endpoint, environment, autentikasi, dan authorization middleware
  tersedia di `apps/api/README.md`.

**Verification**

- `npm run lint`: pass — contracts, API, dan web.
- `npm run test`: pass — 29 test (5 contracts, 22 API, dan 2 web).
- `npm run build`: pass — TypeScript contracts/API dan production build Angular.
- `npm run db:reset`: pass — konfigurasi lokal dan seed tetap dapat dibangun ulang.
- Runtime smoke Supabase lokal: pass — readiness `200`, missing token `401`, dan
  `/api/v1/me` `200` dengan role authoritative `admin`; data smoke telah dibersihkan.
- Acceptance auth/role, CORS, production-safe error, security header, request ID,
  readiness failure, dan token-safe logging tercakup integration test.
- Secret scan dan `git diff --check`: pass.
- Code review: approve setelah raw internal error dihapus dari log dan provider email
  lokal diaktifkan agar akun yang dibuat Admin dapat melakukan sign-in.

**Files/areas changed**

- `apps/api/`: config, HTTP/security middleware, structured logger, error handling,
  health endpoint, Supabase clients, auth/profile repository, authorization guard,
  integration test, dan dokumentasi endpoint.
- `packages/contracts/`: error code serta DTO current user dan health response.
- Root tooling/documentation: dependency lock, tautan dokumentasi API, dan konfigurasi
  provider email Supabase lokal; public signup tetap diblokir oleh konfigurasi global.

**Open decisions / risks**

- Tidak ada Product Decision yang masih terbuka.
- `npm audit --omit=dev` tetap melaporkan 8 high severity pada Angular 18; full audit
  juga memuat vulnerability toolchain development. Fix yang tersedia memerlukan major
  upgrade Angular/Vitest di luar F3 dan harus diselesaikan sebelum deployment.

**Next allowed phase**

- F4 — App shell dan design foundation.

---

## F4 — App shell dan design foundation

### Tasks

- [x] Implement tokens dari `DESIGN.md`.
- [x] Setup font, typography, reset, focus state.
- [x] Buat AppShell, sidebar, topbar, responsive drawer.
- [x] Buat login dan auth state.
- [x] Buat route guard per role.
- [x] Buat PageHeader, StatusBadge, InlineAlert, ConfirmDialog.
- [x] Buat loading, empty, error, unauthorized states.
- [x] Tambahkan PWA shell dan offline banner.
- [x] Tambahkan basic accessibility checks.
- [x] Jangan membuat dashboard dekoratif.

### Acceptance check

- Layout baik pada 360, 768, 1024, 1440px.
- Keyboard focus terlihat.
- Menu sesuai role.
- Tidak ada horizontal scroll pada shell.
- Warna/komponen mengikuti token.

### Verification

```bash
npm run lint
npm run test
npm run build
```

### Checkpoint

```bash
git add apps/web
git commit -m "feat: build responsive carnival admin shell"
```

### Phase report: F4

**Completed**

- Token warna, spacing, radius, dan motion dari `DESIGN.md` diterapkan bersama reset,
  focus-visible, reduced motion, serta font Inter/Lora yang di-host dari bundle lokal.
- Login Supabase memvalidasi form, memetakan error ke pesan aman, memulihkan session,
  dan membaca profil/role authoritative melalui `GET /api/v1/me`.
- AppShell menyediakan sidebar 248/72 px, topbar 64 px, drawer mobile, skip link,
  menu per role, logout dengan confirmation dialog, dan placeholder operasional tanpa
  dashboard atau fitur domain F5+.
- Route guard menjaga autentikasi dan role; seluruh menu Admin, Juri, Operator, dan
  Viewer memiliki route dengan role policy yang konsisten.
- Komponen PageHeader, StatusBadge, InlineAlert, ConfirmDialog, serta state loading,
  empty, error, unauthorized, dan not-found tersedia dan sudah dipakai seperlunya.
- PWA application shell, manifest, icon, runtime browser config, dan offline banner
  ditambahkan tanpa menyimpan service-role key atau meng-cache response API sensitif.

**Verification**

- `npm run lint`: pass — contracts, API, dan web termasuk template accessibility lint.
- `npm run test`: pass — 58 test (5 contracts, 22 API, dan 31 web).
- `npm run build`: pass — production build seluruh workspace; initial web bundle
  310.14 kB dan Supabase SDK berada pada lazy chunk.
- Responsive component checks: pass — login dan shell diuji pada 360, 768, 1024,
  dan 1440 px tanpa overflow internal; drawer/sidebar berubah sesuai breakpoint.
- Accessibility checks: pass — label form, status nonwarna, dialog bernama, drawer
  tertutup tidak focusable, target sentuh 44 px, reduced motion, dan focus ring.
- Contrast checks: pass — pasangan teks utama/semantik minimum 4.72:1; token aksen
  dan warning text diperbaiki menjadi 6.46:1 dan 6.05:1.
- PWA build checks: pass — `ngsw.json`, worker, dan manifest terbentuk; runtime config
  serta seluruh response API tidak masuk cache application shell.
- Dependency review: pass — paket baru berlisensi MIT, ISC, atau OFL-1.1; SDK Supabase
  dilazy-load agar tidak membebani initial bundle.
- Secret scan dan `git diff --check`: pass.
- Code review: approve setelah focusability drawer tertutup dan accessible name dialog
  diperbaiki serta dilindungi regression test.

**Files/areas changed**

- `apps/web/src/styles/`: token, reset, typography, focus, dan reduced-motion baseline.
- `apps/web/src/app/core/`: runtime config, auth session/gateway, guards, role navigation,
  AppShell, connectivity state, dan offline banner.
- `apps/web/src/app/shared/ui/` dan `features/shell-pages/`: komponen dasar, login,
  placeholder operasional, serta system states.
- `apps/web/public/`, `ngsw-config.json`, dan Angular config: manifest, icon, runtime
  config, service worker, dependency, test, dan build setup.

**Open decisions / risks**

- Tidak ada Product Decision yang masih terbuka dan tidak ada fitur F5 yang dikerjakan.
- Browser connector dapat terhubung tetapi kebijakan enterprise memblokir navigasi ke
  localhost, sehingga screenshot/console manual belum tersedia; layout tetap diverifikasi
  melalui ChromeHeadless component checks pada keempat breakpoint acceptance.
- `npm audit --omit=dev` melaporkan 9 high severity pada keluarga Angular 18 termasuk
  service worker. Fix memerlukan upgrade breaking ke Angular 21 di luar F4 dan harus
  diselesaikan sebelum deployment.
- Nilai Supabase URL dan anon key production wajib diinjeksi ke `runtime-config.js`
  saat deployment; file repository sengaja berisi placeholder kosong.

**Next allowed phase**

- F5 — Event, pengguna, lokasi, rubrik.

---

## F5 — Event, pengguna, lokasi, rubrik

### API

- [x] Event read/update.
- [x] User/profile management.
- [x] Judging locations.
- [x] Judge assignments.
- [x] Criteria management.
- [x] Readiness check.
- [x] Lock config/open/close scoring.
- [x] Audit semua mutasi penting.

### Web

- [x] Event settings.
- [x] User list/form.
- [x] Assignment matrix.
- [x] Rubric editor dengan total maksimum real-time.
- [x] Readiness checklist.
- [x] Confirmation untuk open scoring.

### Business tests

- [x] Scoring tidak dapat dibuka bila total rubrik ≠ 100.
- [x] Scoring tidak dapat dibuka tanpa 3 lokasi aktif/juri.
- [x] Config scoring tidak dapat diubah saat `scoring_open`.
- [x] Assignment ganda ditolak.

### Verification dan checkpoint

```bash
npm run verify
git add .
git commit -m "feat: configure events judges locations and rubric"
```

### Phase report: F5

**Completed**

- API konfigurasi event, lokasi penjurian, rubrik, assignment juri, readiness, serta
  transisi buka/tutup penilaian tersedia dengan validasi status dan role.
- Manajemen profil menyediakan daftar, undangan Supabase tanpa password, aktivasi akun,
  pembatasan role Admin/Super Admin, kompensasi kegagalan, dan audit mutasi.
- Mutasi konfigurasi dan profil dijalankan dalam transaksi PostgreSQL bersama audit;
  konfigurasi yang sudah `configured` kembali menjadi `draft` setelah berubah dan
  terkunci saat `scoring_open`.
- Halaman Pengaturan Event memuat editor event, tiga lokasi dan matriks assignment,
  delapan kriteria dengan total real-time, checklist readiness, serta konfirmasi eksplisit
  sebelum membuka penilaian.
- Halaman Pengguna memuat roster, form undangan tanpa password, dan kontrol status yang
  mengikuti kewenangan akun aktif.

**Verification**

- `npm run verify`: pass — lint, 84 test (5 contracts, 39 API, 40 web), dan production
  build seluruh workspace.
- Business tests: pass — total rubrik selain 100, lokasi/juri belum lengkap, mutation
  setelah scoring dibuka, dan assignment ganda seluruhnya ditolak.
- Runtime PostgreSQL smoke: pass — readiness, invalid rubric, duplicate assignment,
  open/config lock, close, dan tujuh audit entry diverifikasi pada Supabase lokal.
- `npm run db:reset` dan `npm run db:lint`: pass; `npm run test:db`: pass — 32 pgTAP.
- Responsive/accessibility checks: pass — editor 360 px tidak overflow, total/readiness
  memiliki status nonwarna, dialog multi-instance memiliki ID ARIA unik, dan aksi akun
  yang tidak berwenang tidak ditawarkan.
- Dependency review: `pg` dan type definition terpin serta berlisensi MIT; secret scan,
  format, `git diff --check`, dan code review final: pass.

**Files/areas changed**

- `packages/contracts/`: enum konfigurasi, error code, serta DTO event, lokasi, rubrik,
  assignment, readiness, dan pengguna.
- `apps/api/`: pool/transaksi PostgreSQL, modul event setup dan user management, route,
  validation, authorization, Supabase invitation provider, audit, test, dan dokumentasi.
- `apps/web/`: API client, runtime event ID, halaman Pengaturan Event dan Pengguna,
  responsive styles, route, component tests, serta perbaikan aksesibilitas dialog.

**Open decisions / risks**

- Tidak ada Product Decision yang masih terbuka dan tidak ada scope F6 yang dikerjakan.
- GitHub Actions pada clean checkout tetap memiliki risiko urutan workspace: test API
  dijalankan sebelum build output `@carnival/contracts` tersedia. Perubahan root script
  untuk masalah lama tersebut tidak dimasukkan karena belum diotorisasi dalam F5.
- `npm audit --omit=dev` melaporkan 9 high severity pada keluarga Angular 18. Fix yang
  ditawarkan memerlukan upgrade breaking di luar F5 dan tetap wajib sebelum deployment.

**Next allowed phase**

- F6 — Peserta dan jadwal.

---

## F6 — Peserta dan jadwal

### API

- [ ] CRUD peserta.
- [ ] Search/filter/pagination.
- [ ] Import CSV dengan preview dan error per baris.
- [ ] Update status dan waktu aktual.
- [ ] Status log append-only.
- [ ] Validasi nomor urut dan anggota.

### Web

- [ ] Daftar peserta.
- [ ] Form tambah/edit.
- [ ] Import CSV flow.
- [ ] Detail peserta.
- [ ] Monitor jadwal/status.
- [ ] Filter tersimpan di URL.

### Business tests

- [ ] Nomor urut unik.
- [ ] Anggota <30 membutuhkan alasan pengecualian.
- [ ] Jadwal seed benar.
- [ ] Perubahan status membuat status log.
- [ ] CSV invalid tidak menghasilkan partial write tanpa konfirmasi.

### Verification dan checkpoint

```bash
npm run verify
git add .
git commit -m "feat: manage carnival participants and schedule"
```

---

## F7 — Penilaian juri

### API

- [ ] Generate/lazy-create score sheet.
- [ ] Get sheet milik juri.
- [ ] Save draft dengan `version`.
- [ ] Submit idempotent.
- [ ] Validasi seluruh kriteria dan maksimum.
- [ ] Lock submitted sheet.
- [ ] Admin unlock + alasan + audit.
- [ ] Scoring progress endpoint.
- [ ] Sembunyikan nilai juri lain.

### Web

- [ ] Daftar peserta untuk juri.
- [ ] Form 8 kriteria.
- [ ] Autosave debounce.
- [ ] IndexedDB draft/retry.
- [ ] Konflik versi.
- [ ] Review dan submit dialog.
- [ ] Riwayat nilai sendiri.
- [ ] Matrix progres admin.

### Critical tests

- [ ] Skor negatif/lebih maksimum ditolak.
- [ ] Total dihitung server.
- [ ] Judge hanya mengubah sheet assignment sendiri.
- [ ] Retry submit tidak menduplikasi.
- [ ] Submitted sheet tidak dapat diedit.
- [ ] Unlock menyimpan before/after.
- [ ] Draft lokal tidak tertukar antar akun/sheet.

### Verification dan checkpoint

```bash
npm run verify
git add .
git commit -m "feat: implement secure judge scoring workflow"
```

---

## F8 — Operasional, atraksi, penalti

### API

- [ ] Participant status transitions.
- [ ] Attraction check upsert.
- [ ] Evidence upload opsional.
- [ ] Penalty types.
- [ ] Penalty create/confirm/cancel.
- [ ] Permission dan audit.

### Web

- [ ] Mobile operator monitor.
- [ ] Attraction checklist per peserta.
- [ ] Insiden/status update.
- [ ] Penalti list/form/approval.
- [ ] Alert item belum terverifikasi.

### Critical tests

- [ ] Satu check per peserta/titik.
- [ ] Cancelled penalty tidak dihitung.
- [ ] Confirmed penalty membutuhkan hak yang benar.
- [ ] Deduction tidak negatif.
- [ ] Evidensi dibatasi tipe/ukuran.
- [ ] Offline queue tidak mengirim submit final otomatis.

### Verification dan checkpoint

```bash
npm run verify
git add .
git commit -m "feat: add field operations attractions and penalties"
```

---

## F9 — Rekap, ranking, publikasi

### API

- [ ] Calculation service.
- [ ] Preview hasil per kategori.
- [ ] Incomplete/waiver handling.
- [ ] Tie-break.
- [ ] Snapshot versioning.
- [ ] Publish/unpublish policy.
- [ ] Public result endpoint.
- [ ] CSV exports.

### Web

- [ ] Result preview.
- [ ] Breakdown detail.
- [ ] Tab Pendidikan/Umum.
- [ ] Incomplete warnings.
- [ ] Publish confirmation.
- [ ] Public result page.
- [ ] Print view A4.

### Golden test data

Buat fixture kecil dengan nilai yang hasilnya dapat dihitung manual untuk:

- average
- sum
- attraction points
- multiple penalties
- final floor 0
- tie-break
- missing sheet
- waiver
- snapshot immutability

### Acceptance check

- Nilai UI sama dengan hasil perhitungan test.
- Ranking kategori tidak tercampur.
- Draft result tidak public.
- Published snapshot tetap sama walau data sumber berubah.
- Export sesuai preview snapshot.

### Verification dan checkpoint

```bash
npm run verify
git add .
git commit -m "feat: calculate rank and publish carnival results"
```

---

## F10 — Hardening dan UAT

### Security

- [ ] Review RLS semua tabel.
- [ ] Review service-role usage.
- [ ] Rate limit endpoint mutasi sensitif.
- [ ] Validasi upload.
- [ ] CORS production.
- [ ] Dependency audit.
- [ ] Test IDOR lintas event/participant/sheet.

### Reliability

- [ ] Simulasi koneksi putus saat draft.
- [ ] Simulasi double-click submit.
- [ ] Simulasi dua tab mengedit draft.
- [ ] Simulasi realtime gagal.
- [ ] Backup/restore rehearsal.
- [ ] Uji zona waktu WIB.

### Accessibility/UI

- [ ] Keyboard-only.
- [ ] Contrast.
- [ ] Screen reader labels.
- [ ] Touch target.
- [ ] 360/768/1024/1440px.
- [ ] Reduced motion.

### UAT scenario

- [ ] Admin menyiapkan event.
- [ ] Tiga juri login di perangkat berbeda.
- [ ] Peserta dinilai lengkap.
- [ ] Operator mencatat atraksi.
- [ ] Penalti dikonfirmasi.
- [ ] Nilai dibuka kembali satu kali.
- [ ] Scoring ditutup.
- [ ] Hasil dipreview dan dipublish.
- [ ] Viewer membuka hasil.
- [ ] Audit dapat menelusuri perubahan.

### Checkpoint

```bash
npm run verify
git add .
git commit -m "test: harden judging workflow for event operations"
```

---

## F11 — Deployment readiness

### Tasks

- [ ] Pisahkan env development/staging/production.
- [ ] Build Angular production.
- [ ] Build API Node 22.
- [ ] Setup migration command.
- [ ] Setup health check.
- [ ] Setup reverse proxy/TLS.
- [ ] Setup log rotation/aggregation.
- [ ] Setup backup Supabase.
- [ ] Buat runbook:
  - deploy
  - rollback
  - reset password juri
  - ganti juri
  - unlock nilai
  - jaringan bermasalah
  - publish/rollback hasil
- [ ] Buat checklist H-1 dan hari-H.
- [ ] Freeze release candidate.

### Final verification

```bash
npm ci
npm run verify
```

Manual:

- Login seluruh role.
- Test minimal satu peserta end-to-end.
- Pastikan tanggal/waktu WIB.
- Pastikan hasil public tidak memuat catatan internal.
- Pastikan service-role key tidak ada di browser bundle.
- Pastikan backup terakhir tersedia.

### Checkpoint

```bash
git add .
git commit -m "chore: prepare carnival judging system release"
```

---

## Template laporan setelah setiap fase

```md
### Phase report: F<number>

**Completed**

- ...

**Verification**

- `npm run lint`: pass/fail
- `npm run test`: pass/fail
- `npm run build`: pass/fail

**Files/areas changed**

- ...

**Open decisions / risks**

- ...

**Next allowed phase**

- F<number+1>
```
