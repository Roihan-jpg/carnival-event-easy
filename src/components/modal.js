import { refreshIcons } from './icons.js';
import { escapeHtml } from '../utils/html.js';

export function confirmDialog({ title, message, confirmLabel = 'Konfirmasi', cancelLabel = 'Batal', tone = 'primary', details = '', collect }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `<div class="dialog-body">
      <div class="dialog-icon ${tone}"><i data-lucide="${tone === 'danger' ? 'AlertTriangle' : 'ClipboardCheck'}"></i></div>
      <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${details}</div>
    </div>
    <div class="dialog-actions">
      <button class="btn btn-secondary" type="button" data-dialog-cancel>${escapeHtml(cancelLabel)}</button>
      <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" type="button" data-dialog-confirm>${escapeHtml(confirmLabel)}</button>
    </div>`;
    document.body.append(dialog);
    refreshIcons(dialog);
    dialog.showModal();
    dialog.querySelector('[data-dialog-cancel]').focus();

    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => close(false));
    dialog.querySelector('[data-dialog-confirm]').addEventListener('click', async (event) => {
      if (!collect) return close(true);
      event.currentTarget.disabled = true;
      try {
        const value = await collect(dialog);
        if (value === false) { event.currentTarget.disabled = false; return; }
        close(value);
      } catch {
        event.currentTarget.disabled = false;
      }
    });
    dialog.addEventListener('cancel', () => close(false));
  });
}
