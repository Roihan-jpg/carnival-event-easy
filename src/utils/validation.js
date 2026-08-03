export function validateParticipant(participant) {
  const errors = {};
  const sequenceNumber = Number(participant.sequenceNumber);
  const memberCount = Number(participant.memberCount);

  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    errors.sequenceNumber = 'Nomor urut wajib berupa angka positif.';
  }
  if (!participant.name?.trim()) errors.name = 'Nama peserta wajib diisi.';
  if (!participant.category) errors.category = 'Kategori wajib dipilih.';
  if (!Number.isInteger(memberCount) || memberCount < 1) {
    errors.memberCount = 'Jumlah anggota minimal 1.';
  }
  if (memberCount > 0 && memberCount < 30 && !participant.exceptionReason?.trim()) {
    errors.exceptionReason = 'Alasan pengecualian wajib untuk jumlah anggota di bawah 30.';
  }

  return errors;
}
