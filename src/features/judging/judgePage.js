import { confirmDialog } from '../../components/modal.js';
import { scoreInput, scoreSummary, saveLabel } from '../../components/score.js';
import { dataTable, inlineAlert, pageHeader, statusBadge } from '../../components/ui.js';
import { showToast } from '../../components/toast.js';
import { navigate } from '../../core/router.js';
import { dataService } from '../../services/dataService.js';
import { calculateScoreTotal, validateScores } from '../../utils/scoring.js';
import { escapeHtml, participantById } from '../../utils/html.js';

export async function judgeListPage() {
  const [event, participants, sheets, assignment] = await Promise.all([
    dataService.getActiveEvent(), dataService.getParticipants(), dataService.getScoreSheets(), dataService.getMyAssignment(),
  ]);
  if (!assignment) return { html: inlineAlert({ tone: 'warning', title: 'Belum ada penugasan aktif', message: 'Hubungi Admin Panitia sebelum mulai menilai.' }) };
  const location = assignment.judging_locations;
  const columns = [
    { label: 'Urut', render: (row) => `<span class="sequence-number">${String(row.sequenceNumber).padStart(2, '0')}</span>` },
    { label: 'Peserta', render: (row) => `<strong>${escapeHtml(row.name)}</strong><small class="cell-subtext">${escapeHtml(row.theme)}</small>` },
    { label: 'Kategori', key: 'category' },
    { label: 'Jadwal', render: (row) => `<span class="numeric">${row.scheduledTime} WIB</span>` },
    { label: 'Status nilai', render: (row) => statusBadge(sheets.find((sheet) => sheet.participantId === row.id)?.status || 'not_started') },
    { label: 'Terakhir disimpan', render: (row) => sheets.find((sheet) => sheet.participantId === row.id)?.updatedAt || '—' },
    { label: 'Aksi', render: (row) => {
      const sheet = sheets.find((item) => item.participantId === row.id);
      const editable = event.status === 'scoring_open' || sheet?.status === 'unlocked';
      if (!editable && !['submitted', 'waived'].includes(sheet?.status)) return '<span class="muted">Penjurian ditutup</span>';
      const viewOnly = ['submitted', 'waived'].includes(sheet?.status);
      return `<a class="btn btn-small ${viewOnly ? 'btn-secondary' : 'btn-primary'}" href="/juri/penilaian/${row.id}" data-link>${viewOnly ? '<i data-lucide="Eye"></i>Lihat nilai' : '<i data-lucide="Edit3"></i>Lanjutkan nilai'}</a>`;
    } },
  ];
  return {
    html: `${pageHeader({ eyebrow: `Penugasan · ${location.name}`, title: 'Daftar Penilaian', description: 'Nilai hanya peserta pada titik penugasan Anda. Nilai juri lain tidak ditampilkan.' })}
      ${event.status !== 'scoring_open' ? inlineAlert({ tone: 'info', title: 'Penjurian tidak sedang dibuka', message: 'Lembar submitted tetap dapat dilihat. Hanya lembar yang resmi dibuka kembali oleh Super Admin yang dapat dikoreksi.' }) : ''}
      <section class="judge-assignment"><span class="assignment-icon"><i data-lucide="MapPin"></i></span><div><small>Lokasi penilaian</small><strong>${escapeHtml(location.name)} · ${escapeHtml(location.address_note || '')}</strong></div><div class="assignment-stat"><strong>${sheets.filter((s) => s.status === 'submitted').length}/${participants.length}</strong><span>sudah dikirim</span></div></section>
      <section class="section-card table-card">${dataTable({ columns, rows: participants })}</section>`,
  };
}

