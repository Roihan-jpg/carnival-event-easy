import { refreshIcons } from './icons.js';
import { escapeHtml } from '../utils/html.js';

export function showToast(message, tone = 'success') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  while (region.children.length >= 2) region.firstElementChild.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `<i data-lucide="${tone === 'danger' ? 'AlertCircle' : 'CheckCircle2'}"></i><span>${escapeHtml(message)}</span><button type="button" aria-label="Tutup pemberitahuan"><i data-lucide="X"></i></button>`;
  region.append(toast);
  refreshIcons(toast);
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  setTimeout(() => toast.remove(), 3800);
}
