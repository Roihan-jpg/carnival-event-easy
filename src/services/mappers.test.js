import { describe, expect, it } from 'vitest';
import { mapParticipant, mapScoreCriterion } from './mappers.js';

describe('mapping schema Supabase ke model tampilan', () => {
  it('memetakan participant snake_case dan relasi kategori', () => {
    const result = mapParticipant({
      id: 'p-1',
      event_id: 'e-1',
      sequence_number: 7,
      name: 'Sanggar Laras',
      coordinator_name: 'Rina',
      coordinator_phone: '0812',
      member_count: 30,
      scheduled_departure_at: '2026-08-22T04:30:00Z',
      estimated_finish_at: '2026-08-22T11:30:00Z',
      participant_categories: { id: 'c-1', name: 'Umum', code: 'GENERAL' },
      status: 'registered',
    });

    expect(result).toMatchObject({ id: 'p-1', eventId: 'e-1', sequenceNumber: 7, categoryId: 'c-1', category: 'Umum', coordinator: 'Rina', phone: '0812', memberCount: 30 });
  });

  it('menggunakan UUID criterion sebagai id form dan max_score sebagai batas', () => {
    expect(mapScoreCriterion({ id: 'criterion-uuid', code: 'CONCEPT_ORIGINALITY', name: 'Konsep', max_score: 20, description: 'Gagasan', sort_order: 1 })).toEqual({ id: 'criterion-uuid', code: 'CONCEPT_ORIGINALITY', name: 'Konsep', max: 20, hint: 'Gagasan', sortOrder: 1 });
  });
});
