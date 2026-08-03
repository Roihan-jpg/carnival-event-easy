const WIB_FORMAT = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatWib(value) {
  if (!value) return '—';
  return WIB_FORMAT.format(new Date(value)).replace('.', ':');
}

export function mapParticipant(row) {
  const category = Array.isArray(row.participant_categories) ? row.participant_categories[0] : row.participant_categories;
  return {
    id: row.id,
    eventId: row.event_id,
    categoryId: row.category_id ?? category?.id,
    category: category?.name || '—',
    categoryCode: category?.code || '',
    sequenceNumber: row.sequence_number,
    name: row.name,
    theme: row.theme || '',
    coordinator: row.coordinator_name || '',
    phone: row.coordinator_phone || '',
    memberCount: Number(row.member_count),
    scheduledDepartureAt: row.scheduled_departure_at,
    estimatedFinishAt: row.estimated_finish_at,
    actualDepartureAt: row.actual_departure_at,
    actualFinishAt: row.actual_finish_at,
    scheduledTime: formatWib(row.scheduled_departure_at),
    estimatedFinish: formatWib(row.estimated_finish_at),
    status: row.status,
    exceptionReason: row.exception_reason || '',
    notes: row.notes || '',
    isActive: row.is_active,
    scoreProgress: Number(row.scoreProgress || 0),
    issue: row.status === 'issue' ? row.notes || 'Peserta memerlukan tindak lanjut.' : '',
  };
}

export function mapScoreCriterion(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    max: Number(row.max_score),
    hint: row.description || '',
    sortOrder: row.sort_order,
  };
}

export function mapProfile(row) {
  const initials = row.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return {
    id: row.id,
    name: row.full_name,
    fullName: row.full_name,
    role: row.role,
    roleLabel: roleLabel(row.role),
    initials,
    active: row.is_active,
    isActive: row.is_active,
  };
}

export function roleLabel(role) {
  return ({ super_admin: 'Super Admin', admin: 'Admin Panitia', judge: 'Juri', operator: 'Operator', viewer: 'Viewer' })[role] || role;
}
