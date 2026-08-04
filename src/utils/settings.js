export function normalizeEventSettings(values) {
  const normalized = {
    name: values.name?.trim() || '',
    eventDate: values.eventDate || '',
    route: values.route?.trim() || '',
    aggregationMethod: values.aggregationMethod || 'average',
    roundingScale: Number(values.roundingScale ?? 2),
    attractionMode: values.attractionMode || 'compliance_only',
    attractionPointValue: Number(values.attractionPointValue || 0),
  };
  if (!normalized.name || !normalized.eventDate || !normalized.route) throw new Error('Informasi event belum lengkap.');
  if (!['average', 'sum'].includes(normalized.aggregationMethod)) throw new Error('Metode agregasi tidak valid.');
  if (!Number.isInteger(normalized.roundingScale) || normalized.roundingScale < 0 || normalized.roundingScale > 6) throw new Error('Pembulatan harus berupa angka 0 sampai 6.');
  if (!['fixed_points', 'compliance_only'].includes(normalized.attractionMode)) throw new Error('Mode atraksi tidak valid.');
  if (normalized.attractionMode === 'fixed_points' && normalized.attractionPointValue <= 0) throw new Error('Poin per atraksi harus lebih dari 0.');
  return normalized;
}

export function normalizeLocations(locations) {
  const normalized = locations.map((location, index) => ({
    id: location.id,
    code: location.code?.trim().toUpperCase() || '',
    name: location.name?.trim() || '',
    addressNote: location.addressNote?.trim() || '',
    sortOrder: Number(location.sortOrder || index + 1),
    isActive: Boolean(location.isActive),
  }));
  if (normalized.some((location) => !location.code || !location.name)) throw new Error('Kode dan nama titik penilaian wajib diisi.');
  if (new Set(normalized.map((location) => location.code)).size !== normalized.length) throw new Error('Kode titik penilaian harus unik.');
  return normalized;
}

export function normalizeCriteria(criteria) {
  const normalized = criteria.map((criterion, index) => ({
    id: criterion.id,
    code: criterion.code,
    name: criterion.name?.trim() || '',
    hint: criterion.hint?.trim() || '',
    max: Number(criterion.max),
    sortOrder: Number(criterion.sortOrder || index + 1),
  }));
  if (normalized.some((criterion) => !criterion.name)) throw new Error('Nama kriteria rubrik wajib diisi.');
  if (normalized.some((criterion) => !Number.isInteger(criterion.max) || criterion.max < 1)) throw new Error('Setiap bobot rubrik minimal 1 poin.');
  if (normalized.reduce((sum, criterion) => sum + criterion.max, 0) !== 100) throw new Error('Total maksimum rubrik harus tepat 100.');
  return normalized;
}
