import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/latin-600-italic.css';
import './styles.css';

import { restoreSession, signOut } from './core/auth.js';
import { configureRouter, navigate, resolveRoute } from './core/router.js';
import { getState, setState, subscribe } from './core/state.js';
import { confirmDialog } from './components/modal.js';
import { refreshIcons } from './components/icons.js';
import { loadingState } from './components/ui.js';
import { appShell, bindShellEvents } from './layouts/appShell.js';
import { loginPage, resetPasswordPage, systemStatePage } from './features/auth/pages.js';
import { dashboardPage } from './features/dashboard/page.js';
import { participantDetailPage, participantFormPage, participantsPage } from './features/participants/page.js';
import { incidentsPage, operatorMonitorPage, schedulePage } from './features/operations/page.js';
import { judgingMonitorPage } from './features/judging/adminPage.js';
import { judgeGuidePage, judgeHistoryPage, judgeListPage, scoreFormPage } from './features/judging/judgePage.js';
import { attractionsPage } from './features/attractions/page.js';
import { penaltiesPage } from './features/penalties/page.js';
import { resultsPage } from './features/results/page.js';
import { usersPage } from './features/users/page.js';
import { settingsPage } from './features/settings/page.js';
import { auditPage } from './features/audit/page.js';

const routes = [
  { path: '/', page: () => {
    const role = getState().user?.role;
    return { redirect: role === 'judge' ? '/juri/penilaian' : role === 'operator' ? '/operator/monitor' : ['admin', 'super_admin'].includes(role) ? '/admin/dashboard' : '/login' };
  }, shell: false },
  { path: '/login', page: loginPage, shell: false },
  { path: '/reset-password', page: resetPasswordPage, shell: false, auth: true },
  { path: '/unauthorized', page: () => systemStatePage('unauthorized'), shell: false },
  { path: '/offline', page: () => systemStatePage('offline'), shell: false },
  { path: '/error', page: () => systemStatePage('error'), shell: false },
  { path: '/hasil', page: () => resultsPage({ publicView: true }), shell: false },
  ...adminRoutes(),
  { path: '/juri/penilaian', page: judgeListPage, auth: true, roles: ['judge'] },
  { path: '/juri/penilaian/:id', page: scoreFormPage, auth: true, roles: ['judge'] },
  { path: '/juri/riwayat', page: judgeHistoryPage, auth: true, roles: ['judge'] },
  { path: '/juri/panduan', page: judgeGuidePage, auth: true, roles: ['judge'] },
  { path: '/operator/monitor', page: operatorMonitorPage, auth: true, roles: ['operator'] },
  { path: '/operator/atraksi', page: () => attractionsPage({ operator: true }), auth: true, roles: ['operator'] },
  { path: '/operator/insiden', page: incidentsPage, auth: true, roles: ['operator'] },
  { path: '*', page: () => systemStatePage('notFound'), shell: false },
];

function adminRoutes() {
  const roles = ['admin', 'super_admin'];
  return [
    { path: '/admin/dashboard', page: dashboardPage, auth: true, roles },
    { path: '/admin/peserta', page: participantsPage, auth: true, roles },
    { path: '/admin/peserta/tambah', page: participantFormPage, auth: true, roles },
    { path: '/admin/peserta/:id/edit', page: participantFormPage, auth: true, roles },
    { path: '/admin/peserta/:id', page: participantDetailPage, auth: true, roles },
    { path: '/admin/jadwal', page: schedulePage, auth: true, roles },
    { path: '/admin/penjurian', page: judgingMonitorPage, auth: true, roles },
    { path: '/admin/atraksi', page: () => attractionsPage(), auth: true, roles },
    { path: '/admin/penalti', page: penaltiesPage, auth: true, roles },
    { path: '/admin/hasil', page: () => resultsPage(), auth: true, roles },
    { path: '/admin/pengguna', page: usersPage, auth: true, roles },
    { path: '/admin/pengaturan', page: settingsPage, auth: true, roles },
    { path: '/admin/audit', page: auditPage, auth: true, roles },
  ];
}

const app = document.querySelector('#app');
let renderVersion = 0;
let currentPageCleanup;

configureRouter(routes, async (route, params) => {
  currentPageCleanup?.();
  currentPageCleanup = undefined;
  const currentVersion = ++renderVersion;
  app.innerHTML = route?.shell === false ? loadingState() : appShell(loadingState());
  refreshIcons();
  try {
    const page = await route.page(params);
    if (currentVersion !== renderVersion) return;
    if (page.redirect !== undefined) {
      const role = getState().user?.role;
      return navigate(page.redirect || (role === 'judge' ? '/juri/penilaian' : role === 'operator' ? '/operator/monitor' : '/admin/dashboard'), { replace: true });
    }
    app.innerHTML = route.shell === false ? page.html : appShell(page.html);
    refreshIcons();
    if (route.shell !== false) bindShellEvents();
    bindGlobalActions();
    const cleanup = page.bind?.();
    if (typeof cleanup === 'function') currentPageCleanup = cleanup;
    const isPublicResult = window.location.pathname === '/hasil';
    document.title = isPublicResult ? 'Hasil Karnaval Kecamatan Randuagung' : `${document.querySelector('h1')?.textContent || 'Penjurian'} · Randuagung 2026`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', isPublicResult
      ? 'Hasil resmi Karnaval Kecamatan Randuagung yang telah diterbitkan panitia.'
      : 'Sistem Penjurian Karnaval Kecamatan Randuagung.');
  } catch {
    if (import.meta.env.DEV) console.warn('Halaman tidak dapat dirender.');
    app.innerHTML = systemStatePage('error').html;
    refreshIcons();
  }
});

function bindGlobalActions() {
  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({ title: 'Keluar dari sistem?', message: 'Pastikan draf nilai telah tersimpan sebelum keluar.', confirmLabel: 'Keluar', tone: 'danger' });
    if (confirmed) { await signOut(); navigate('/login', { replace: true }); }
  });
}

try {
  await restoreSession();
} catch {
  setState({ user: null, authReady: true, sessionMessage: 'Konfigurasi koneksi Supabase belum tersedia.' });
}
let previousStructuralState = JSON.stringify({ user: getState().user, online: getState().online, sidebarCollapsed: getState().sidebarCollapsed, mobileMenuOpen: getState().mobileMenuOpen });
subscribe((state) => {
  const structuralState = JSON.stringify({ user: state.user, online: state.online, sidebarCollapsed: state.sidebarCollapsed, mobileMenuOpen: state.mobileMenuOpen });
  if (structuralState !== previousStructuralState) {
    previousStructuralState = structuralState;
    resolveRoute();
  }
});
resolveRoute();
