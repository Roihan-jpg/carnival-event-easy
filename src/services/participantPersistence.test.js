import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setState } from '../core/state.js';
import { getSupabaseClient } from './supabase.js';
import { supabaseAdapter } from './supabaseAdapter.js';

vi.mock('./supabase.js', () => ({ getSupabaseClient: vi.fn() }));

describe('penyimpanan peserta baru', () => {
  beforeEach(() => {
    setState({ activeEvent: { id: 'event-1', event_date: '2026-08-22' } });
  });

  it('mengaktifkan kembali baris lama ketika nomor urut hanya dimiliki peserta nonaktif', async () => {
    const categoryQuery = {};
    categoryQuery.select = vi.fn(() => categoryQuery);
    categoryQuery.eq = vi.fn(() => categoryQuery);
    categoryQuery.order = vi.fn(async () => ({ data: [{ id: 'category-1', name: 'Umum' }], error: null }));

    const lookupQuery = {};
    lookupQuery.select = vi.fn(() => lookupQuery);
    lookupQuery.eq = vi.fn(() => lookupQuery);
    lookupQuery.maybeSingle = vi.fn(async () => ({ data: { id: 'participant-20', is_active: false }, error: null }));

    const participantQuery = {};
    participantQuery.update = vi.fn(() => participantQuery);
    participantQuery.eq = vi.fn(() => participantQuery);
    participantQuery.select = vi.fn(() => participantQuery);
    participantQuery.single = vi.fn(async () => ({
      data: { id: 'participant-20', event_id: 'event-1', category_id: 'category-1', sequence_number: 20, name: 'Peserta 20', member_count: 30, is_active: true, participant_categories: { id: 'category-1', name: 'Umum' } },
      error: null,
    }));

    let participantCall = 0;
    getSupabaseClient.mockReturnValue({ from: vi.fn((table) => {
      if (table === 'participant_categories') return categoryQuery;
      participantCall += 1;
      return participantCall === 1 ? lookupQuery : participantQuery;
    }) });

    await supabaseAdapter.saveParticipant({ sequenceNumber: 20, name: 'Peserta 20', category: 'Umum', memberCount: 30 });

    expect(participantQuery.update).toHaveBeenCalledWith(expect.objectContaining({ event_id: 'event-1', sequence_number: 20, is_active: true }));
    expect(participantQuery.eq).toHaveBeenCalledWith('id', 'participant-20');
  });

  it('tetap menolak nomor urut milik peserta aktif', async () => {
    const categoryQuery = {};
    categoryQuery.select = vi.fn(() => categoryQuery);
    categoryQuery.eq = vi.fn(() => categoryQuery);
    categoryQuery.order = vi.fn(async () => ({ data: [{ id: 'category-1', name: 'Umum' }], error: null }));
    const lookupQuery = {};
    lookupQuery.select = vi.fn(() => lookupQuery);
    lookupQuery.eq = vi.fn(() => lookupQuery);
    lookupQuery.maybeSingle = vi.fn(async () => ({ data: { id: 'participant-20', is_active: true }, error: null }));
    getSupabaseClient.mockReturnValue({ from: vi.fn((table) => table === 'participant_categories' ? categoryQuery : lookupQuery) });

    await expect(supabaseAdapter.saveParticipant({ sequenceNumber: 20, name: 'Peserta Baru', category: 'Umum', memberCount: 30 }))
      .rejects.toThrow('Nomor urut sudah digunakan oleh peserta aktif.');
  });
});
