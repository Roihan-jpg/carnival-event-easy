import { confirmDialog } from '../../components/modal.js';
import { dataTable, emptyState, inlineAlert, pageHeader, segmentedTabs, statusBadge } from '../../components/ui.js';
import { showToast } from '../../components/toast.js';
import { getState } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { dataService } from '../../services/dataService.js';
import { escapeHtml } from '../../utils/html.js';
import logoUrl from '../../assets/logo.png';

function mapResult(row) {
  return {
    participantId: row.participant_id,
    category: row.category_name,
    categoryCode: row.category_code,
    sequenceNumber: Number(row.sequence_number),
    name: row.participant_name,
    theme: row.theme || '',
    submittedJudges: Number(row.submitted_judges),
    judgeScore: Number(row.judge_score),
    attraction: Number(row.attraction_points),
    penalty: Number(row.penalty_total),
    final: Number(row.final_score),
    rank: row.rank ? Number(row.rank) : null,
    status: row.status,
    incompleteReason: row.incomplete_reason || '',
    waived: Boolean(row.waived),
    tieRequiresCouncil: Boolean(row.tie_requires_council),
  };
}

export async function resultsPage({ publicView = false } = {}) {
  let event;
  let sourceRows;
  let publishedAt;
  let publicEvent;
  if (publicView) {
    const snapshot = await dataService.getPublishedResults();
    if (!snapshot) return { html: `${publicResultsHeader('Belum diterbitkan')}<main class="results-shell">${emptyState({ title: 'Hasil belum diterbitkan', message: 'Panitia masih melakukan verifikasi. Silakan kembali setelah hasil resmi dipublikasikan.' })}</main>` };
    sourceRows = snapshot.results;
    publishedAt = snapshot.published_at;
    publicEvent = snapshot.calculation_config?.event;
  } else {
    event = await dataService.getActiveEvent();
    sourceRows = await dataService.previewResults();
  }
  const query = new URLSearchParams(window.location.search);
  const category = query.get('kategori') === 'umum' ? 'Umum' : 'Pendidikan';
  const allRows = sourceRows.map(mapResult);
  const rows = allRows.filter((row) => row.category === category);
  const completeRows = rows.filter((row) => row.status === 'complete').sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const incomplete = allRows.filter((row) => row.status !== 'complete' || row.tieRequiresCouncil);
  const columns = [
    { label: 'Peringkat', render: (row) => row.rank ? `<span class="rank ${row.rank <= 3 ? `top-${row.rank}` : ''}">${row.rank <= 3 ? '<i data-lucide="Award"></i>' : ''}${row.rank}</span>` : '—' },
    { label: 'No.', render: (row) => `<span class="sequence-small">${String(row.sequenceNumber).padStart(2, '0')}</span>` },
    { label: 'Peserta', render: (row) => `<strong>${escapeHtml(row.name)}</strong><small class="cell-subtext">${escapeHtml(row.theme)}</small>` },
    { label: 'Nilai juri', render: (row) => `<span class="numeric">${row.judgeScore.toFixed(2)}</span><small class="cell-subtext">${row.submittedJudges}/3 nilai${row.waived ? ' · waiver' : ''}</small>` },
    { label: 'Atraksi', render: (row) => `<span class="positive">+${row.attraction}</span>` },
    { label: 'Penalti', render: (row) => `<span class="${row.penalty ? 'negative' : 'muted'}">${row.penalty ? `−${row.penalty}` : '0'}</span>` },
    { label: 'Nilai akhir', render: (row) => `<strong class="final-score">${row.final.toFixed(2)}</strong>` },
    ...(!publicView ? [{ label: 'Status', render: (row) => statusBadge(row.status === 'complete' ? 'completed' : 'issue', row.status === 'complete' ? (row.waived ? 'Lengkap · waiver' : 'Terverifikasi') : row.incompleteReason) }] : []),
  ];
  const actions = publicView ? '' : `<button class="btn btn-secondary" type="button" data-export-results><i data-lucide="Download"></i>Ekspor CSV</button><button class="btn btn-primary" type="button" data-publish ${incomplete.length || event.status !== 'scoring_closed' ? 'disabled' : ''}><i data-lucide="Trophy"></i>Buat snapshot & terbitkan</button>`;
  const header = publicView ? publicResultsHeader(category, publicEvent) : pageHeader({ eyebrow: 'Rekap dan pemeringkatan', title: 'Hasil Karnaval', description: 'Perhitungan resmi dilakukan database berdasarkan konfigurasi event.', actions });
  return {
    html: `${header}<section class="results-shell">
      ${!publicView ? inlineAlert({ tone: incomplete.length ? 'warning' : 'info', title: incomplete.length ? `${incomplete.length} hasil belum dapat difinalkan` : 'Mode preview', message: incomplete.length ? 'Lengkapi nilai, waiver, atraksi, atau keputusan Dewan Juri. Publikasi tetap diblokir.' : `Hasil siap dibuat snapshot setelah status event scoring_closed.${publishedAt ? ` Diterbitkan ${publishedAt}` : ''}` }) : ''}
      <div class="results-toolbar">${segmentedTabs([{ id: 'pendidikan', label: 'Pendidikan' }, { id: 'umum', label: 'Umum' }], category.toLowerCase())}<span>${rows.length} peserta</span></div>
      <div class="winner-row">${completeRows.slice(0, 3).map((row) => `<article class="winner-card place-${row.rank}"><span class="winner-rank">${row.rank}</span><div><small>Juara ${['I', 'II', 'III'][row.rank - 1]}</small><strong>${escapeHtml(row.name)}</strong><span>#${String(row.sequenceNumber).padStart(2, '0')} · ${escapeHtml(row.category)}</span></div><strong class="winner-score">${row.final.toFixed(2)}</strong></article>`).join('')}</div>
      <section class="section-card table-card">${dataTable({ columns, rows })}</section>
      ${!publicView && incomplete.some((row) => row.tieRequiresCouncil) ? inlineAlert({ tone: 'warning', title: 'Tie-break memerlukan berita acara', message: 'Super Admin harus mengisi prioritas dan referensi berita acara melalui aksi keputusan Dewan Juri.' }) : ''}
      ${!publicView && getState().user?.role === 'super_admin' ? `<div class="council-actions">${incomplete.filter((row) => row.tieRequiresCouncil).map((row) => `<button class="btn btn-secondary" type="button" data-council-participant="${row.participantId}">Keputusan untuk #${String(row.sequenceNumber).padStart(2, '0')}</button>`).join('')}</div>` : ''}
      ${publicView ? `<p class="public-note"><i data-lucide="Info"></i>Snapshot resmi diterbitkan ${new Date(publishedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}. Rincian nilai per juri tidak dipublikasikan.</p>` : ''}</section>`,
    bind() {
      document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => navigate(`${publicView ? '/hasil' : '/admin/hasil'}?kategori=${button.dataset.tab}`)));
      document.querySelector('[data-export-results]')?.addEventListener('click', () => exportCsv(allRows));
      document.querySelector('[data-publish]')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({ title: 'Buat snapshot dan terbitkan hasil?', message: 'Snapshot immutable akan menjadi hasil resmi yang dapat dibaca publik.', confirmLabel: 'Terbitkan hasil', tone: 'danger' });
        if (!confirmed) return;
        try {
          const snapshot = await dataService.createResultSnapshot();
          await dataService.publishResultSnapshot(snapshot.id);
          showToast('Hasil Karnaval berhasil diterbitkan.');
          navigate('/admin/hasil', { replace: true });
        } catch (error) { showToast(error.message, 'danger'); }
      });
      document.querySelectorAll('[data-council-participant]').forEach((button) => button.addEventListener('click', async () => {
        const decision = await confirmDialog({ title: 'Keputusan Dewan Juri', message: 'Masukkan prioritas dan referensi berita acara resmi.', confirmLabel: 'Simpan keputusan', details: '<div class="dialog-options"><label class="field"><span>Prioritas *</span><input name="priority" type="number" min="1"></label><label class="field"><span>Referensi berita acara *</span><input name="minutes-reference"></label></div>', collect: (dialog) => { const priority = dialog.querySelector('[name="priority"]').value; const minutesReference = dialog.querySelector('[name="minutes-reference"]').value.trim(); return priority && minutesReference ? { priority, minutesReference } : false; } });
        if (!decision) return;
        try { await dataService.setCouncilDecision(button.dataset.councilParticipant, decision.priority, decision.minutesReference); showToast('Keputusan Dewan Juri disimpan.'); navigate('/admin/hasil', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      }));
    },
  };
}

function publicResultsHeader(category, event) {
  const eventName = event?.name || 'Karnaval Kecamatan Randuagung';
  const eventDate = event?.event_date ? new Date(`${event.event_date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Menunggu publikasi';
  const role = getState().user?.role;
  const action = role === 'viewer'
    ? '<button class="btn btn-secondary public-header-action" type="button" data-logout><i data-lucide="LogOut"></i>Keluar</button>'
    : ['admin', 'super_admin'].includes(role)
      ? '<a class="btn btn-secondary public-header-action" href="/admin/dashboard" data-link><i data-lucide="ArrowLeft"></i>Kembali</a>'
      : '';
  return `<header class="public-hero"><a class="public-brand" href="/hasil" data-link><span class="brand-mark"><img class="brand-logo" src="${logoUrl}" alt="Logo Randuagung"></span><span><strong>${escapeHtml(eventName)}</strong><small>Hasil Karnaval Kecamatan</small></span></a><div><p class="eyebrow">Hasil resmi · ${escapeHtml(category)}</p><h1>Penilaian Digital,<br><em>Karnaval Randuagung</em></h1><p>Lumajang, Jawa Timur, 2026</p></div><div class="public-event-meta"><span><i data-lucide="CalendarDays"></i>${escapeHtml(eventDate)}</span>${statusBadge(category === 'Belum diterbitkan' ? 'draft' : 'published')}${action}</div></header>`;
}

function exportCsv(rows) {
  const header = ['peringkat', 'nomor', 'peserta', 'kategori', 'nilai_juri', 'atraksi', 'penalti', 'nilai_akhir', 'status'];
  const lines = rows.map((row) => [row.rank || '', row.sequenceNumber, row.name, row.category, row.judgeScore, row.attraction, row.penalty, row.final, row.status]
    .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
  const blob = new window.Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hasil-karnaval-randuagung.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}
