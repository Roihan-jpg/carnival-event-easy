import { confirmDialog } from '../../components/modal.js';
import { dataTable, inlineAlert, pageHeader, statusBadge } from '../../components/ui.js';
import { showToast } from '../../components/toast.js';
import { navigate } from '../../core/router.js';
import { getState } from '../../core/state.js';
import { dataService } from '../../services/dataService.js';
import { escapeHtml } from '../../utils/html.js';

function assignmentCard({ item, assignment, type }) {
  const name = assignment?.profiles?.full_name || 'Belum ditugaskan';
  return `<article>
    <span class="location-index"><i data-lucide="${type === 'judge' ? 'MapPin' : 'BadgeCheck'}"></i></span>
    <div><small>${escapeHtml(item.code)}</small><strong>${escapeHtml(item.name)}</strong></div>
    <span class="assignee"><i>${assignment ? escapeHtml(name.split(' ').map((part) => part[0]).slice(0, 2).join('')) : '—'}</i><span>${escapeHtml(name)}</span></span>
    <button class="icon-btn" type="button" data-assign-${type}="${item.id}" data-assignment-id="${assignment?.id || ''}" aria-label="Ubah penugasan ${escapeHtml(item.name)}"><i data-lucide="Edit3"></i></button>
  </article>`;
}

function assignmentDialog(title, options) {
  return confirmDialog({
    title,
    message: 'Satu petugas hanya dapat memegang satu titik aktif pada event ini.',
    confirmLabel: 'Simpan penugasan',
    details: `<label class="field"><span>Petugas</span><select name="staff-id"><option value="">Kosongkan penugasan</option>${options.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join('')}</select></label>`,
    collect: (dialog) => ({ staffId: dialog.querySelector('[name="staff-id"]').value }),
  });
}

export async function usersPage() {
  const [users, settings] = await Promise.all([dataService.getUsers(), dataService.getEventSettings()]);
  const currentUser = getState().user;
  const judges = users.filter((user) => user.roleCode === 'judge' && user.active);
  const operators = users.filter((user) => user.roleCode === 'operator' && user.active);
  const canManage = (row) => currentUser.role === 'super_admin' || !['super_admin', 'admin'].includes(row.roleCode);
  const columns = [
    { label: 'Pengguna', render: (row) => `<span class="user-cell"><span class="avatar small">${escapeHtml(row.initials)}</span><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.email)}</small></span></span>` },
    { label: 'Role', render: (row) => `<span class="role-label">${escapeHtml(row.role)}</span>` },
    { label: 'Penugasan', key: 'assignment' },
    { label: 'Status', render: (row) => statusBadge(row.active ? 'active' : 'inactive') },
    { label: 'Aksi', render: (row) => canManage(row) && row.id !== currentUser.id
      ? `<button class="btn btn-small btn-secondary" type="button" data-toggle-user="${row.id}" data-active="${row.active}">${row.active ? 'Nonaktifkan' : 'Aktifkan'}</button>`
      : '<span class="muted">Dilindungi</span>' },
  ];
  const roleOptions = currentUser.role === 'super_admin'
    ? '<option value="admin">Admin</option><option value="judge">Juri</option><option value="operator">Operator</option><option value="viewer">Viewer</option>'
    : '<option value="judge">Juri</option><option value="operator">Operator</option><option value="viewer">Viewer</option>';

  return {
    html: `${pageHeader({ eyebrow: 'Akses dan penugasan', title: 'Pengguna', description: 'Kelola profil petugas, status akun, dan penugasan event.', actions: '<button class="btn btn-primary" type="button" data-add-profile><i data-lucide="Plus"></i>Tambahkan profil</button>' })}
      ${inlineAlert({ tone: 'info', title: 'Pembuatan akun aman', message: 'Buat akun terlebih dahulu di Supabase Authentication, lalu masukkan User ID pada form profil. Password dan service-role tidak pernah diproses browser.' })}
      <section class="section-card table-card">${dataTable({ columns, rows: users })}</section>
      <section class="section-card"><div class="section-heading"><div><p class="eyebrow">Penugasan juri</p><h2>Titik penilaian</h2></div></div><div class="assignment-grid">${settings.locations.map((location) => assignmentCard({ item: location, assignment: settings.judgeAssignments.find((row) => row.location_id === location.id), type: 'judge' })).join('')}</div></section>
      <section class="section-card"><div class="section-heading"><div><p class="eyebrow">Verifikator atraksi</p><h2>Tiga titik atraksi wajib</h2></div></div><div class="assignment-grid">${settings.points.map((point) => assignmentCard({ item: point, assignment: settings.attractionAssignments.find((row) => row.attraction_point_id === point.id), type: 'attraction' })).join('')}</div></section>`,
    bind() {
      document.querySelector('[data-add-profile]').addEventListener('click', async () => {
        const values = await confirmDialog({
          title: 'Tambahkan profil akun', message: 'User ID harus berasal dari Authentication → Users.', confirmLabel: 'Simpan profil',
          details: `<div class="dialog-options"><label class="field"><span>User ID (UUID) *</span><input name="user-id" autocomplete="off"></label><label class="field"><span>Nama lengkap *</span><input name="full-name"></label><label class="field"><span>Role *</span><select name="role">${roleOptions}</select></label></div>`,
          collect: (dialog) => {
            const id = dialog.querySelector('[name="user-id"]').value.trim();
            const fullName = dialog.querySelector('[name="full-name"]').value.trim();
            if (!id || !fullName) return false;
            return { id, fullName, role: dialog.querySelector('[name="role"]').value };
          },
        });
        if (!values) return;
        try { await dataService.createProfile(values); showToast('Profil pengguna ditambahkan.'); navigate('/admin/pengguna', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      });

      document.querySelectorAll('[data-toggle-user]').forEach((button) => button.addEventListener('click', async () => {
        try { await dataService.setUserActive(button.dataset.toggleUser, button.dataset.active !== 'true'); showToast('Status pengguna diperbarui.'); navigate('/admin/pengguna', { replace: true }); } catch (error) { showToast(error.message, 'danger'); }
      }));

      document.querySelectorAll('[data-assign-judge]').forEach((button) => button.addEventListener('click', async () => {
        const values = await assignmentDialog('Tetapkan juri lokasi', judges);
        if (!values) return;
        try {
          if (values.staffId) await dataService.assignJudge(values.staffId, button.dataset.assignJudge);
          else if (button.dataset.assignmentId) await dataService.revokeJudgeAssignment(button.dataset.assignmentId);
          showToast('Penugasan juri diperbarui.');
          navigate('/admin/pengguna', { replace: true });
        } catch (error) { showToast(error.message, 'danger'); }
      }));

      document.querySelectorAll('[data-assign-attraction]').forEach((button) => button.addEventListener('click', async () => {
        const values = await assignmentDialog('Tetapkan verifikator atraksi', operators);
        if (!values) return;
        try {
          if (values.staffId) await dataService.assignAttractionVerifier(values.staffId, button.dataset.assignAttraction);
          else if (button.dataset.assignmentId) await dataService.revokeAttractionAssignment(button.dataset.assignmentId);
          showToast('Penugasan verifikator diperbarui.');
          navigate('/admin/pengguna', { replace: true });
        } catch (error) { showToast(error.message, 'danger'); }
      }));
    },
  };
}
