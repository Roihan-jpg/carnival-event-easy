import { dataService } from '../../services/dataService.js';
import { dataTable, inlineAlert, pageHeader, statusBadge } from '../../components/ui.js';
import { escapeHtml } from '../../utils/html.js';
import { bindLiveRefresh } from '../../services/liveUpdates.js';

export async function dashboardPage() {
  const [event, participants, progress, penalties, attractions] = await Promise.all([
    dataService.getActiveEvent(), dataService.getParticipants(), dataService.getJudgingProgress(), dataService.getPenalties(), dataService.getAttractionChecks(),
  ]);
  const complete = progress.filter((item) => [item.start, item.gedangmas, item.finish].every((status) => status === 'submitted')).length;
  const active = participants.filter((item) => ['called', 'performing', 'departed'].includes(item.status)).length;
  const issues = participants.filter((item) => item.issue).length + penalties.filter((item) => item.status === 'draft').length;
  const unresolvedAttractions = attractions.filter((item) => item.points.includes('unable_to_verify')).length;
  const pendingPenalties = penalties.filter((item) => item.status === 'draft').length;
  const progressPercent = participants.length ? Math.round(complete / participants.length * 100) : 0;
  const eventDate = new Date(`${event.event_date}T00:00:00`);
  const categorySummary = [...new Set(participants.map((item) => item.category))]
    .map((category) => `${participants.filter((item) => item.category === category).length} ${category}`).join(' · ');
  const recentRows = participants.slice(0, 8);
  const columns = [
    { label: 'No.', render: (row) => `<span class="sequence-number">${String(row.sequenceNumber).padStart(2, '0')}</span>` },
    { label: 'Peserta', render: (row) => `<strong>${escapeHtml(row.name)}</strong><small class="cell-subtext">${escapeHtml(row.category)}</small>` },
    { label: 'Jadwal', render: (row) => `<span class="numeric">${row.scheduledTime} WIB</span>` },
    { label: 'Status', render: (row) => statusBadge(row.status) },
    { label: 'Nilai', render: (row) => `<div class="progress-inline"><span><strong>${row.scoreProgress}</strong>/3 juri</span><div class="mini-progress"><i style="width:${row.scoreProgress / 3 * 100}%"></i></div></div>` },
    { label: 'Isu', render: (row) => row.issue ? `<span class="issue-text"><i data-lucide="AlertTriangle"></i>${escapeHtml(row.issue)}</span>` : '<span class="muted">Tidak ada</span>' },
    { label: '', render: (row) => `<a class="icon-btn" href="/admin/peserta/${row.id}" data-link aria-label="Lihat ${escapeHtml(row.name)}"><i data-lucide="ChevronRight"></i></a>` },
  ];

  return {
    html: `${pageHeader({ eyebrow: 'Pusat kendali acara', title: 'Ringkasan Operasional', description: 'Pantau peserta, penilaian, dan isu lapangan dalam satu pandangan.' })}
      <section class="event-banner">
        <div><span class="event-date-block"><strong>${eventDate.getDate()}</strong><small>${eventDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }).toUpperCase()}</small></span></div>
        <div class="event-banner-copy"><div>${statusBadge(event.status)}</div><h2>${escapeHtml(event.name)}</h2><p><i data-lucide="MapPin"></i>${escapeHtml(event.route_description)}</p></div>
        <div class="event-actions"><a class="btn btn-secondary" href="/admin/pengaturan" data-link><i data-lucide="Settings"></i>Pengaturan</a><a class="btn btn-primary" href="/admin/penjurian" data-link><i data-lucide="ClipboardCheck"></i>Monitor penjurian</a></div>
      </section>
      ${unresolvedAttractions || pendingPenalties ? inlineAlert({ tone: 'warning', title: `${unresolvedAttractions + pendingPenalties} item memerlukan tindakan`, message: `${unresolvedAttractions} peserta memiliki atraksi belum tuntas dan ${pendingPenalties} penalti menunggu konfirmasi.`, action: '<a href="/admin/atraksi" data-link class="alert-action">Tinjau sekarang <i data-lucide="ChevronRight"></i></a>' }) : ''}
      <section class="kpi-grid" aria-label="Ringkasan angka">
        ${kpi('Total peserta', participants.length, categorySummary || 'Belum ada peserta', 'Users')}
        ${kpi('Sedang berjalan', active, 'Dipanggil sampai berangkat', 'Radio', 'accent')}
        ${kpi('Nilai lengkap', complete, `${progressPercent}% dari peserta`, 'CheckCircle2', 'success')}
        ${kpi('Belum lengkap', participants.length - complete, 'Perlu dipantau', 'FileClock', 'warning')}
        ${kpi('Perlu tindakan', issues, 'Isu peserta & penalti', 'AlertTriangle', 'danger')}
      </section>
      <section class="section-card">
        <div class="section-heading"><div><p class="eyebrow">Urutan keberangkatan</p><h2>Peserta dalam pemantauan</h2></div><a href="/admin/jadwal" data-link class="text-link">Lihat semua jadwal <i data-lucide="ChevronRight"></i></a></div>
        ${dataTable({ columns, rows: recentRows })}
      </section>
      <div class="split-grid">
        <section class="section-card compact"><div class="section-heading"><div><p class="eyebrow">Atraksi wajib</p><h2>Status verifikasi</h2></div></div>
          <div class="action-list"><div><span class="action-icon warning"><i data-lucide="AlertTriangle"></i></span><span><strong>${unresolvedAttractions} peserta belum tuntas</strong><small>Status belum terverifikasi memblokir finalisasi.</small></span><a href="/admin/atraksi" data-link><i data-lucide="ChevronRight"></i></a></div><div><span class="action-icon success"><i data-lucide="CheckCircle2"></i></span><span><strong>${attractions.length - unresolvedAttractions} peserta terverifikasi</strong><small>Ketiga titik atraksi sudah lengkap.</small></span><a href="/admin/atraksi" data-link><i data-lucide="ChevronRight"></i></a></div></div>
        </section>
        <section class="section-card compact"><div class="section-heading"><div><p class="eyebrow">Penalti</p><h2>Menunggu keputusan</h2></div><span class="count-badge">${penalties.filter((item) => item.status === 'draft').length}</span></div>
          <div class="action-list">${penalties.filter((item) => item.status === 'draft').map((penalty) => ({ penalty, participant: participants.find((item) => item.id === penalty.participantId) })).filter(({ participant }) => participant).map(({ penalty, participant }) => `<div><span class="sequence-small">${String(participant.sequenceNumber).padStart(2, '0')}</span><span><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(penalty.type)} · −${penalty.deduction} poin</small></span><a href="/admin/penalti" data-link><i data-lucide="ChevronRight"></i></a></div>`).join('')}</div>
        </section>
      </div>`,
    bind() {
      return bindLiveRefresh({ eventId: event.id, tables: ['participants', 'score_sheets', 'attraction_checks', 'events'] });
    },
  };
}

function kpi(label, value, note, icon, tone = '') {
  return `<article class="kpi-card ${tone}"><span class="kpi-icon"><i data-lucide="${icon}"></i></span><div><span>${label}</span><strong>${value}</strong><small>${note}</small></div></article>`;
}
