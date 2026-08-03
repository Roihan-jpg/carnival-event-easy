import { confirmDialog } from '../../components/modal.js';
import { dataTable, inlineAlert, pageHeader, statusBadge } from '../../components/ui.js';
import { showToast } from '../../components/toast.js';
import { dataService } from '../../services/dataService.js';
import { escapeHtml, participantById } from '../../utils/html.js';
import { navigate } from '../../core/router.js';

export async function penaltiesPage() {
  const [penalties, participants, penaltyTypes] = await Promise.all([dataService.getPenalties(), dataService.getParticipants(), dataService.getPenaltyTypes()]);
  const columns = [
    { label: 'Peserta', render: (row) => { const p = participantById(participants, row.participantId); return `<span class="matrix-participant"><span class="sequence-small">${String(p?.sequenceNumber || row.participantSequence).padStart(2, '0')}</span><strong>${escapeHtml(p?.name || row.participantName)}</strong></span>`; } },
    { label: 'Tingkat', render: (row) => `<span class="penalty-level ${row.type.toLowerCase()}">${escapeHtml(row.type)}</span>` },
    { label: 'Pengurangan', render: (row) => `<strong class="deduction">−${row.deduction} poin</strong>` },
    { label: 'Alasan', key: 'reason' },
    { label: 'Pencatat', key: 'actor' },
    { label: 'Status', render: (row) => statusBadge(row.status) },
    { label: 'Aksi', render: (row) => row.status !== 'cancelled' ? `<div class="row-actions">${row.status === 'draft' ? `<button class="btn btn-small btn-secondary" type="button" data-confirm-penalty="${row.id}">Konfirmasi</button>` : ''}<button class="icon-btn" type="button" data-cancel-penalty="${row.id}" aria-label="Batalkan penalti"><i data-lucide="XCircle"></i></button></div>` : '<span class="muted">Dibatalkan</span>' },
  ];
  return {
    html: `${pageHeader({ eyebrow: 'Pengurangan nilai', title: 'Penalti', description: 'Penalti dicatat terpisah dari nilai juri dan tidak dihapus dari riwayat.', actions: '<button class="btn btn-primary" type="button" data-add-penalty><i data-lucide="Plus"></i>Catat penalti</button>' })}
      ${inlineAlert({ tone: 'info', title: 'Aturan penalti', message: 'Ringan −2, Sedang −5, dan Berat −10 poin. Penalti berat memerlukan persetujuan.' })}
      <section class="penalty-summary"><div><span class="penalty-dot mild"></span><small>Ringan</small><strong>−2</strong></div><div><span class="penalty-dot medium"></span><small>Sedang</small><strong>−5</strong></div><div><span class="penalty-dot heavy"></span><small>Berat</small><strong>−10</strong></div><div class="total"><small>Total dikonfirmasi</small><strong>−${penalties.filter((p) => p.status === 'confirmed').reduce((sum, p) => sum + p.deduction, 0)} poin</strong></div></section>
      <section class="section-card table-card">${dataTable({ columns, rows: penalties })}</section>`,
    bind() {
      document.querySelector('[data-add-penalty]').addEventListener('click', async () => {
        const details = penaltyForm(participants, penaltyTypes);
        const values = await confirmDialog({ title: 'Catat penalti', message: 'Penalti baru disimpan sebagai draf sebelum dikonfirmasi.', confirmLabel: 'Simpan draf', details, collect: (dialog) => {
          const reason = dialog.querySelector('[name="penalty-reason"]').value.trim();
          const typeId = dialog.querySelector('[name="penalty-type"]').value;
          const type = penaltyTypes.find((item) => item.id === typeId);
          if (!reason || !type) return false;
          const occurred = dialog.querySelector('[name="penalty-time"]').value;
          return { participantId: dialog.querySelector('[name="participant-id"]').value, penaltyTypeId: type.id, deduction: type.default_deduction, reason, occurredAt: occurred ? new Date(occurred).toISOString() : new Date().toISOString() };
        } });
        if (!values) return;
        try { await dataService.createPenalty(values); showToast('Draf penalti berhasil disimpan.'); navigate('/admin/penalti', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      });
      document.querySelectorAll('[data-confirm-penalty]').forEach((button) => button.addEventListener('click', async () => {
        const penalty = penalties.find((item) => item.id === button.dataset.confirmPenalty);
        const approved = await confirmDialog({ title: 'Konfirmasi penalti', message: `Pengurangan ${penalty.deduction} poin akan dihitung pada nilai akhir dan dicatat di audit log.`, confirmLabel: 'Konfirmasi penalti', tone: penalty.type === 'Berat' ? 'danger' : 'primary' });
        if (!approved) return;
        try { await dataService.confirmPenalty(penalty.id); showToast('Penalti berhasil dikonfirmasi.'); navigate('/admin/penalti', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      }));
      document.querySelectorAll('[data-cancel-penalty]').forEach((button) => button.addEventListener('click', async () => {
        const reason = await confirmDialog({ title: 'Batalkan penalti?', message: 'Penalti tetap tersimpan pada audit tetapi tidak dihitung dalam hasil.', confirmLabel: 'Batalkan penalti', tone: 'danger', details: '<label class="field"><span>Alasan pembatalan *</span><textarea name="cancel-reason" rows="3"></textarea></label>', collect: (dialog) => dialog.querySelector('[name="cancel-reason"]').value.trim() || false });
        if (!reason) return;
        try { await dataService.cancelPenalty(button.dataset.cancelPenalty, reason); showToast('Penalti dibatalkan.'); navigate('/admin/penalti', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      }));
    },
  };
}

function penaltyForm(participants, penaltyTypes) {
  return `<div class="dialog-options"><label class="field"><span>Peserta *</span><select name="participant-id">${participants.map((participant) => `<option value="${participant.id}">#${String(participant.sequenceNumber).padStart(2, '0')} · ${escapeHtml(participant.name)}</option>`).join('')}</select></label><label class="field"><span>Tingkat *</span><select name="penalty-type">${penaltyTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.name)} · −${Number(type.default_deduction)} poin</option>`).join('')}</select></label><label class="field"><span>Alasan *</span><textarea name="penalty-reason" rows="3" placeholder="Jelaskan pelanggaran secara faktual"></textarea></label><label class="field"><span>Waktu kejadian</span><input name="penalty-time" type="datetime-local"></label></div>`;
}
