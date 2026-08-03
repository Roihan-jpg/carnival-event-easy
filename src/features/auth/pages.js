import { APP_CONFIG } from '../../config/app.js';
import { requestPasswordReset, signIn, updatePassword } from '../../core/auth.js';
import { navigate } from '../../core/router.js';
import { defaultRoute } from '../../core/permissions.js';
import { getState } from '../../core/state.js';
import { escapeHtml } from '../../utils/html.js';
import logoUrl from '../../assets/logo.png';

export function loginPage() {
  const sessionMessage = getState().sessionMessage || '';
  return {
    html: `<main class="login-page" id="main-content">
      <section class="login-identity">
        <a class="public-brand" href="/hasil" data-link><span class="brand-mark large"><img class="brand-logo" src="${logoUrl}" alt="Logo Randuagung"></span><span><strong>Randuagung 2026</strong><small>Kecamatan Randuagung</small></span></a>
        <div class="login-message"><p class="eyebrow">Sistem penjurian resmi</p><h1>Menilai karya,<br><em>merawat budaya.</em></h1><p>Satu ruang kerja yang tertib untuk panitia, juri, dan petugas lapangan Karnaval Kecamatan Randuagung.</p></div>
        <div class="login-event"><div><i data-lucide="CalendarDays"></i><span><small>Pelaksanaan</small><strong>Sabtu, 22 Agustus 2026</strong></span></div><div><i data-lucide="MapPin"></i><span><small>Rute</small><strong>Pasar Tunjung – Kantor Kecamatan</strong></span></div></div>
      </section>
      <section class="login-form-panel"><div class="login-form-wrap"><div class="mobile-login-brand"><span class="brand-mark"><img class="brand-logo" src="${logoUrl}" alt="Logo Randuagung"></span><strong>Randuagung 2026</strong></div><p class="eyebrow">Akses petugas</p><h2>Masuk ke sistem</h2><p>Gunakan akun yang telah diberikan oleh panitia.</p>
        <form data-login-form novalidate><label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" placeholder="nama@randuagung.go.id" required><small class="field-error" data-login-error="email"></small></label><label class="field"><span>Kata sandi</span><input name="password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required><small class="field-error" data-login-error="password"></small></label><div class="form-row"><span></span><button class="text-button" type="button" data-password-reset>Lupa kata sandi?</button></div><div class="login-error" data-login-message role="alert">${escapeHtml(sessionMessage)}</div><button class="btn btn-primary btn-block" type="submit" data-login-submit>Masuk <i data-lucide="ChevronRight"></i></button></form>
        <a href="/hasil" data-link class="public-result-link"><i data-lucide="Trophy"></i>Lihat hasil karnaval yang diterbitkan</a>
      </div><footer>© 2026 Panitia Karnaval Kecamatan Randuagung</footer></section>
    </main>`,
    bind() {
      const form = document.querySelector('[data-login-form]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        form.querySelectorAll('.field-error').forEach((node) => { node.textContent = ''; });
        document.querySelector('[data-login-message]').textContent = '';
        let invalid = false;
        if (!values.email) { form.querySelector('[data-login-error="email"]').textContent = 'Email wajib diisi.'; invalid = true; }
        if (!values.password) { form.querySelector('[data-login-error="password"]').textContent = 'Kata sandi wajib diisi.'; invalid = true; }
        if (invalid) { form.querySelector('.field-error:not(:empty)').closest('label').querySelector('input').focus(); return; }
        const submit = form.querySelector('[data-login-submit]');
        try {
          submit.disabled = true;
          submit.textContent = 'Memeriksa akun…';
          const user = await signIn(values.email, values.password);
          navigate(defaultRoute(user.role), { replace: true });
        } catch (error) {
          document.querySelector('[data-login-message]').textContent = error.message;
          submit.disabled = false;
          submit.textContent = 'Masuk';
        }
      });
      form.querySelector('[data-password-reset]').addEventListener('click', async () => {
        const message = document.querySelector('[data-login-message]');
        try {
          await requestPasswordReset(form.elements.email.value);
          message.textContent = 'Tautan pemulihan telah dikirim bila email terdaftar.';
        } catch (error) { message.textContent = error.message; }
      });
    },
  };
}

