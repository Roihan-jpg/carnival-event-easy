import { dataService } from '../../services/dataService.js';
import { dataTable, filterBar, inlineAlert, pageHeader, statusBadge } from '../../components/ui.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { navigate } from '../../core/router.js';
import { escapeHtml } from '../../utils/html.js';
import { validateParticipant } from '../../utils/validation.js';
import { parseParticipantCsv } from '../../utils/csv.js';

export async function participantsPage() {
  const participants = await dataService.getParticipants();
  const query = new URLSearchParams(window.location.search);
  const search = query.get('cari') || '';
  const category = query.get('kategori') || 'semua';
  const status = query.get('status') || 'semua';
  const page = Math.max(1, Number(query.get('halaman')) || 1);
  const pageSize = 10;
  const filtered = participants.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || String(item.sequenceNumber) === search;
    return matchesSearch && (category === 'semua' || item.category === category) && (status === 'semua' || item.status === status);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const columns = [
    { label: 'No.', render: (row) => `<span class="sequence-number">${String(row.sequenceNumber).padStart(2, '0')}</span>` },
    { label: 'Peserta', render: (row) => `<strong>${escapeHtml(row.name)}</strong><small class="cell-subtext">Tema: ${escapeHtml(row.theme)}</small>` },
    { label: 'Kategori', render: (row) => `<span class="category-label">${escapeHtml(row.category)}</span>` },
    { label: 'Jadwal', render: (row) => `<span class="numeric">${row.scheduledTime} WIB</span><small class="cell-subtext">Estimasi tiba ${row.estimatedFinish}</small>` },
    { label: 'Status', render: (row) => statusBadge(row.status) },
    { label: 'Progres', render: (row) => `<span class="score-progress ${row.scoreProgress === 3 ? 'complete' : ''}"><strong>${row.scoreProgress}/3</strong> juri</span>` },
    { label: 'Isu', render: (row) => row.issue ? `<span class="issue-dot" title="${escapeHtml(row.issue)}"><i data-lucide="AlertTriangle"></i><span class="sr-only">${escapeHtml(row.issue)}</span></span>` : '—' },
    { label: 'Aksi', render: (row) => `<div class="row-actions"><a class="icon-btn" href="/admin/peserta/${row.id}" data-link aria-label="Lihat detail"><i data-lucide="Eye"></i></a><a class="icon-btn" href="/admin/peserta/${row.id}/edit" data-link aria-label="Edit peserta"><i data-lucide="Edit3"></i></a></div>` },
  ];

  return {
    html: `${pageHeader({ eyebrow: 'Data event', title: 'Peserta', description: 'Kelola identitas, nomor urut, jadwal, dan progres 20 peserta.', actions: '<button class="btn btn-secondary" type="button" data-import><i data-lucide="Download"></i>Impor CSV</button><a class="btn btn-primary" href="/admin/peserta/tambah" data-link><i data-lucide="Plus"></i>Tambah peserta</a>' })}
      ${filterBar(`<label class="search-field"><i data-lucide="Search"></i><span class="sr-only">Cari peserta</span><input type="search" value="${escapeHtml(search)}" placeholder="Cari nama atau nomor…" data-filter-search></label>
        <label><span class="sr-only">Filter kategori</span><select data-filter-category><option value="semua">Semua kategori</option><option ${category === 'Pendidikan' ? 'selected' : ''}>Pendidikan</option><option ${category === 'Umum' ? 'selected' : ''}>Umum</option></select></label>
        <label><span class="sr-only">Filter status</span><select data-filter-status><option value="semua">Semua status</option><option value="standby" ${status === 'standby' ? 'selected' : ''}>Antre</option><option value="called" ${status === 'called' ? 'selected' : ''}>Dipanggil</option><option value="performing" ${status === 'performing' ? 'selected' : ''}>Tampil</option><option value="departed" ${status === 'departed' ? 'selected' : ''}>Berangkat</option><option value="completed" ${status === 'completed' ? 'selected' : ''}>Selesai</option><option value="issue" ${status === 'issue' ? 'selected' : ''}>Bermasalah</option></select></label>`, `${filtered.length} dari ${participants.length} peserta`)}
      <section class="section-card table-card">${dataTable({ columns, rows: paged, emptyTitle: 'Peserta tidak ditemukan', emptyMessage: 'Ubah kata pencarian atau filter untuk melihat hasil lain.' })}<div class="pagination"><span>Menampilkan ${filtered.length ? (safePage - 1) * pageSize + 1 : 0}–${Math.min(safePage * pageSize, filtered.length)} dari ${filtered.length}</span><div><button class="icon-btn" data-page="${safePage - 1}" ${safePage === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya"><i data-lucide="ChevronLeft"></i></button><span class="page-number active">${safePage}</span><button class="icon-btn" data-page="${safePage + 1}" ${safePage === pageCount ? 'disabled' : ''} aria-label="Halaman berikutnya"><i data-lucide="ChevronRight"></i></button></div></div></section>`,
    bind() {
      const applyFilters = () => {
        const params = new URLSearchParams();
        const searchValue = document.querySelector('[data-filter-search]').value.trim();
        const categoryValue = document.querySelector('[data-filter-category]').value;
        const statusValue = document.querySelector('[data-filter-status]').value;
        if (searchValue) params.set('cari', searchValue);
        if (categoryValue !== 'semua') params.set('kategori', categoryValue);
        if (statusValue !== 'semua') params.set('status', statusValue);
        navigate(`/admin/peserta${params.size ? `?${params}` : ''}`, { replace: true });
      };
      document.querySelector('[data-filter-search]').addEventListener('change', applyFilters);
      document.querySelector('[data-filter-category]').addEventListener('change', applyFilters);
      document.querySelector('[data-filter-status]').addEventListener('change', applyFilters);
      document.querySelectorAll('[data-page]:not([disabled])').forEach((button) => button.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        params.set('halaman', button.dataset.page);
        navigate(`/admin/peserta?${params}`, { replace: true });
      }));
      document.querySelector('[data-import]').addEventListener('click', async () => {
        const file = await confirmDialog({
          title: 'Impor peserta dari CSV',
          message: 'Pilih file untuk memeriksa format dan kesalahan per baris sebelum data disimpan.',
          confirmLabel: 'Tinjau file',
          details: '<div class="dialog-options"><label class="file-drop"><i data-lucide="Download"></i><span><strong>Pilih file CSV</strong><small>Maksimum 2 MB · UTF-8</small></span><input type="file" accept=".csv,text/csv"></label><div class="csv-columns"><strong>Kolom yang dikenali</strong><p>nomor_urut, nama, kategori, tema, koordinator, kontak, jumlah_anggota, jadwal_berangkat, alasan_pengecualian</p><a class="btn btn-secondary btn-small" href="/template-import-peserta.csv" download="template-import-peserta.csv"><i data-lucide="FileDown"></i>Unduh template CSV</a></div></div>',
          collect: (dialog) => dialog.querySelector('input[type="file"]').files[0] || false,
        });
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Ukuran CSV melebihi 2 MB.', 'danger'); return; }
        try {
          const rows = parseParticipantCsv(await file.text());
          const preview = rows.slice(0, 5).map((row) => `<li>#${row.sequenceNumber} · ${escapeHtml(row.name)} · ${escapeHtml(row.category)}</li>`).join('');
          const confirmed = await confirmDialog({
            title: `Impor ${rows.length} peserta?`,
            message: 'Seluruh batch akan ditolak bila satu baris tidak valid atau nomor urut sudah digunakan.',
            confirmLabel: 'Impor peserta',
            details: `<div class="csv-columns"><strong>Pratinjau</strong><ul>${preview}</ul>${rows.length > 5 ? `<p>dan ${rows.length - 5} peserta lainnya</p>` : ''}</div>`,
          });
          if (!confirmed) return;
          await dataService.importParticipants(rows);
          showToast(`${rows.length} peserta berhasil diimpor.`);
          navigate('/admin/peserta', { replace: true });
        } catch (error) { showToast(error.message, 'danger'); }
      });
    },
  };
}

