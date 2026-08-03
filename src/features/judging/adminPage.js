import { dataService } from '../../services/dataService.js';
import { dataTable, pageHeader, statusBadge } from '../../components/ui.js';
import { escapeHtml, participantById } from '../../utils/html.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { getState } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { bindLiveRefresh } from '../../services/liveUpdates.js';

export async function judgingMonitorPage() {
  const [event, participants, progress, sheets, locations] = await Promise.all([dataService.getActiveEvent(), dataService.getParticipants(), dataService.getJudgingProgress(), dataService.getScoreSheets(), dataService.getLocations()]);
  const complete = progress.filter((row) => [row.start, row.gedangmas, row.finish].every((status) => status === 'submitted')).length;
  const columns = [
    { label: 'Peserta', render: (row) => { const p = participantById(participants, row.participantId); return `<span class="matrix-participant"><span class="sequence-small">${String(p.sequenceNumber).padStart(2, '0')}</span><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)}</small></span></span>`; } },
    { label: 'Start', render: (row) => statusBadge(row.start) },
    { label: 'B. Edi', render: (row) => statusBadge(row.gedangmas) },
    { label: 'Finish', render: (row) => statusBadge(row.finish) },
    { label: 'Kelengkapan', render: (row) => { const count = [row.start, row.gedangmas, row.finish].filter((s) => s === 'submitted').length; return `<div class="progress-inline"><span><strong>${count}</strong>/3</span><div class="mini-progress"><i style="width:${count / 3 * 100}%"></i></div></div>`; } },
    { label: 'Aksi', render: (row) => getState().user?.role === 'super_admin' ? `<button class="btn btn-small btn-secondary" type="button" data-manage-score="${row.participantId}">Kelola</button>` : `<a class="icon-btn" href="/admin/peserta/${row.participantId}" data-link aria-label="Detail peserta"><i data-lucide="ChevronRight"></i></a>` },
  ];
  return {
    html: `${pageHeader({ eyebrow: 'Tiga titik penilaian', title: 'Monitor Progres Juri', description: 'Nilai tiap juri tetap tersembunyi selama penjurian berlangsung.', actions: '<button class="btn btn-secondary" type="button"><i data-lucide="Download"></i>Ekspor progres</button>' })}
      <div class="summary-line"><div><strong>${complete}</strong><span>peserta lengkap</span></div><div><strong>${participants.length - complete}</strong><span>belum lengkap</span></div><div><strong>${locations.length}</strong><span>titik penilaian</span></div><div class="summary-progress"><span>${participants.length ? Math.round(complete / participants.length * 100) : 0}% tuntas</span><div class="mini-progress"><i style="width:${participants.length ? complete / participants.length * 100 : 0}%"></i></div></div></div>
      <section class="section-card table-card"><div class="matrix-legend"><span>${statusBadge('submitted')}</span><span>${statusBadge('draft')}</span><span>${statusBadge('not_started')}</span><span>${statusBadge('unlocked')}</span><span>${statusBadge('waived')}</span></div>${dataTable({ columns, rows: progress, className: 'progress-matrix' })}</section>`,
    bind() {
      document.querySelectorAll('[data-manage-score]').forEach((button) => button.addEventListener('click', async () => {
        const participantId = button.dataset.manageScore;
        const participant = participantById(participants, participantId);
        const participantSheets = sheets.filter((sheet) => sheet.participantId === participantId);
        const values = await confirmDialog({ title: `Kelola nilai #${String(participant.sequenceNumber).padStart(2, '0')}`, message: 'Unlock hanya untuk nilai submitted. Waiver memerlukan minimal dua nilai submitted.', confirmLabel: 'Lanjutkan', details: `<div class="dialog-options"><label class="field"><span>Tindakan</span><select name="score-action"><option value="unlock">Buka kembali nilai</option><option value="waive">Waiver nilai hilang</option></select></label><label class="field"><span>Lokasi</span><select name="location-id">${locations.map((location) => `<option value="${location.id}">${escapeHtml(location.name)}</option>`).join('')}</select></label><label class="field"><span>Alasan *</span><textarea name="reason" rows="2"></textarea></label><label class="field"><span>Referensi berita acara (waiver)</span><input name="minutes-reference"></label></div>`, collect: (dialog) => { const action = dialog.querySelector('[name="score-action"]').value; const reason = dialog.querySelector('[name="reason"]').value.trim(); const minutesReference = dialog.querySelector('[name="minutes-reference"]').value.trim(); if (!reason || (action === 'waive' && !minutesReference)) return false; return { action, locationId: dialog.querySelector('[name="location-id"]').value, reason, minutesReference }; } });
        if (!values) return;
        try {
          if (values.action === 'unlock') {
            const sheet = participantSheets.find((item) => item.locationId === values.locationId && item.status === 'submitted');
            if (!sheet) throw new Error('Tidak ada nilai submitted pada lokasi tersebut.');
            await dataService.unlockScoreSheet(sheet.id, values.reason);
          } else {
            await dataService.waiveScore(participantId, values.locationId, values.reason, values.minutesReference);
          }
          showToast('Status nilai diperbarui.');
          navigate('/admin/penjurian', { replace: true });
        } catch (error) { showToast(error.message, 'danger'); }
      }));
      return bindLiveRefresh({ eventId: event.id, tables: ['score_sheets'] });
    },
  };
}
