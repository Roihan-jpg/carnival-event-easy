import { APP_CONFIG } from '../config/app.js';
import { getState, setState } from '../core/state.js';
import { escapeHtml } from '../utils/html.js';
import { NAVIGATION } from './navigation.js';
import logoUrl from '../assets/logo.png';

function navMarkup(role, currentPath) {
  const roleNavigation = role === 'super_admin' ? NAVIGATION.admin : NAVIGATION[role];
  return (roleNavigation || []).map((item) => {
    const active = currentPath === item.path || (item.path !== '/admin/dashboard' && currentPath.startsWith(`${item.path}/`));
    return `<a class="nav-item ${active ? 'active' : ''}" href="${item.path}" data-link ${active ? 'aria-current="page"' : ''}>
      <i data-lucide="${item.icon}"></i><span>${escapeHtml(item.label)}</span>
    </a>`;
  }).join('');
}

export function appShell(content) {
  const { user, sidebarCollapsed, mobileMenuOpen, online, activeEvent } = getState();
  const path = window.location.pathname;
  const eventName = activeEvent?.name || APP_CONFIG.eventName;
  const eventDate = activeEvent?.event_date
    ? new Date(`${activeEvent.event_date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : APP_CONFIG.eventDate;
  return `<div class="app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileMenuOpen ? 'drawer-open' : ''}">
    <div class="drawer-backdrop" data-close-drawer></div>
    <aside class="sidebar" aria-label="Navigasi utama">
      <a class="brand" href="${user ? `/${user.role === 'judge' ? 'juri/penilaian' : user.role === 'operator' ? 'operator/monitor' : 'admin/dashboard'}` : '/'}" data-link>
        <span class="brand-mark"><img class="brand-logo" src="${logoUrl}" alt="Logo Randuagung"></span>
        <span class="brand-copy"><strong>Randuagung</strong><small>Penjurian Karnaval</small></span>
      </a>
      <div class="event-chip"><span>Event aktif</span><strong>${escapeHtml(eventDate)}</strong></div>
      <nav class="nav-list">${navMarkup(user?.role, path)}</nav>
      <div class="sidebar-foot">
        <a class="nav-item" href="/hasil" data-link><i data-lucide="Eye"></i><span>Halaman Publik</span></a>
        <div class="cultural-rule" aria-hidden="true"></div>
        <span class="sidebar-version">Karnaval 2026 · v1.0</span>
      </div>
    </aside>
    <div class="shell-body">
      <header class="topbar">
        <div class="topbar-start">
          <button class="icon-btn mobile-only" type="button" data-menu-toggle aria-label="Buka navigasi"><i data-lucide="Menu"></i></button>
          <button class="icon-btn desktop-only" type="button" data-sidebar-toggle aria-label="Ciutkan navigasi"><i data-lucide="Menu"></i></button>
          <div class="event-title"><strong>${escapeHtml(eventName)}</strong><span>${online ? '<i data-lucide="Circle"></i> Terhubung' : '<i data-lucide="WifiOff"></i> Luring'}</span></div>
        </div>
        <div class="topbar-actions">
          <div class="user-block"><span class="avatar">${escapeHtml(user?.initials || '')}</span><span><strong>${escapeHtml(user?.name || '')}</strong><small>${escapeHtml(user?.roleLabel || '')}</small></span></div>
          <button class="icon-btn" type="button" data-logout aria-label="Keluar"><i data-lucide="LogOut"></i></button>
        </div>
      </header>
      ${!online ? '<div class="offline-banner" role="status"><i data-lucide="WifiOff"></i><span>Anda sedang luring. Perubahan draf akan dipertahankan di perangkat.</span></div>' : ''}
      <main id="main-content" class="main-content" tabindex="-1">${content}</main>
    </div>
  </div>`;
}

export function bindShellEvents() {
  document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => setState({ mobileMenuOpen: true }));
  document.querySelector('[data-close-drawer]')?.addEventListener('click', () => setState({ mobileMenuOpen: false }));
  document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => setState({ sidebarCollapsed: !getState().sidebarCollapsed }));
}