export async function participantDetailPage({ id }) {
  const [participant, statusLogs] = await Promise.all([dataService.getParticipant(id), dataService.getStatusLogs(id)]);
  if (!participant) return { html: inlineAlert({ tone: 'danger', title: 'Peserta tidak ditemukan', message: 'Periksa kembali tautan yang dibuka.' }) };
  return {
    html: `${pageHeader({ eyebrow: 'Detail peserta', title: `#${String(participant.sequenceNumber).padStart(2, '0')} · ${participant.name}`, description: participant.theme, actions: `<a class="btn btn-secondary" href="/admin/peserta" data-link><i data-lucide="ArrowLeft"></i>Kembali</a><button class="btn btn-danger" type="button" data-archive-participant>Nonaktifkan</button><a class="btn btn-primary" href="/admin/peserta/${participant.id}/edit" data-link><i data-lucide="Edit3"></i>Edit peserta</a>` })}
      <div class="detail-layout"><section class="section-card"><div class="section-heading"><div><p class="eyebrow">Identitas</p><h2>Informasi peserta</h2></div>${statusBadge(participant.status)}</div>${detailGrid([
        ['Kategori', participant.category], ['Jumlah anggota', `${participant.memberCount} orang`], ['Koordinator', participant.coordinator], ['Nomor kontak', participant.phone], ['Jadwal berangkat', `${participant.scheduledTime} WIB`], ['Estimasi tiba', `${participant.estimatedFinish} WIB`],
      ])}</section>
      <aside class="side-stack"><section class="section-card compact"><p class="eyebrow">Progres penilaian</p><div class="big-progress"><strong>${participant.scoreProgress}/3</strong><span>lembar nilai dikirim</span><div class="mini-progress"><i style="width:${participant.scoreProgress / 3 * 100}%"></i></div></div></section><section class="section-card compact"><p class="eyebrow">Catatan operasional</p>${participant.issue ? inlineAlert({ tone: 'warning', title: 'Ada isu', message: participant.issue }) : '<p class="muted">Tidak ada isu aktif untuk peserta ini.</p>'}</section></aside></div>
      <section class="section-card"><div class="section-heading"><div><p class="eyebrow">Jejak operasional</p><h2>Riwayat perubahan status</h2></div><span class="count-badge">${statusLogs.length}</span></div><div class="status-history">${statusLogs.length ? statusLogs.slice(0, 20).map((log) => `<article><span>${statusBadge(log.to_status)}</span><div><strong>${escapeHtml(log.note || 'Tanpa catatan')}</strong><small>${new Date(log.recorded_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB · ${escapeHtml(log.profiles?.full_name || 'Petugas')}</small></div></article>`).join('') : '<p class="muted">Belum ada perubahan status.</p>'}</div></section>`,
    bind() {
      document.querySelector('[data-archive-participant]').addEventListener('click', async () => {
        const confirmed = await confirmDialog({ title: 'Nonaktifkan peserta?', message: 'Peserta tidak tampil lagi dalam operasional dan hasil. Riwayat tetap tersimpan.', confirmLabel: 'Nonaktifkan', tone: 'danger' });
        if (!confirmed) return;
        try { await dataService.archiveParticipant(participant.id); showToast('Peserta dinonaktifkan.'); navigate('/admin/peserta'); } catch (error) { showToast(error.message, 'danger'); }
      });
    },
  };
}

export async function participantFormPage({ id } = {}) {
  const participant = id ? await dataService.getParticipant(id) : null;
  const editing = Boolean(participant);
  return {
    html: `${pageHeader({ eyebrow: editing ? 'Perbarui data' : 'Data baru', title: editing ? 'Edit Peserta' : 'Tambah Peserta', description: 'Kolom bertanda * wajib diisi.', actions: '<a class="btn btn-secondary" href="/admin/peserta" data-link><i data-lucide="ArrowLeft"></i>Batal</a>' })}
      <form class="form-layout" data-participant-form novalidate>
        <section class="section-card"><div class="section-heading"><div><p class="eyebrow">Bagian 1</p><h2>Identitas peserta</h2></div></div><div class="form-grid">
          ${field('sequenceNumber', 'Nomor urut *', 'number', participant?.sequenceNumber || '', 'Contoh: 21')}
          ${selectField('category', 'Kategori *', ['Pendidikan', 'Umum'], participant?.category)}
          <label class="field span-2"><span>Nama tim/lembaga *</span><input name="name" value="${escapeHtml(participant?.name || '')}" autocomplete="organization"><small class="field-error" data-error="name"></small></label>
          <label class="field span-2"><span>Tema penampilan</span><input name="theme" value="${escapeHtml(participant?.theme || '')}"></label>
          ${field('coordinator', 'Nama koordinator', 'text', participant?.coordinator || '', '')}
          ${field('phone', 'Nomor kontak', 'tel', participant?.phone || '', '08xx-xxxx-xxxx')}
        </div></section>
        <section class="section-card"><div class="section-heading"><div><p class="eyebrow">Bagian 2</p><h2>Anggota dan jadwal</h2></div></div><div class="form-grid">
          ${field('memberCount', 'Jumlah anggota *', 'number', participant?.memberCount || '', 'Minimal 30')}
          ${field('scheduledTime', 'Jadwal berangkat', 'time', participant?.scheduledTime?.replace('.', ':') || '', '')}
          <label class="field span-2"><span>Alasan pengecualian anggota</span><textarea name="exceptionReason" rows="3" placeholder="Wajib bila jumlah anggota kurang dari 30">${escapeHtml(participant?.exceptionReason || '')}</textarea><small class="field-hint">Peserta tetap dapat disimpan bila alasan pengecualian jelas.</small><small class="field-error" data-error="exceptionReason"></small></label>
          <label class="field span-2"><span>Catatan panitia</span><textarea name="notes" rows="3">${escapeHtml(participant?.notes || '')}</textarea></label>
        </div></section>
        <div class="form-footer"><span><i data-lucide="Info"></i>Perubahan akan tercatat pada audit log saat terhubung.</span><div><a class="btn btn-secondary" href="/admin/peserta" data-link>Batal</a><button class="btn btn-primary" type="submit"><i data-lucide="Save"></i>Simpan peserta</button></div></div>
      </form>`,
    bind() {
      document.querySelector('[data-participant-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        form.querySelectorAll('.field-error').forEach((node) => { node.textContent = ''; });
        const values = Object.fromEntries(new FormData(form));
        const errors = validateParticipant(values);
        Object.entries(errors).forEach(([name, message]) => { const node = form.querySelector(`[data-error="${name}"]`); if (node) node.textContent = message; });
        if (Object.keys(errors).length) { form.querySelector('.field-error:not(:empty)')?.closest('.field')?.querySelector('input, select, textarea')?.focus(); return; }
        try {
          await dataService.saveParticipant(values, id);
          showToast(editing ? 'Perubahan peserta tersimpan.' : 'Peserta baru berhasil ditambahkan.');
          navigate('/admin/peserta');
        } catch (error) { showToast(error.message, 'danger'); }
      });
    },
  };
}

function field(name, label, type, value, placeholder) {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${type === 'number' ? 'inputmode="numeric" min="1"' : ''}><small class="field-error" data-error="${name}"></small></label>`;
}

function selectField(name, label, options, selected) {
  return `<label class="field"><span>${label}</span><select name="${name}"><option value="">Pilih kategori</option>${options.map((option) => `<option ${option === selected ? 'selected' : ''}>${option}</option>`).join('')}</select><small class="field-error" data-error="${name}"></small></label>`;
}

function detailGrid(items) {
  return `<dl class="detail-grid">${items.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
}