export async function scoreFormPage({ id }) {
  const [participant, sheet, criteria, assignment] = await Promise.all([
    dataService.getParticipant(id), dataService.getScoreSheet(id), dataService.getCriteria(), dataService.getMyAssignment(),
  ]);
  if (!participant || !sheet || !assignment) return { html: inlineAlert({ tone: 'danger', title: 'Lembar nilai tidak ditemukan', message: 'Peserta ini tidak termasuk penugasan Anda.' }) };
  const storageKey = `karnaval:draft:${sheet.eventId}:${sheet.id}:${sheet.judgeId}:v1`;
  let stored;
  try {
    const candidate = JSON.parse(localStorage.getItem(storageKey));
    stored = candidate?.version === sheet.version ? candidate : null;
  } catch { stored = null; }
  const current = stored || sheet;
  const isLocked = sheet.status === 'submitted' || sheet.status === 'waived';
  const initialTotal = calculateScoreTotal(Object.values(current.scores || {}));

  return {
    html: `${pageHeader({ eyebrow: `Lembar penilaian · ${assignment.judging_locations.name}`, title: `Peserta #${String(participant.sequenceNumber).padStart(2, '0')}`, description: participant.name, actions: '<a class="btn btn-secondary" href="/juri/penilaian" data-link><i data-lucide="ArrowLeft"></i>Kembali ke daftar</a>' })}
      <section class="score-participant-header"><span class="participant-medallion">${String(participant.sequenceNumber).padStart(2, '0')}</span><div><span>${escapeHtml(participant.category)}</span><h2>${escapeHtml(participant.name)}</h2><p>“${escapeHtml(participant.theme)}”</p></div><div>${statusBadge(isLocked ? sheet.status : sheet.status)}</div></section>
      ${isLocked ? inlineAlert({ tone: 'info', title: 'Nilai telah dikirim dan dikunci', message: 'Hubungi Super Admin bila nilai perlu dibuka kembali dengan alasan resmi.' }) : ''}
      <form class="scoring-layout" data-score-form novalidate>
        <div class="score-list"><div class="score-list-heading"><div><p class="eyebrow">8 kriteria · total maksimum 100</p><h2>Isi nilai peserta</h2></div><span>Gunakan angka bulat</span></div>${criteria.map((criterion) => scoreInput(criterion, current.scores?.[criterion.id] ?? '', current.reasons?.[criterion.id] || '', isLocked)).join('')}
          <label class="field general-note"><span>Catatan umum <small>Opsional</small></span><textarea name="note" rows="4" placeholder="Catatan untuk dokumentasi penilaian…" ${isLocked ? 'disabled' : ''}>${escapeHtml(current.generalNote || current.note || '')}</textarea></label>
        </div>
        ${scoreSummary(initialTotal, stored ? 'unsaved' : 'saved', sheet.updatedAt)}
      </form>`,
    bind() {
      const form = document.querySelector('[data-score-form]');
      if (isLocked) {
        form.querySelectorAll('button').forEach((button) => { button.disabled = true; });
        return;
      }
      let autosaveTimer;
      let currentVersion = sheet.version;
      let savingPromise = Promise.resolve();
      const readValues = () => ({
        scores: Object.fromEntries(criteria.map((criterion) => [criterion.id, form.elements[criterion.id].value])),
        reasons: Object.fromEntries(criteria.map((criterion) => [criterion.id, form.elements[`reason-${criterion.id}`].value])),
        generalNote: form.elements.note.value,
      });
      const updateTotal = () => {
        const values = readValues();
        const total = calculateScoreTotal(Object.values(values.scores));
        form.querySelector('[data-score-total]').textContent = total;
        form.querySelector('[data-score-meter]').style.width = `${Math.min(total, 100)}%`;
        criteria.forEach((criterion) => {
          form.querySelector(`[data-criterion="${criterion.id}"] .zero-reason`).classList.toggle('visible', values.scores[criterion.id] !== '' && Number(values.scores[criterion.id]) === 0);
        });
        return { values, total };
      };
      const setSaveState = (status, savedAt = '') => {
        const node = form.querySelector('[data-save-status]');
        node.className = `save-status ${status}`;
        form.querySelector('[data-save-label]').textContent = saveLabel(status, savedAt);
      };
      const persistLocal = (values) => localStorage.setItem(storageKey, JSON.stringify({ ...values, version: currentVersion, savedAt: new Date().toISOString() }));
      const saveDraft = async () => {
        const values = readValues();
        persistLocal(values);
        const invalidZero = criteria.some((criterion) => Number(values.scores[criterion.id]) === 0 && values.scores[criterion.id] !== '' && !values.reasons[criterion.id].trim());
        if (invalidZero) { setSaveState('unsaved'); return null; }
        setSaveState('saving');
        savingPromise = savingPromise.catch(() => null).then(async () => {
          const saved = await dataService.saveScoreDraft(sheet.id, currentVersion, values.scores, values.reasons, values.generalNote);
          currentVersion = saved.version;
          persistLocal(values);
          const savedAt = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          setSaveState('saved', `${savedAt} WIB`);
          return saved;
        }).catch((error) => {
          setSaveState('error');
          showToast(error.message, 'danger');
          throw error;
        });
        return savingPromise;
      };
      form.addEventListener('input', () => {
        setSaveState('unsaved');
        const values = updateTotal().values;
        persistLocal(values);
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => { saveDraft().catch(() => {}); }, 800);
      });
      form.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
        const input = button.closest('.score-row').querySelector('input[type="number"]');
        input.value = Math.max(0, Math.min(Number(input.max), (Number(input.value) || 0) + Number(button.dataset.step)));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }));
      form.querySelector('[data-save-draft]').addEventListener('click', async () => {
        try { await saveDraft(); showToast('Draf nilai tersimpan di Supabase dan perangkat.'); } catch { /* status sudah ditampilkan */ }
      });
      form.querySelector('[data-review-score]').addEventListener('click', async () => {
        const { values, total } = updateTotal();
        form.querySelectorAll('[data-score-error]').forEach((node) => { node.textContent = ''; });
        const errors = validateScores(values.scores, values.reasons, criteria);
        Object.entries(errors).forEach(([criterion, message]) => { form.querySelector(`[data-score-error="${criterion}"]`).textContent = message; });
        if (Object.keys(errors).length) {
          form.querySelector('.score-error:not(:empty)')?.closest('.score-row')?.querySelector('input')?.focus();
          showToast('Periksa kembali nilai yang belum valid.', 'danger');
          return;
        }
        const details = `<div class="review-score"><div><span>Total nilai</span><strong>${total}<small>/100</small></strong></div><ul>${criteria.map((criterion) => `<li><span>${escapeHtml(criterion.name)}</span><strong>${values.scores[criterion.id]} / ${criterion.max}</strong></li>`).join('')}</ul></div>`;
        const confirmed = await confirmDialog({ title: 'Review dan kirim nilai', message: 'Setelah dikirim, lembar nilai akan dikunci.', confirmLabel: 'Kirim & kunci nilai', details });
        if (!confirmed) return;
        try {
          clearTimeout(autosaveTimer);
          await saveDraft();
          await dataService.submitScoreSheet(sheet.id, currentVersion);
          localStorage.removeItem(storageKey);
          showToast(`Nilai ${participant.name} berhasil dikirim dan dikunci.`);
          navigate('/juri/riwayat');
        } catch (error) { showToast(error.message, 'danger'); }
      });
      return () => clearTimeout(autosaveTimer);
    },
  };
}

export async function judgeHistoryPage() {
  const [participants, sheets, assignment] = await Promise.all([dataService.getParticipants(), dataService.getScoreSheets(), dataService.getMyAssignment()]);
  const submitted = sheets.filter((sheet) => sheet.status === 'submitted');
  const columns = [
    { label: 'Peserta', render: (row) => { const participant = participantById(participants, row.participantId); return `<span class="matrix-participant"><span class="sequence-small">${String(participant.sequenceNumber).padStart(2, '0')}</span><strong>${escapeHtml(participant.name)}</strong></span>`; } },
    { label: 'Kategori', render: (row) => participantById(participants, row.participantId).category },
    { label: 'Total saya', render: (row) => `<strong class="score-value">${row.total}</strong><span class="muted"> /100</span>` },
    { label: 'Status', render: () => statusBadge('submitted') },
    { label: 'Dikirim', key: 'updatedAt' },
    { label: '', render: (row) => `<a class="icon-btn" href="/juri/penilaian/${row.participantId}" data-link aria-label="Lihat nilai"><i data-lucide="Eye"></i></a>` },
  ];
  return { html: `${pageHeader({ eyebrow: 'Arsip pribadi', title: 'Riwayat Nilai Saya', description: `Hanya nilai Anda di ${escapeHtml(assignment?.judging_locations?.name || 'titik penugasan')} yang ditampilkan.` })}<section class="section-card table-card">${dataTable({ columns, rows: submitted })}</section>` };
}

export function judgeGuidePage() {
  return { html: `${pageHeader({ eyebrow: 'Panduan juri', title: 'Penilaian yang Konsisten', description: 'Gunakan rubrik yang sama untuk setiap peserta dan simpan catatan faktual.' })}<div class="guide-grid">${[
    ['01', 'Amati penampilan utuh', 'Nilai berdasarkan penampilan di titik tugas Anda, bukan informasi dari titik lain.'],
    ['02', 'Gunakan angka bulat', 'Setiap kriteria memiliki batas maksimum. Nilai nol wajib disertai alasan.'],
    ['03', 'Simpan draf', 'Draf tersimpan otomatis di Supabase dan tetap tersedia saat jaringan terputus singkat.'],
    ['04', 'Review sebelum kirim', 'Periksa delapan kriteria dan total. Nilai terkunci setelah dikirim.'],
  ].map(([number, title, text]) => `<article class="guide-card"><span>${number}</span><div><h2>${title}</h2><p>${text}</p></div></article>`).join('')}</div>${inlineAlert({ tone: 'info', title: 'Independensi juri', message: 'Nilai juri lain tidak ditampilkan selama penjurian dibuka.' })}` };
}
