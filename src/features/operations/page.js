import { dataService } from '../../services/dataService.js';
import { confirmDialog } from '../../components/modal.js';
import { dataTable, filterBar, pageHeader, statusBadge } from '../../components/ui.js';
import { showToast } from '../../components/toast.js';
import { escapeHtml, participantById } from '../../utils/html.js';
import { navigate } from '../../core/router.js';
import { bindLiveRefresh } from '../../services/liveUpdates.js';

const statusOptions = [
  ['registered', 'Terdaftar'], ['standby', 'Antre'], ['called', 'Dipanggil'], ['performing', 'Tampil'], ['departed', 'Berangkat'], ['arrived', 'Tiba'], ['completed', 'Selesai'], ['issue', 'Bermasalah'], ['withdrawn', 'Mengundurkan diri'],
];

export async function schedulePage() {
  const [event, participants] = await Promise.all([dataService.getActiveEvent(), dataService.getParticipants()]);
  return operationalMonitor(event, participants, false);
}

export async function operatorMonitorPage() {
  const [event, participants] = await Promise.all([dataService.getActiveEvent(), dataService.getParticipants()]);
  return operationalMonitor(event, participants, true);
}

function operationalMonitor(event, participants, operatorMode) {
  const query = new URLSearchParams(window.location.search);
  const search = query.get('cari') || '';
  const status = query.get('status') || 'semua';
  const filtered = participants.filter((participant) => (
    (participant.name.toLowerCase().includes(search.toLowerCase()) || String(participant.sequenceNumber) === search)
    && (status === 'semua' || participant.status === status)
  ));
  const columns = [
    { label: 'Urut', render: (row) => `<span class="sequence-number">${String(row.sequenceNumber).padStart(2, '0')}</span>` },
    { label: 'Peserta', render: (row) => `<strong>${escapeHtml(row.name)}</strong><small class="cell-subtext">${escapeHtml(row.category)}</small>` },
    { label: 'Jadwal', render: (row) => `<span class="numeric">${row.scheduledTime}</span><small class="cell-subtext">Tiba ± ${row.estimatedFinish}</small>` },
    { label: 'Status saat ini', render: (row) => statusBadge(row.status) },
    { label: 'Waktu aktual', render: (row) => `<span class="numeric">${row.actualFinishAt || row.actualDepartureAt ? new Date(row.actualFinishAt || row.actualDepartureAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '—'}</span>` },
    { label: 'Aksi cepat', render: (row) => `<button class="btn btn-small btn-secondary" type="button" data-status-change="${row.id}"><i data-lucide="RefreshCw"></i>Ubah status</button>` },
  ];
  return {
    html: `${pageHeader({ eyebrow: operatorMode ? 'Operasional lapangan' : 'Kontrol perjalanan', title: operatorMode ? 'Monitor Peserta' : 'Jadwal & Status Peserta', description: operatorMode ? 'Perbarui status peserta dengan cepat dari area lapangan.' : 'Pantau jadwal dan waktu aktual peserta sepanjang rute.', actions: '<button class="btn btn-secondary" type="button" data-refresh><i data-lucide="RefreshCw"></i>Segarkan</button>' })}
      <section class="route-strip" aria-label="Alur lokasi"><div class="route-point done"><span><i data-lucide="Check"></i></span><strong>Start</strong><small>Pasar Tunjung</small></div><i data-lucide="ChevronRight"></i><div class="route-point active"><span><i data-lucide="Radio"></i></span><strong>B. Edi</strong><small>Gedangmas</small></div><i data-lucide="ChevronRight"></i><div class="route-point"><span><i data-lucide="MapPin"></i></span><strong>Finish</strong><small>Kantor Kecamatan</small></div></section>
      ${filterBar(`<label class="search-field"><i data-lucide="Search"></i><span class="sr-only">Cari peserta</span><input type="search" value="${escapeHtml(search)}" placeholder="Cari peserta…" data-operation-search></label><label><span class="sr-only">Status</span><select data-operation-status><option value="semua">Semua status</option>${statusOptions.map(([value, label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`, `${filtered.length} peserta ditampilkan`)}
      <section class="section-card table-card">${dataTable({ columns, rows: filtered })}</section>`,
    bind() {
      document.querySelector('[data-refresh]').addEventListener('click', () => navigate(window.location.pathname, { replace: true }));
      const applyFilters = () => {
        const params = new URLSearchParams();
        const searchValue = document.querySelector('[data-operation-search]').value.trim();
        const statusValue = document.querySelector('[data-operation-status]').value;
        if (searchValue) params.set('cari', searchValue);
        if (statusValue !== 'semua') params.set('status', statusValue);
        navigate(`${window.location.pathname}${params.size ? `?${params}` : ''}`, { replace: true });
      };
      document.querySelector('[data-operation-search]').addEventListener('change', applyFilters);
      document.querySelector('[data-operation-status]').addEventListener('change', applyFilters);
      document.querySelectorAll('[data-status-change]').forEach((button) => button.addEventListener('click', async () => {
        const participant = participantById(participants, button.dataset.statusChange);
        const options = statusOptions.map(([value, label]) => `<label class="radio-row"><input type="radio" name="new-status" value="${value}" ${value === participant.status ? 'checked' : ''}><span>${label}</span></label>`).join('');
        const values = await confirmDialog({ title: `Ubah status peserta #${String(participant.sequenceNumber).padStart(2, '0')}`, message: participant.name, confirmLabel: 'Simpan status', details: `<div class="dialog-options">${options}<label class="field"><span>Waktu aktual</span><input name="actual-at" type="datetime-local" value="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"></label><label class="field"><span>Catatan perubahan</span><textarea name="status-note" rows="2" placeholder="Opsional"></textarea></label></div>`, collect: (dialog) => ({ status: dialog.querySelector('[name="new-status"]:checked')?.value, note: dialog.querySelector('[name="status-note"]').value, actualAt: new Date(dialog.querySelector('[name="actual-at"]').value).toISOString() }) });
        if (!values) return;
        try { await dataService.updateParticipantStatus(participant.id, values.status, values.note, values.actualAt); showToast(`Status ${participant.name} berhasil diperbarui.`); navigate(window.location.pathname, { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      }));
      return bindLiveRefresh({ eventId: event.id, tables: ['participants'] });
    },
  };
}

export async function incidentsPage() {
  const [incidents, participants] = await Promise.all([dataService.getIncidents(), dataService.getParticipants()]);
  const columns = [
    { label: 'Waktu', render: (row) => `<span class="numeric">${row.time} WIB</span>` },
    { label: 'Peserta', render: (row) => { const p = participantById(participants, row.participantId); return `<span class="sequence-small">${String(p.sequenceNumber).padStart(2, '0')}</span> <strong>${escapeHtml(p.name)}</strong>`; } },
    { label: 'Jenis', key: 'type' }, { label: 'Catatan', key: 'note' },
    { label: 'Status', render: (row) => statusBadge(row.status === 'baru' ? 'issue' : 'completed', row.status === 'baru' ? 'Baru' : 'Ditangani') },
    { label: 'Aksi', render: (row) => row.status === 'baru' ? `<button class="btn btn-small btn-secondary" type="button" data-handle-incident="${row.id}">Tandai ditangani</button>` : '<span class="muted">Selesai</span>' },
  ];
  return {
    html: `${pageHeader({ eyebrow: 'Operasional lapangan', title: 'Pencatatan Insiden', description: 'Catat kejadian di rute agar dapat ditindaklanjuti panitia.', actions: '<button class="btn btn-primary" type="button" data-add-incident><i data-lucide="Plus"></i>Catat insiden</button>' })}<section class="section-card table-card">${dataTable({ columns, rows: incidents })}</section>`,
    bind() {
      document.querySelector('[data-add-incident]').addEventListener('click', async () => {
        const values = await confirmDialog({ title: 'Catat insiden baru', message: 'Isi data kejadian lapangan secara singkat dan faktual.', confirmLabel: 'Simpan insiden', details: `<div class="dialog-options"><label class="field"><span>Peserta</span><select name="participant-id">${participants.map((p) => `<option value="${p.id}">#${String(p.sequenceNumber).padStart(2, '0')} · ${escapeHtml(p.name)}</option>`).join('')}</select></label><label class="field"><span>Jenis insiden</span><select name="incident-type"><option>Keterlambatan</option><option>Kendala rute</option><option>Ketertiban</option><option>Lainnya</option></select></label><label class="field"><span>Catatan *</span><textarea name="incident-note" rows="3"></textarea></label></div>`, collect: (dialog) => { const note = dialog.querySelector('[name="incident-note"]').value.trim(); if (!note) return false; return { participantId: dialog.querySelector('[name="participant-id"]').value, type: dialog.querySelector('[name="incident-type"]').value, note }; } });
        if (!values) return;
        try { await dataService.createIncident(values); showToast('Insiden baru berhasil dicatat.'); navigate('/operator/insiden', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      });
      document.querySelectorAll('[data-handle-incident]').forEach((button) => button.addEventListener('click', async () => {
        try { await dataService.handleIncident(button.dataset.handleIncident); showToast('Insiden ditandai telah ditangani.'); navigate('/operator/insiden', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      }));
    },
  };
}
