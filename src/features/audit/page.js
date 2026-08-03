import { dataService } from '../../services/dataService.js';
import { filterBar, pageHeader } from '../../components/ui.js';
import { navigate } from '../../core/router.js';
import { escapeHtml } from '../../utils/html.js';

function exportAudit(rows) {
  const header = ['waktu', 'aksi', 'pelaku', 'entitas'];
  const lines = rows.map((row) => [row.time, row.action, row.actor, row.entity]
    .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
  const blob = new window.Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'audit-log-karnaval.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function auditPage() {
  const logs = await dataService.getAuditLogs();
  const query = new URLSearchParams(window.location.search);
  const search = query.get('cari') || '';
  const type = query.get('jenis') || 'semua';
  const typeKeys = { peserta: 'PARTICIPANT', penilaian: 'SCORE', penalti: 'PENALT', konfigurasi: 'EVENT' };
  const filtered = logs.filter((log) => {
    const haystack = `${log.action} ${log.actor} ${log.entity}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (type === 'semua' || log.actionCode.toUpperCase().includes(typeKeys[type]));
  });
  return {
    html: `${pageHeader({ eyebrow: 'Jejak perubahan', title: 'Audit Log', description: 'Riwayat append-only untuk aksi penting dan perubahan data.', actions: '<button class="btn btn-secondary" type="button" data-export-audit><i data-lucide="Download"></i>Ekspor audit</button>' })}
      ${filterBar(`<label class="search-field"><i data-lucide="Search"></i><span class="sr-only">Cari audit</span><input type="search" value="${escapeHtml(search)}" placeholder="Cari pelaku atau aksi…" data-audit-search></label><label><span class="sr-only">Jenis aksi</span><select data-audit-type><option value="semua">Semua aksi</option><option value="konfigurasi" ${type === 'konfigurasi' ? 'selected' : ''}>Konfigurasi</option><option value="peserta" ${type === 'peserta' ? 'selected' : ''}>Peserta</option><option value="penilaian" ${type === 'penilaian' ? 'selected' : ''}>Penilaian</option><option value="penalti" ${type === 'penalti' ? 'selected' : ''}>Penalti</option></select></label>`, `${filtered.length} aktivitas`)}
      <section class="section-card audit-card"><div class="audit-timeline">${filtered.map((log) => `<article><span class="audit-marker ${log.tone}"><i data-lucide="${log.tone === 'success' ? 'CheckCircle2' : log.tone === 'danger' ? 'AlertCircle' : log.tone === 'warning' ? 'AlertTriangle' : 'FileClock'}"></i></span><div><span class="audit-time">${escapeHtml(log.time)} WIB</span><h2>${escapeHtml(log.action)}</h2><p><strong>${escapeHtml(log.actor)}</strong> · ${escapeHtml(log.entity)}</p></div></article>`).join('')}</div></section>`,
    bind() {
      const apply = () => {
        const params = new URLSearchParams();
        const searchValue = document.querySelector('[data-audit-search]').value.trim();
        const typeValue = document.querySelector('[data-audit-type]').value;
        if (searchValue) params.set('cari', searchValue);
        if (typeValue !== 'semua') params.set('jenis', typeValue);
        navigate(`/admin/audit${params.size ? `?${params}` : ''}`, { replace: true });
      };
      document.querySelector('[data-audit-search]').addEventListener('change', apply);
      document.querySelector('[data-audit-type]').addEventListener('change', apply);
      document.querySelector('[data-export-audit]').addEventListener('click', () => exportAudit(filtered));
    },
  };
}
