import { describe, expect, it } from 'vitest';
import {
  aggregateJudgeScores,
  calculateFinalScore,
  calculateScoreTotal,
  compareResults,
  getCompletionStatus,
  validateScores,
} from './scoring.js';

describe('validasi penilaian', () => {
  it('menghitung total delapan kriteria tanpa pembulatan antara', () => {
    expect(calculateScoreTotal([18, 13, 17, 14, 8, 9, 4, 5])).toBe(88);
  });

  it('menolak nilai negatif, melebihi maksimum, dan nilai nol tanpa alasan', () => {
    const errors = validateScores(
      { konsep: -1, cerita: 16, visual: 0 },
      { konsep: '', cerita: '', visual: '' },
      [
        { id: 'konsep', max: 20 },
        { id: 'cerita', max: 15 },
        { id: 'visual', max: 20 },
      ],
    );

    expect(errors.konsep).toContain('minimal 0');
    expect(errors.cerita).toContain('maksimal 15');
    expect(errors.visual).toContain('Alasan wajib');
  });

  it('menghitung nilai akhir dengan batas bawah nol dan dua desimal', () => {
    expect(calculateFinalScore([88, 87, 89], 6, 2)).toBe(92);
    expect(calculateFinalScore([1, 2, 3], 0, 10)).toBe(0);
    expect(calculateFinalScore([91, 92, 94], 2, 0)).toBe(94.33);
  });

  it('mendukung agregasi rata-rata dan jumlah tanpa default diam-diam', () => {
    expect(aggregateJudgeScores([80, 90, 100], 'average')).toBe(90);
    expect(aggregateJudgeScores([80, 90, 100], 'sum')).toBe(270);
    expect(() => aggregateJudgeScores([80], '')).toThrow('Metode agregasi');
  });

  it('menandai hasil lengkap dan waiver yang sah', () => {
    expect(getCompletionStatus({ submittedCount: 3, waivedCount: 0, unresolvedAttractions: 0 })).toEqual({ complete: true, waived: false, reason: '' });
    expect(getCompletionStatus({ submittedCount: 2, waivedCount: 1, unresolvedAttractions: 0 })).toEqual({ complete: true, waived: true, reason: '' });
    expect(getCompletionStatus({ submittedCount: 2, waivedCount: 0, unresolvedAttractions: 0 }).reason.toLowerCase()).toContain('nilai juri');
    expect(getCompletionStatus({ submittedCount: 3, waivedCount: 0, unresolvedAttractions: 1 }).reason.toLowerCase()).toContain('atraksi');
  });

  it('mengurutkan tie-break resmi sampai penalti terkecil', () => {
    const base = { finalScore: 90, conceptScore: 18, visualScore: 17, culturalScore: 9, disciplineScore: 5, penaltyTotal: 0 };
    expect(compareResults({ ...base, conceptScore: 19 }, base)).toBeLessThan(0);
    expect(compareResults({ ...base, penaltyTotal: 2 }, { ...base, penaltyTotal: 5 })).toBeLessThan(0);
    expect(compareResults(base, { ...base })).toBe(0);
  });
});
