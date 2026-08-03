import { confirmDialog } from '../../components/modal.js';
import { inlineAlert, pageHeader, statusBadge } from '../../components/ui.js';
import { showToast } from '../../components/toast.js';
import { navigate } from '../../core/router.js';
import { dataService } from '../../services/dataService.js';
import { escapeHtml } from '../../utils/html.js';
import { bindLiveRefresh } from '../../services/liveUpdates.js';

export async function settingsPage() {
  const [settings, participants] = await Promise.all([dataService.getEventSettings(), dataService.getParticipants()]);
  const { event, locations, criteria, points, penaltyTypes, judgeAssignments, attractionAssignments } = settings;
  const criteriaTotal = criteria.reduce((sum, criterion) => sum + criterion.max, 0);
  const checks = [
    ['Event dan jadwal telah dikonfigurasi', Boolean(event.name && event.event_date && event.route_description)],
    ['Tiga lokasi penilaian aktif', locations.filter((item) => item.is_active).length === 3],
    ['Tiga juri memiliki penugasan aktif', judgeAssignments.filter((item) => item.profiles?.is_active && item.profiles?.role === 'judge').length === 3],
    ['Tiga verifikator atraksi memiliki penugasan aktif', attractionAssignments.filter((item) => item.profiles?.is_active && item.profiles?.role === 'operator').length === 3],
    ['Delapan kriteria berjumlah tepat 100 poin', criteria.length === 8 && criteriaTotal === 100],
    ['Peserta memiliki nomor urut unik', participants.length > 0 && new Set(participants.map((item) => item.sequenceNumber)).size === participants.length],
    ['Aturan atraksi dan penalti tersedia', points.length === 3 && penaltyTypes.length === 3],
  ];
  const ready = checks.every(([, complete]) => complete);
  const locked = ['scoring_open', 'scoring_closed', 'published', 'archived'].includes(event.status);
  const transition = event.status === 'scoring_open' ? 'scoring_closed' : 'scoring_open';
  return {
    html: `${pageHeader({ eyebrow: 'Konfigurasi event', title: 'Pengaturan Event & Rubrik', description: 'Konfigurasi penilaian dikunci setelah penjurian dibuka.', actions: statusBadge(event.status) })}
      ${locked ? inlineAlert({ tone: 'warning', title: 'Konfigurasi dikunci', message: 'Rubrik dan aturan perhitungan tidak dapat diubah ketika penjurian aktif atau telah ditutup.' }) : ''}
      <div class="settings-layout"><nav class="settings-nav" aria-label="Bagian pengaturan"><a href="#event" class="active">Informasi event</a><a href="#locations">Titik penilaian</a><a href="#rubric">Rubrik</a><a href="#rules">Aturan hasil</a><a href="#readiness">Kesiapan</a></nav><div class="settings-content">
        <form class="section-card" id="event" data-event-form><div class="section-heading"><div><p class="eyebrow">Informasi dasar</p><h2>Event ${event.year}</h2></div><button class="btn btn-small btn-secondary" type="submit" ${locked ? 'disabled' : ''}><i data-lucide="Save"></i>Simpan</button></div><div class="form-grid readonly-fields"><label class="field span-2"><span>Nama event</span><input name="name" value="${escapeHtml(event.name)}" ${locked ? 'disabled' : ''}></label><label class="field"><span>Tanggal pelaksanaan</span><input name="eventDate" type="date" value="${event.event_date}" ${locked ? 'disabled' : ''}></label><label class="field"><span>Zona waktu</span><input value="${escapeHtml(event.timezone)}" disabled></label><label class="field span-2"><span>Rute</span><input name="route" value="${escapeHtml(event.route_description)}" ${locked ? 'disabled' : ''}></label></div></form>
        <section class="section-card" id="locations"><div class="section-heading"><div><p class="eyebrow">Lokasi aktif</p><h2>Titik penilaian</h2></div><span class="count-badge">${locations.filter((item) => item.is_active).length}/3</span></div><div class="location-list">${locations.map((location, index) => `<div><span class="location-number">${index + 1}</span><span><small>${escapeHtml(location.code)}</small><strong>${escapeHtml(location.name)}</strong><p>${escapeHtml(location.address_note || '')}</p></span>${statusBadge(location.is_active ? 'active' : 'inactive')}</div>`).join('')}</div></section>
        <form class="section-card" id="rubric" data-rubric-form><div class="section-heading"><div><p class="eyebrow">Skor per juri</p><h2>Rubrik penilaian</h2></div><div class="rubric-total"><span>Total maksimum</span><strong data-rubric-total>${criteriaTotal}</strong></div></div><div class="rubric-list">${criteria.map((criterion, index) => `<div><span>${index + 1}</span><span><strong>${escapeHtml(criterion.name)}</strong><small>${escapeHtml(criterion.hint)}</small></span><label><span class="sr-only">Maksimum ${escapeHtml(criterion.name)}</span><input type="number" min="1" step="1" name="${criterion.id}" value="${criterion.max}" ${locked ? 'disabled' : ''}><small>poin</small></label></div>`).join('')}</div><div class="section-footer"><span>Total wajib tepat 100.</span><button class="btn btn-primary" type="submit" ${locked ? 'disabled' : ''}>Simpan rubrik</button></div></form>
        <form class="section-card" id="rules" data-rules-form><div class="section-heading"><div><p class="eyebrow">Perhitungan akhir</p><h2>Aturan hasil</h2></div></div><div class="form-grid"><label class="field"><span>Metode agregasi</span><select name="aggregationMethod" ${locked ? 'disabled' : ''}><option value="average" ${event.aggregation_method === 'average' ? 'selected' : ''}>Rata-rata</option><option value="sum" ${event.aggregation_method === 'sum' ? 'selected' : ''}>Jumlah</option></select></label><label class="field"><span>Pembulatan nilai akhir</span><input name="roundingScale" type="number" min="0" max="6" value="${event.rounding_scale}" ${locked ? 'disabled' : ''}></label><label class="field"><span>Mode atraksi</span><select name="attractionMode" ${locked ? 'disabled' : ''}><option value="fixed_points" ${event.attraction_mode === 'fixed_points' ? 'selected' : ''}>Poin tetap</option><option value="compliance_only" ${event.attraction_mode === 'compliance_only' ? 'selected' : ''}>Kepatuhan saja</option></select></label><label class="field"><span>Poin per atraksi</span><input name="attractionPointValue" type="number" min="0" value="${event.attraction_point_value || 0}" ${locked ? 'disabled' : ''}></label></div><div class="section-footer"><span>Waiver: minimal 2/3 nilai dan persetujuan Super Admin.</span><button class="btn btn-primary" type="submit" ${locked ? 'disabled' : ''}>Simpan aturan</button></div></form>
        <section class="section-card" id="readiness"><div class="section-heading"><div><p class="eyebrow">Pemeriksaan sistem</p><h2>Kesiapan penjurian</h2></div>${statusBadge(ready ? 'completed' : 'issue', ready ? 'Siap' : 'Belum siap')}</div><ul class="readiness-list">${checks.map(([label, complete]) => `<li class="${complete ? '' : 'negative'}"><i data-lucide="${complete ? 'CheckCircle2' : 'AlertCircle'}"></i>${escapeHtml(label)}</li>`).join('')}</ul><div class="section-footer"><span>${ready ? 'Seluruh konfigurasi minimum lengkap.' : 'Lengkapi item bertanda sebelum membuka penjurian.'}</span>${['draft', 'configured', 'scoring_open'].includes(event.status) ? `<button class="btn ${transition === 'scoring_closed' ? 'btn-danger' : 'btn-primary'}" type="button" data-transition-event="${transition}" ${!ready && transition === 'scoring_open' ? 'disabled' : ''}><i data-lucide="${transition === 'scoring_open' ? 'UnlockKeyhole' : 'LockKeyhole'}"></i>${transition === 'scoring_open' ? 'Buka penjurian' : 'Tutup penjurian'}</button>` : ''}</div></section>
      </div></div>`,
    bind() {
      document.querySelector('[data-event-form]')?.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        const values = Object.fromEntries(new FormData(submitEvent.currentTarget));
        const rules = Object.fromEntries(new FormData(document.querySelector('[data-rules-form]')));
        try { await dataService.updateEventSettings({ ...values, ...rules }); showToast('Informasi event disimpan.'); } catch (error) { showToast(error.message, 'danger'); }
      });
      document.querySelector('[data-rules-form]')?.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        const rules = Object.fromEntries(new FormData(submitEvent.currentTarget));
        const basics = Object.fromEntries(new FormData(document.querySelector('[data-event-form]')));
        try { await dataService.updateEventSettings({ ...basics, ...rules }); showToast('Aturan hasil disimpan.'); navigate('/admin/pengaturan', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      });
      const rubricForm = document.querySelector('[data-rubric-form]');
      rubricForm?.addEventListener('input', () => { document.querySelector('[data-rubric-total]').textContent = criteria.reduce((sum, criterion) => sum + Number(rubricForm.elements[criterion.id].value || 0), 0); });
      rubricForm?.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        const updated = criteria.map((criterion) => ({ ...criterion, max: Number(rubricForm.elements[criterion.id].value) }));
        if (updated.reduce((sum, criterion) => sum + criterion.max, 0) !== 100) { showToast('Total maksimum rubrik harus tepat 100.', 'danger'); return; }
        try { await dataService.updateCriteria(updated); showToast('Rubrik disimpan.'); navigate('/admin/pengaturan', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      });
      document.querySelector('[data-transition-event]')?.addEventListener('click', async (buttonEvent) => {
        const target = buttonEvent.currentTarget.dataset.transitionEvent;
        const confirmed = await confirmDialog({ title: target === 'scoring_open' ? 'Buka penjurian?' : 'Tutup penjurian?', message: target === 'scoring_open' ? 'Konfigurasi skor akan dikunci dan juri dapat mulai menilai.' : 'Juri tidak dapat menyimpan nilai baru setelah penjurian ditutup.', confirmLabel: target === 'scoring_open' ? 'Buka penjurian' : 'Tutup penjurian', tone: target === 'scoring_closed' ? 'danger' : 'primary' });
        if (!confirmed) return;
        try { await dataService.transitionEvent(target); showToast('Status event diperbarui.'); navigate('/admin/pengaturan', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      });
      return bindLiveRefresh({ eventId: event.id, tables: ['events'] });
    },
  };
}
