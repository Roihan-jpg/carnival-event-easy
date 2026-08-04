import { describe, expect, it } from 'vitest';
import { normalizeCriteria, normalizeEventSettings, normalizeLocations } from './settings.js';

describe('normalizeEventSettings', () => {
  it('membersihkan nilai event dan mengubah angka sebelum disimpan', () => {
    expect(normalizeEventSettings({
      name: '  Karnaval Randuagung  ', eventDate: '2026-08-22', route: '  Tunjung - Randuagung  ',
      aggregationMethod: 'average', roundingScale: '2', attractionMode: 'fixed_points', attractionPointValue: '3',
    })).toEqual({
      name: 'Karnaval Randuagung', eventDate: '2026-08-22', route: 'Tunjung - Randuagung',
      aggregationMethod: 'average', roundingScale: 2, attractionMode: 'fixed_points', attractionPointValue: 3,
    });
  });

  it('menolak informasi event yang wajib tetapi kosong', () => {
    expect(() => normalizeEventSettings({ name: '', eventDate: '', route: '' })).toThrow('Informasi event belum lengkap');
  });
});

describe('normalizeLocations', () => {
  it('membersihkan tiga titik penilaian sebelum disimpan', () => {
    const locations = normalizeLocations([
      { id: 'l-1', code: ' start ', name: ' Start ', addressNote: ' Pelepasan ', isActive: true, sortOrder: 1 },
      { id: 'l-2', code: ' tengah ', name: ' Tengah ', addressNote: '', isActive: true, sortOrder: 2 },
      { id: 'l-3', code: ' finish ', name: ' Finish ', addressNote: ' Kecamatan ', isActive: false, sortOrder: 3 },
    ]);

    expect(locations[0]).toMatchObject({ code: 'START', name: 'Start', addressNote: 'Pelepasan' });
    expect(locations[2].isActive).toBe(false);
  });

  it('menolak kode titik penilaian yang sama', () => {
    expect(() => normalizeLocations([
      { id: 'l-1', code: 'START', name: 'Start', sortOrder: 1 },
      { id: 'l-2', code: 'start', name: 'Finish', sortOrder: 2 },
    ])).toThrow('Kode titik penilaian harus unik');
  });
});

describe('normalizeCriteria', () => {
  it('menolak total bobot rubrik yang bukan 100', () => {
    expect(() => normalizeCriteria([
      { id: 'c-1', code: 'A', name: 'Konsep', hint: '', max: 40, sortOrder: 1 },
      { id: 'c-2', code: 'B', name: 'Visual', hint: '', max: 50, sortOrder: 2 },
    ])).toThrow('Total maksimum rubrik harus tepat 100');
  });
});
