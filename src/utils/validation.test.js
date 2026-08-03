import { describe, expect, it } from 'vitest';
import { validateParticipant } from './validation.js';

describe('validasi peserta', () => {
  it('memerlukan alasan pengecualian untuk anggota kurang dari 30', () => {
    const errors = validateParticipant({
      sequenceNumber: 21,
      name: 'Sanggar Laras',
      category: 'Umum',
      memberCount: 24,
      exceptionReason: '',
    });
    expect(errors.exceptionReason).toContain('wajib');
  });

  it('menerima peserta kecil bila alasan pengecualian diisi', () => {
    const errors = validateParticipant({
      sequenceNumber: 21,
      name: 'Sanggar Laras',
      category: 'Umum',
      memberCount: 24,
      exceptionReason: 'Formasi khusus dari sekolah luar biasa.',
    });
    expect(errors).toEqual({});
  });
});
