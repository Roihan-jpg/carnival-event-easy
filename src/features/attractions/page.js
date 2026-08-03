import { dataService } from '../../services/dataService.js';
import { dataTable, inlineAlert, pageHeader, statusBadge } from '../../components/ui.js';
import { showToast } from '../../components/toast.js';
import { escapeHtml, participantById } from '../../utils/html.js';
import { bindLiveRefresh } from '../../services/liveUpdates.js';

export async function attractionsPage({ operator = false } = {}) {
  const [event, participants, checks, points, assignment] = await Promise.all([
    dataService.getActiveEvent(), dataService.getParticipants(), dataService.getAttractionChecks(), dataService.getAttractionPoints(),
    operator ? dataService.getMyAttractionAssignment() : Promise.resolve(null),
  ]);
  const rows = checks.map((check) => ({ ...check, participant: participantById(participants, check.participantId) }));
  const fixedPoints = event.attraction_mode === 'fixed_points';
  const attractionMaximum = points.reduce((total, point) => total + Number(point.point_value ?? event.attraction_point_value ?? 0), 0);
  const columns = [
    { label: 'Peserta', render: (row) => `<span class="matrix-participant"><span class="sequence-small">${String(row.participant.sequenceNumber).padStart(2, '0')}</span><span><strong>${escapeHtml(row.participant.name)}</strong><small>${escapeHtml(row.participant.category)}</small></span></span>` },
    ...points.map((point, index) => ({ label: point.name, render: (row) => operator && assignment?.attraction_point_id === point.id ? attractionSelect(row, point, index, fixedPoints, event.attraction_point_value) : statusBadge(row.points[index]) })),
    { label: fixedPoints ? 'Poin' : 'Kepatuhan', render: (row) => fixedPoints
      ? `<strong class="score-value">+${row.points.reduce((total, value, index) => total + (value === 'performed' ? Number(points[index].point_value ?? event.attraction_point_value ?? 0) : 0), 0)}</strong><span class="muted"> /${attractionMaximum}</span>`
      : `<strong>${row.points.filter((value) => value === 'performed').length}/${points.length}</strong><span class="muted"> tampil</span>` },
  ];
  const unresolved = rows.filter((row) => row.points.includes('unable_to_verify')).length;
  return {
    html: `${pageHeader({ eyebrow: operator ? 'Verifikasi lapangan' : 'Kepatuhan peserta', title: 'Atraksi Wajib', description: operator ? 'Catat hasil verifikasi hanya pada titik penugasan Anda.' : fixedPoints ? 'Setiap atraksi yang tampil mendapat poin sesuai konfigurasi.' : 'Atraksi dicatat sebagai kepatuhan tanpa menambah nilai.', actions: '' })}
      ${operator && !assignment ? inlineAlert({ tone: 'warning', title: 'Belum ada penugasan verifier', message: 'Hubungi Admin untuk menetapkan satu titik atraksi.' }) : ''}
      ${unresolved ? inlineAlert({ tone: 'warning', title: `${unresolved} peserta belum tuntas`, message: 'Status belum terverifikasi harus diselesaikan sebelum finalisasi hasil.' }) : ''}
      <div class="attraction-locations">${points.map((point, index) => `<article><span>${index + 1}</span><div><small>Titik atraksi ${index + 1}</small><strong>${escapeHtml(point.name)}</strong><p>${escapeHtml(point.address_note)}</p></div></article>`).join('')}</div>
      <section class="section-card table-card">${dataTable({ columns, rows, className: 'attraction-matrix' })}</section>`,
    bind() {
      document.querySelectorAll('[data-attraction-select]').forEach((select) => select.addEventListener('change', async () => {
        select.disabled = true;
        try {
          await dataService.recordAttractionCheck(select.dataset.participantId, select.dataset.pointId, select.value);
          showToast('Verifikasi atraksi disimpan.');
        } catch (error) { showToast(error.message, 'danger'); }
        finally { select.disabled = false; }
      }));
      return bindLiveRefresh({ eventId: event.id, tables: ['attraction_checks'] });
    },
  };
}

function attractionSelect(row, point, index, fixedPoints, defaultPointValue) {
  const pointLabel = fixedPoints ? ` (+${Number(point.point_value ?? defaultPointValue ?? 0)})` : '';
  return `<select class="compact-select" data-attraction-select data-participant-id="${row.participant.id}" data-point-id="${point.id}" aria-label="Status ${escapeHtml(point.name)} untuk ${escapeHtml(row.participant.name)}"><option value="performed" ${row.points[index] === 'performed' ? 'selected' : ''}>Tampil${pointLabel}</option><option value="not_performed" ${row.points[index] === 'not_performed' ? 'selected' : ''}>Tidak tampil</option><option value="unable_to_verify" ${row.points[index] === 'unable_to_verify' ? 'selected' : ''}>Belum terverifikasi</option></select>`;
}
