import { escapeHtml } from '../utils/html.js';

const statusMap = {
  draft: ['Draf', 'warning', 'FileClock'],
  registered: ['Terdaftar', 'neutral', 'ClipboardList'],
  not_started: ['Belum dimulai', 'neutral', 'Circle'],
  submitted: ['Dikirim', 'success', 'CheckCircle2'],
  unlocked: ['Dibuka kembali', 'warning', 'RefreshCw'],
  waived: ['Waiver', 'info', 'ShieldAlert'],
  completed: ['Selesai', 'success', 'CheckCircle2'],
  arrived: ['Tiba', 'info', 'MapPin'],
  departed: ['Berangkat', 'info', 'ChevronRight'],
  performing: ['Tampil', 'accent', 'Sparkles'],
  called: ['Dipanggil', 'warning', 'Radio'],
  standby: ['Antre', 'neutral', 'Clock3'],
  issue: ['Bermasalah', 'danger', 'AlertCircle'],
  confirmed: ['Dikonfirmasi', 'success', 'CheckCircle2'],
  cancelled: ['Dibatalkan', 'neutral', 'XCircle'],
  performed: ['Tampil', 'success', 'CheckCircle2'],
  not_performed: ['Tidak tampil', 'danger', 'XCircle'],
  unable_to_verify: ['Belum terverifikasi', 'warning', 'AlertTriangle'],
  active: ['Aktif', 'success', 'CheckCircle2'],
  inactive: ['Nonaktif', 'neutral', 'Circle'],
  published: ['Diterbitkan', 'success', 'CheckCircle2'],
  scoring_open: ['Penjurian dibuka', 'accent', 'Radio'],
  configured: ['Terkonfigurasi', 'info', 'Settings2'],
  scoring_closed: ['Penjurian ditutup', 'warning', 'LockKeyhole'],
  archived: ['Diarsipkan', 'neutral', 'Archive'],
  withdrawn: ['Mengundurkan diri', 'neutral', 'UserMinus'],
};

export function statusBadge(status, label) {
  const [defaultLabel, tone, icon] = statusMap[status] || [status, 'neutral', 'Circle'];
  return `<span class="status-badge status-${tone}"><i data-lucide="${icon}"></i>${escapeHtml(label || defaultLabel)}</span>`;
}

export function pageHeader({ eyebrow, title, description, actions = '' }) {
  return `<header class="page-header">
    <div class="min-w-0">
      ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
      <h1>${escapeHtml(title)}</h1>
      ${description ? `<p>${escapeHtml(description)}</p>` : ''}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </header>`;
}

export function inlineAlert({ tone = 'info', title, message, action = '' }) {
  const icon = tone === 'danger' ? 'AlertCircle' : tone === 'warning' ? 'AlertTriangle' : tone === 'success' ? 'CheckCircle2' : 'Info';
  return `<div class="alert alert-${tone}" role="${tone === 'danger' ? 'alert' : 'status'}">
    <i data-lucide="${icon}"></i>
    <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>
    ${action}
  </div>`;
}

export function emptyState({ title, message, action = '' }) {
  return `<div class="empty-state"><div class="empty-icon"><i data-lucide="FileText"></i></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p>${action}</div>`;
}

export function loadingState(label = 'Memuat data') {
  return `<div class="loading-state" role="status" aria-live="polite"><span class="spinner"></span><span>${escapeHtml(label)}…</span></div>`;
}

export function filterBar(content, resultText = '') {
  return `<div class="filter-bar"><div class="filter-controls">${content}</div>${resultText ? `<span class="filter-result">${escapeHtml(resultText)}</span>` : ''}</div>`;
}

export function dataTable({ columns, rows, emptyTitle = 'Belum ada data', emptyMessage = 'Data akan tampil di sini setelah tersedia.', className = '' }) {
  if (!rows.length) return emptyState({ title: emptyTitle, message: emptyMessage });
  return `<div class="table-wrap ${className}" tabindex="0" role="region" aria-label="Tabel data">
    <table class="data-table">
      <thead><tr>${columns.map((column) => `<th scope="col" class="${column.className || ''}">${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td class="${column.className || ''}" data-label="${escapeHtml(column.label)}">${column.render ? column.render(row) : escapeHtml(row[column.key] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

export function segmentedTabs(tabs, active) {
  return `<div class="segmented-tabs" role="tablist">${tabs.map((tab) => `<button class="segment ${tab.id === active ? 'active' : ''}" type="button" role="tab" aria-selected="${tab.id === active}" data-tab="${tab.id}">${escapeHtml(tab.label)}</button>`).join('')}</div>`;
}
