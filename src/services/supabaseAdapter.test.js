import { describe, expect, it } from 'vitest';
import { ASSIGNMENT_SELECTS } from './supabaseAdapter.js';

describe('query relasi penugasan', () => {
  it('menentukan foreign key profil secara eksplisit agar PostgREST tidak ambigu', () => {
    expect(ASSIGNMENT_SELECTS.judge).toContain('profiles!judge_assignments_judge_id_fkey');
    expect(ASSIGNMENT_SELECTS.attraction).toContain('profiles!attraction_verifier_assignments_operator_id_fkey');
  });
});
