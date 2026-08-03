const MESSAGE_BY_CODE = {
  '23505': 'Data tersebut sudah digunakan. Periksa nomor urut atau penugasan yang dipilih.',
  '23503': 'Data tidak dapat disimpan karena referensi terkait tidak ditemukan.',
  '23514': 'Data tidak memenuhi aturan yang ditetapkan.',
  '42501': 'Anda tidak memiliki izin untuk melakukan tindakan tersebut.',
  PGRST116: 'Data yang diminta tidak ditemukan.',
};

const MESSAGE_BY_DETAIL = {
  score_sheet_locked: 'Nilai telah dikirim dan dikunci.',
  version_conflict: 'Draf berubah di perangkat lain. Muat ulang sebelum menyimpan kembali.',
  configuration_incomplete: 'Konfigurasi event belum lengkap.',
  event_configuration_locked: 'Konfigurasi terkunci karena penjurian sudah dibuka.',
  scoring_not_open: 'Penjurian belum dibuka atau sudah ditutup.',
  score_sheet_incomplete: 'Delapan nilai wajib diisi sebelum dikirim.',
  score_exceeds_criterion_maximum: 'Nilai melebihi maksimum kriteria.',
  zero_score_requires_reason: 'Nilai nol wajib disertai alasan.',
  results_incomplete: 'Hasil belum dapat difinalkan karena nilai belum lengkap.',
  scoring_must_be_closed: 'Tutup penjurian sebelum membuat atau menerbitkan hasil.',
  waiver_requires_two_submitted_scores: 'Waiver memerlukan minimal dua nilai juri yang sudah dikirim.',
  waiver_reason_and_minutes_required: 'Alasan dan referensi berita acara waiver wajib diisi.',
  heavy_penalty_requires_super_admin: 'Penalti di atas 10 poin memerlukan Super Admin.',
  cancellation_reason_required: 'Alasan pembatalan wajib diisi.',
  super_admin_required: 'Tindakan ini hanya dapat dilakukan Super Admin.',
  admin_required: 'Tindakan ini hanya dapat dilakukan Admin.',
  judge_assignment_required: 'Akun juri belum memiliki penugasan aktif.',
  attraction_assignment_required: 'Akun operator belum memiliki penugasan atraksi aktif.',
  active_judge_required: 'Pilih akun juri yang aktif.',
  active_operator_required: 'Pilih akun operator yang aktif.',
  cannot_deactivate_self: 'Anda tidak dapat menonaktifkan akun sendiri.',
  last_super_admin_required: 'Minimal satu akun Super Admin harus tetap aktif.',
  cannot_delete_self: 'Anda tidak dapat menghapus akun sendiri.',
  profile_has_related_records: 'Pengguna masih memiliki data atau penugasan terkait. Nonaktifkan akun jika tidak ingin menghapus riwayatnya.',
  profile_not_found: 'Profil pengguna tidak ditemukan.',
  invalid_event_transition: 'Perubahan status event tersebut tidak diizinkan.',
  unsupported_event_transition: 'Perubahan status event tersebut tidak didukung.',
};

export function toUserMessage(error) {
  if (error?.status === 401 || error?.code === 'PGRST301') {
    return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  }
  const detail = Object.entries(MESSAGE_BY_DETAIL).find(([key]) => error?.message?.includes(key));
  if (detail) return detail[1];
  if (MESSAGE_BY_CODE[error?.code]) return MESSAGE_BY_CODE[error.code];
  return 'Terjadi kendala saat memproses data. Silakan coba lagi.';
}

export function assertSupabase(result) {
  if (result.error) throw Object.assign(new Error(toUserMessage(result.error)), { cause: result.error });
  return result.data;
}