export function systemStatePage(type) {
  const states = {
    unauthorized: { icon: 'ShieldAlert', code: '403', title: 'Akses tidak diizinkan', message: 'Akun Anda tidak memiliki izin untuk membuka halaman ini.', action: '<a class="btn btn-primary" href="/" data-link>Kembali ke halaman utama</a>' },
    offline: { icon: 'WifiOff', code: 'Luring', title: 'Koneksi terputus', message: 'Periksa koneksi internet. Draf nilai yang sudah diisi tetap aman di perangkat ini.', action: '<a class="btn btn-primary" href=""><i data-lucide="RefreshCw"></i>Coba lagi</a>' },
    error: { icon: 'AlertCircle', code: 'Gangguan', title: 'Data belum dapat dimuat', message: 'Terjadi kendala saat mengambil data. Coba muat ulang beberapa saat lagi.', action: '<a class="btn btn-primary" href=""><i data-lucide="RefreshCw"></i>Muat ulang</a>' },
    notFound: { icon: 'FileText', code: '404', title: 'Halaman tidak ditemukan', message: 'Alamat mungkin berubah atau halaman sudah tidak tersedia.', action: '<a class="btn btn-primary" href="/" data-link>Kembali ke halaman utama</a>' },
  };
  const state = states[type];
  return { html: `<main class="system-page" id="main-content"><a class="public-brand" href="/" data-link><span class="brand-mark"><img class="brand-logo" src="${logoUrl}" alt="Logo Randuagung"></span><span><strong>Randuagung 2026</strong><small>${escapeHtml(APP_CONFIG.name)}</small></span></a><section><div class="system-code">${state.code}</div><span class="system-icon"><i data-lucide="${state.icon}"></i></span><h1>${state.title}</h1><p>${state.message}</p>${state.action}</section></main>` };
}

export function resetPasswordPage() {
  return {
    html: `<main class="login-page" id="main-content"><section class="login-identity"><a class="public-brand" href="/hasil" data-link><span class="brand-mark large"><img class="brand-logo" src="${logoUrl}" alt="Logo Randuagung"></span><span><strong>Randuagung 2026</strong><small>Kecamatan Randuagung</small></span></a><div class="login-message"><p class="eyebrow">Pemulihan akun</p><h1>Buat akses baru<br><em>yang aman.</em></h1><p>Tautan pemulihan hanya dapat digunakan selama sesi pemulihan masih berlaku.</p></div></section><section class="login-form-panel"><div class="login-form-wrap"><p class="eyebrow">Kata sandi baru</p><h2>Perbarui kata sandi</h2><p>Gunakan minimal delapan karakter dan jangan membagikannya kepada siapa pun.</p><form data-reset-form><label class="field"><span>Kata sandi baru</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label class="field"><span>Ulangi kata sandi</span><input name="confirmation" type="password" minlength="8" autocomplete="new-password" required></label><div class="login-error" data-reset-message role="alert"></div><button class="btn btn-primary btn-block" type="submit">Simpan kata sandi</button></form></div></section></main>`,
    bind() {
      const form = document.querySelector('[data-reset-form]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        const message = document.querySelector('[data-reset-message]');
        if (values.password !== values.confirmation) { message.textContent = 'Konfirmasi kata sandi tidak sama.'; return; }
        const submit = form.querySelector('button[type="submit"]');
        try {
          submit.disabled = true;
          await updatePassword(values.password);
          navigate('/login', { replace: true });
        } catch (error) { message.textContent = error.message; submit.disabled = false; }
      });
    },
  };
}
