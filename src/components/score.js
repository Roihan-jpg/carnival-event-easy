import { escapeHtml } from '../utils/html.js';

export function scoreInput(criterion, value = '', reason = '', disabled = false) {
  return `<div class="score-row" data-criterion="${criterion.id}">
    <div class="score-description"><div><strong>${escapeHtml(criterion.name)}</strong><span>Maksimum ${criterion.max}</span></div><p>${escapeHtml(criterion.hint)}</p></div>
    <div class="score-control">
      <button type="button" class="step-btn" data-step="-1" aria-label="Kurangi nilai ${escapeHtml(criterion.name)}" ${disabled ? 'disabled' : ''}><i data-lucide="Minus"></i></button>
      <label><span class="sr-only">Nilai ${escapeHtml(criterion.name)}</span><input type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="${criterion.max}" step="1" name="${criterion.id}" value="${escapeHtml(value)}" ${disabled ? 'disabled' : ''}></label>
      <span class="score-max">/ ${criterion.max}</span>
      <button type="button" class="step-btn" data-step="1" aria-label="Tambah nilai ${escapeHtml(criterion.name)}" ${disabled ? 'disabled' : ''}><i data-lucide="Plus"></i></button>
    </div>
    <small class="field-error score-error" data-score-error="${criterion.id}"></small>
    <label class="zero-reason ${Number(value) === 0 && value !== '' ? 'visible' : ''}"><span>Alasan nilai 0 *</span><textarea name="reason-${criterion.id}" rows="2" ${disabled ? 'disabled' : ''}>${escapeHtml(reason)}</textarea></label>
  </div>`;
}

export function scoreSummary(total = 0, status = 'saved', savedAt = '') {
  return `<aside class="score-summary" aria-label="Ringkasan nilai">
    <div class="score-total"><span>Total sementara</span><strong data-score-total>${total}</strong><small>/ 100 poin</small><div class="score-meter"><i data-score-meter style="width:${Math.min(total, 100)}%"></i></div></div>
    <div class="save-status ${status}" data-save-status><span class="save-dot"></span><span data-save-label>${saveLabel(status, savedAt)}</span></div>
    <div class="score-summary-actions"><button class="btn btn-secondary" type="button" data-save-draft><i data-lucide="Save"></i>Simpan draf</button><button class="btn btn-primary" type="button" data-review-score><i data-lucide="ClipboardCheck"></i>Review & kirim</button></div>
    <p><i data-lucide="LockKeyhole"></i>Nilai akan dikunci setelah dikirim.</p>
  </aside>`;
}

export function saveLabel(status, savedAt = '') {
  const labels = {
    unsaved: 'Perubahan belum tersimpan',
    saving: 'Menyimpan draf…',
    saved: savedAt ? `Tersimpan ${savedAt}` : 'Draf tersimpan',
    error: 'Gagal menyimpan · coba lagi',
  };
  return labels[status] || labels.saved;
}
