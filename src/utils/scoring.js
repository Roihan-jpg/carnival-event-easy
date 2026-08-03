export function calculateScoreTotal(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

export function validateScores(scores, reasons, criteria) {
  return criteria.reduce((errors, criterion) => {
    const rawValue = scores[criterion.id];
    const value = Number(rawValue);

    if (rawValue === '' || rawValue === undefined || Number.isNaN(value)) {
      errors[criterion.id] = 'Nilai wajib diisi.';
    } else if (!Number.isInteger(value)) {
      errors[criterion.id] = 'Nilai harus berupa angka bulat.';
    } else if (value < 0) {
      errors[criterion.id] = 'Nilai minimal 0.';
    } else if (value > criterion.max) {
      errors[criterion.id] = `Nilai maksimal ${criterion.max}.`;
    } else if (value === 0 && !reasons[criterion.id]?.trim()) {
      errors[criterion.id] = 'Alasan wajib diisi bila nilai 0.';
    }

    return errors;
  }, {});
}

export function calculateFinalScore(judgeTotals, attractionPoints, penalties) {
  if (!judgeTotals.length) return 0;
  const aggregate = calculateScoreTotal(judgeTotals) / judgeTotals.length;
  return Math.round(Math.max(0, aggregate + attractionPoints - penalties) * 100) / 100;
}

export function aggregateJudgeScores(judgeTotals, method) {
  if (method !== 'average' && method !== 'sum') {
    throw new Error('Metode agregasi belum dikonfigurasi.');
  }
  if (!judgeTotals.length) return 0;
  const sum = calculateScoreTotal(judgeTotals);
  return method === 'average' ? sum / judgeTotals.length : sum;
}

export function getCompletionStatus({ submittedCount, waivedCount, unresolvedAttractions }) {
  if (unresolvedAttractions > 0) {
    return { complete: false, waived: false, reason: 'Verifikasi atraksi wajib belum lengkap.' };
  }
  if (submittedCount === 3) return { complete: true, waived: false, reason: '' };
  if (submittedCount >= 2 && waivedCount > 0) return { complete: true, waived: true, reason: '' };
  return { complete: false, waived: false, reason: 'Nilai juri belum lengkap.' };
}

export function compareResults(first, second) {
  const descendingFields = ['finalScore', 'conceptScore', 'visualScore', 'culturalScore', 'disciplineScore'];
  for (const field of descendingFields) {
    const difference = Number(second[field] || 0) - Number(first[field] || 0);
    if (difference) return difference;
  }
  return Number(first.penaltyTotal || 0) - Number(second.penaltyTotal || 0);
}
