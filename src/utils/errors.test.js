import { describe, expect, it } from 'vitest';
import { toUserMessage } from './errors.js';

describe('terjemahan error Supabase', () => {
  it('menerjemahkan constraint dan session expired tanpa membocorkan detail provider', () => {
    expect(toUserMessage({ code: '23505' })).toContain('sudah digunakan');
    expect(toUserMessage({ status: 401 })).toContain('Sesi');
    expect(toUserMessage({ message: 'raw provider failure' })).toBe('Terjadi kendala saat memproses data. Silakan coba lagi.');
  });

  it('menerjemahkan error workflow sensitif', () => {
    expect(toUserMessage({ code: '42501', message: 'super_admin_required' })).toContain('Super Admin');
    expect(toUserMessage({ message: 'waiver_requires_two_submitted_scores' })).toContain('dua nilai');
    expect(toUserMessage({ message: 'score_sheet_incomplete' })).toContain('Delapan nilai');
  });
});
