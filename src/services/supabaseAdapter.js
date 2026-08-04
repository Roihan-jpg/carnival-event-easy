import { getState, setState } from '../core/state.js';
import { assertSupabase } from '../utils/errors.js';
import { formatWib, mapParticipant, mapProfile, mapScoreCriterion, roleLabel } from './mappers.js';
import { getSupabaseClient } from './supabase.js';
import { validateParticipant } from '../utils/validation.js';

const EVENT_SELECT = 'id, name, year, event_date, route_description, timezone, status, normal_performance_minutes, finish_extra_minutes, aggregation_method, rounding_scale, attraction_mode, attraction_point_value, tie_break_config, config_locked_at, published_at, created_at, updated_at';
export const ASSIGNMENT_SELECTS = {
  judge: '*, profiles!judge_assignments_judge_id_fkey(full_name, is_active, role), judging_locations(name, code)',
  attraction: '*, profiles!attraction_verifier_assignments_operator_id_fkey(full_name, is_active, role), attraction_points(name, code)',
};
const AUDIT_ACTION_LABELS = {
  SCORE_SUBMITTED: 'Nilai dikirim dan dikunci',
  SCORE_UNLOCKED: 'Nilai dibuka kembali',
  SCORE_WAIVED: 'Nilai diberikan waiver',
  PENALTY_CONFIRMED: 'Penalti dikonfirmasi',
  PENALTY_CANCELLED: 'Penalti dibatalkan',
  EVENT_STATUS_CHANGED: 'Status event diperbarui',
  EVENT_SCHEDULE_CHANGED: 'Jadwal pelaksanaan diperbarui',
  RESULT_SNAPSHOT_CREATED: 'Snapshot hasil dibuat',
  RESULT_PUBLISHED: 'Hasil diterbitkan',
  JURY_COUNCIL_DECISION_SET: 'Keputusan Dewan Juri disimpan',
  USER_LOGIN: 'Pengguna masuk',
};

function auditActionLabel(action) {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  const [entity, operation] = action.split('_');
  const entityLabels = { PARTICIPANTS: 'Peserta', PROFILES: 'Profil', JUDGE: 'Penugasan juri', ATTRACTION: 'Penugasan atraksi', EVENTS: 'Event', SCORE: 'Nilai', PENALTIES: 'Penalti', INCIDENTS: 'Insiden' };
  const operationLabels = { INSERT: 'ditambahkan', UPDATE: 'diperbarui', DELETE: 'dihapus' };
  return `${entityLabels[entity] || 'Data'} ${operationLabels[operation] || 'diubah'}`;
}

function client() {
  const value = getSupabaseClient();
  if (!value) throw new Error('Konfigurasi Supabase belum tersedia.');
  return value;
}

async function activeEvent() {
  const cached = getState().activeEvent;
  if (cached) return cached;
  const data = assertSupabase(await client().from('events').select(EVENT_SELECT).order('year', { ascending: false }).limit(1).single());
  setState({ activeEvent: data });
  return data;
}

function toIsoAtEventDate(date, time) {
  if (!time) return null;
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function addHours(value, hours) {
  if (!value) return null;
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function participantProgress(eventId) {
  const rows = assertSupabase(await client().from('score_sheets').select('participant_id, status').eq('event_id', eventId));
  return rows.reduce((map, row) => {
    if (row.status === 'submitted') map.set(row.participant_id, (map.get(row.participant_id) || 0) + 1);
    return map;
  }, new Map());
}

async function getParticipants() {
  const event = await activeEvent();
  const [rows, progress] = await Promise.all([
    assertSupabase(await client().from('participants')
      .select('*, participant_categories(id, code, name)')
      .eq('event_id', event.id).eq('is_active', true).order('sequence_number')),
    participantProgress(event.id),
  ]);
  return rows.map((row) => mapParticipant({ ...row, scoreProgress: progress.get(row.id) || 0 }));
}

async function getParticipant(id) {
  const row = assertSupabase(await client().from('participants')
    .select('*, participant_categories(id, code, name)').eq('id', id).maybeSingle());
  if (!row) return null;
  const progress = await participantProgress(row.event_id);
  return mapParticipant({ ...row, scoreProgress: progress.get(row.id) || 0 });
}

async function getCategories() {
  const event = await activeEvent();
  return assertSupabase(await client().from('participant_categories').select('*').eq('event_id', event.id).order('sort_order'));
}

async function saveParticipant(values, id) {
  const event = await activeEvent();
  const categories = await getCategories();
  const category = categories.find((item) => item.id === values.categoryId || item.name === values.category);
  if (!category) throw new Error('Kategori peserta tidak ditemukan.');
  const existing = id ? null : assertSupabase(await client().from('participants')
    .select('id, is_active').eq('event_id', event.id).eq('sequence_number', Number(values.sequenceNumber)).maybeSingle());
  if (existing?.is_active) throw new Error('Nomor urut sudah digunakan oleh peserta aktif.');
  const departure = toIsoAtEventDate(event.event_date, values.scheduledTime);
  const payload = {
    event_id: event.id,
    category_id: category.id,
    sequence_number: Number(values.sequenceNumber),
    name: values.name.trim(),
    theme: values.theme?.trim() || null,
    coordinator_name: values.coordinator?.trim() || null,
    coordinator_phone: values.phone?.trim() || null,
    member_count: Number(values.memberCount),
    scheduled_departure_at: departure,
    estimated_finish_at: addHours(departure, 7),
    exception_reason: values.exceptionReason?.trim() || null,
    notes: values.notes?.trim() || null,
    is_active: true,
  };
  const query = id
    ? client().from('participants').update(payload).eq('id', id)
    : existing
      ? client().from('participants').update(payload).eq('id', existing.id)
      : client().from('participants').insert(payload);
  const row = assertSupabase(await query.select('*, participant_categories(id, code, name)').single());
  return mapParticipant(row);
}

async function archiveParticipant(id) {
  assertSupabase(await client().from('participants').update({ is_active: false }).eq('id', id));
}

async function importParticipants(rows) {
  if (!rows.length || rows.length > 500) throw new Error('Jumlah baris impor harus antara 1 dan 500 peserta.');
  const event = await activeEvent();
  const categories = await getCategories();
  const existing = assertSupabase(await client().from('participants').select('sequence_number, is_active').eq('event_id', event.id));
  const used = new Set(existing.filter((row) => row.is_active).map((row) => row.sequence_number));
  const batch = new Set();
  const errors = [];
  const payload = rows.map((values, index) => {
    const validation = validateParticipant(values);
    const category = categories.find((item) => item.name.toLowerCase() === values.category.toLowerCase());
    if (!category) validation.category = `Kategori “${values.category}” tidak tersedia.`;
    if (used.has(values.sequenceNumber) || batch.has(values.sequenceNumber)) validation.sequenceNumber = 'Nomor urut sudah digunakan.';
    const scheduleValid = !values.scheduledTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(values.scheduledTime);
    if (!scheduleValid) validation.scheduledTime = 'Jadwal harus berformat HH:mm.';
    batch.add(values.sequenceNumber);
    if (Object.keys(validation).length) errors.push(`Baris ${index + 2}: ${Object.values(validation).join(' ')}`);
    const departure = scheduleValid ? toIsoAtEventDate(event.event_date, values.scheduledTime) : null;
    return {
      event_id: event.id,
      category_id: category?.id,
      sequence_number: Number(values.sequenceNumber),
      name: values.name.trim(),
      theme: values.theme?.trim() || null,
      coordinator_name: values.coordinator?.trim() || null,
      coordinator_phone: values.phone?.trim() || null,
      member_count: Number(values.memberCount),
      scheduled_departure_at: departure,
      estimated_finish_at: addHours(departure, 7),
      exception_reason: values.exceptionReason?.trim() || null,
      is_active: true,
    };
  });
  if (errors.length) throw new Error(errors.slice(0, 5).join(' '));
  return assertSupabase(await client().from('participants').upsert(payload, { onConflict: 'event_id,sequence_number' }).select());
}

async function getLocations() {
  const event = await activeEvent();
  return assertSupabase(await client().from('judging_locations').select('*').eq('event_id', event.id).order('sort_order'));
}

async function updateLocations(locations) {
  const event = await activeEvent();
  const payload = locations.map((location) => ({
    id: location.id,
    event_id: event.id,
    code: location.code,
    name: location.name,
    address_note: location.addressNote || null,
    sort_order: location.sortOrder,
    is_active: location.isActive,
  }));
  return assertSupabase(await client().from('judging_locations').upsert(payload).select());
}

async function getCriteria() {
  const event = await activeEvent();
  const rows = assertSupabase(await client().from('score_criteria').select('*').eq('event_id', event.id).eq('is_active', true).order('sort_order'));
  return rows.map(mapScoreCriterion);
}

function mapSheet(row) {
  const entries = row.score_entries || [];
  return {
    id: row.id,
    eventId: row.event_id,
    participantId: row.participant_id,
    locationId: row.location_id,
    judgeId: row.judge_id,
    status: row.status,
    total: Number(row.total_score),
    totalScore: Number(row.total_score),
    generalNote: row.general_note || '',
    version: row.version,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at ? `${formatWib(row.updated_at)} WIB` : '—',
    scores: Object.fromEntries(entries.map((entry) => [entry.criterion_id, Number(entry.score)])),
    reasons: Object.fromEntries(entries.map((entry) => [entry.criterion_id, entry.note || ''])),
  };
}

async function getScoreSheets() {
  const event = await activeEvent();
  const rows = assertSupabase(await client().from('score_sheets')
    .select('*, score_entries(criterion_id, score, note)').eq('event_id', event.id).order('updated_at', { ascending: false }));
  return rows.map(mapSheet);
}

async function getScoreSheet(participantId) {
  const existing = assertSupabase(await client().from('score_sheets')
    .select('*, score_entries(criterion_id, score, note)')
    .eq('participant_id', participantId).eq('judge_id', getState().user.id).maybeSingle());
  if (existing) return mapSheet(existing);
  const ensured = assertSupabase(await client().rpc('ensure_score_sheet', { target_participant_id: participantId }));
  const row = assertSupabase(await client().from('score_sheets')
    .select('*, score_entries(criterion_id, score, note)').eq('id', ensured.id).single());
  return mapSheet(row);
}

async function saveScoreDraft(sheetId, version, scores, reasons, generalNote) {
  const entries = Object.entries(scores)
    .filter(([, score]) => score !== '' && score !== undefined)
    .map(([criterionId, score]) => ({ criterion_id: criterionId, score: Number(score), note: reasons[criterionId] || null }));
  const row = assertSupabase(await client().rpc('save_score_draft', {
    target_sheet_id: sheetId,
    expected_version: version,
    entries,
    general_note: generalNote || null,
  }));
  return mapSheet(row);
}

async function submitScoreSheet(sheetId, version) {
  return mapSheet(assertSupabase(await client().rpc('submit_score_sheet', {
    target_sheet_id: sheetId,
    expected_version: version,
  })));
}

async function unlockScoreSheet(sheetId, reason) {
  return mapSheet(assertSupabase(await client().rpc('unlock_score_sheet', { target_sheet_id: sheetId, reason })));
}

async function waiveScore(participantId, locationId, reason, minutesReference) {
  return mapSheet(assertSupabase(await client().rpc('waive_missing_score', {
    target_participant_id: participantId,
    target_location_id: locationId,
    reason,
    minutes_reference: minutesReference,
  })));
}

async function getMyAssignment() {
  const event = await activeEvent();
  const user = getState().user;
  return assertSupabase(await client().from('judge_assignments')
    .select('*, judging_locations(*)').eq('event_id', event.id).eq('judge_id', user.id).is('revoked_at', null).maybeSingle());
}

async function getJudgingProgress() {
  const [participants, locations, sheets] = await Promise.all([getParticipants(), getLocations(), getScoreSheets()]);
  const locationKey = new Map(locations.map((location) => [location.id,
    location.code === 'START' ? 'start' : location.code === 'FINISH' ? 'finish' : 'gedangmas']));
  return participants.map((participant) => {
    const row = { participantId: participant.id, start: 'not_started', gedangmas: 'not_started', finish: 'not_started' };
    sheets.filter((sheet) => sheet.participantId === participant.id).forEach((sheet) => {
      const key = locationKey.get(sheet.locationId);
      if (key) row[key] = sheet.status;
    });
    return row;
  });
}

async function updateParticipantStatus(participantId, status, note, actualAt) {
  const row = assertSupabase(await client().rpc('update_participant_status', {
    target_participant_id: participantId,
    target_status: status,
    note: note || null,
    actual_at: actualAt || new Date().toISOString(),
  }));
  return mapParticipant(row);
}

async function getStatusLogs(participantId) {
  const query = client().from('participant_status_logs').select('*, profiles!participant_status_logs_recorded_by_fkey(full_name)')
    .order('recorded_at', { ascending: false });
  if (participantId) query.eq('participant_id', participantId);
  return assertSupabase(await query);
}

async function getAttractionPoints() {
  const event = await activeEvent();
  return assertSupabase(await client().from('attraction_points').select('*').eq('event_id', event.id).eq('is_active', true).order('sort_order'));
}

async function getMyAttractionAssignment() {
  const event = await activeEvent();
  return assertSupabase(await client().from('attraction_verifier_assignments')
    .select('*, attraction_points(*)').eq('event_id', event.id).eq('operator_id', getState().user.id).is('revoked_at', null).maybeSingle());
}

async function getAttractionChecks() {
  const [participants, points] = await Promise.all([getParticipants(), getAttractionPoints()]);
  const event = await activeEvent();
  const checks = assertSupabase(await client().from('attraction_checks').select('*').eq('event_id', event.id));
  return participants.map((participant) => ({
    id: participant.id,
    participantId: participant.id,
    points: points.map((point) => checks.find((check) => check.participant_id === participant.id && check.attraction_point_id === point.id)?.status || 'unable_to_verify'),
    pointIds: points.map((point) => point.id),
  }));
}

async function recordAttractionCheck(participantId, pointId, status, note = '') {
  return assertSupabase(await client().rpc('record_attraction_check', {
    target_participant_id: participantId,
    target_point_id: pointId,
    target_status: status,
    note: note || null,
    evidence_path: null,
  }));
}

async function getPenaltyTypes() {
  const event = await activeEvent();
  return assertSupabase(await client().from('penalty_types').select('*').eq('event_id', event.id).eq('is_active', true).order('default_deduction'));
}

async function getPenalties() {
  const event = await activeEvent();
  const rows = assertSupabase(await client().from('penalties')
    .select('*, penalty_types(name, code, requires_approval), profiles!penalties_recorded_by_fkey(full_name), participants(sequence_number, name)')
    .eq('event_id', event.id).order('created_at', { ascending: false }));
  return rows.map((row) => ({
    id: row.id, participantId: row.participant_id, typeId: row.penalty_type_id,
    type: row.penalty_types?.name?.replace('Pelanggaran ', '') || 'Penalti',
    deduction: Number(row.deduction), reason: row.reason, status: row.status,
    actor: row.profiles?.full_name || 'Petugas', occurredAt: row.occurred_at,
    participantName: row.participants?.name || 'Peserta nonaktif',
    participantSequence: row.participants?.sequence_number || 0,
    requiresApproval: Boolean(row.penalty_types?.requires_approval),
  }));
}

async function createPenalty(values) {
  const event = await activeEvent();
  const user = getState().user;
  return assertSupabase(await client().from('penalties').insert({
    event_id: event.id,
    participant_id: values.participantId,
    penalty_type_id: values.penaltyTypeId,
    deduction: Number(values.deduction),
    reason: values.reason.trim(),
    occurred_at: values.occurredAt || new Date().toISOString(),
    status: 'draft',
    recorded_by: user.id,
  }).select().single());
}

async function confirmPenalty(id) {
  return assertSupabase(await client().rpc('confirm_penalty', { target_penalty_id: id }));
}

async function cancelPenalty(id, reason) {
  return assertSupabase(await client().rpc('cancel_penalty', { target_penalty_id: id, reason }));
}

async function getUsers() {
  const event = await activeEvent();
  const [profiles, judgeAssignments, attractionAssignments] = await Promise.all([
    assertSupabase(await client().from('profiles').select('*').order('full_name')),
    assertSupabase(await client().from('judge_assignments').select('judge_id, judging_locations(name)').eq('event_id', event.id).is('revoked_at', null)),
    assertSupabase(await client().from('attraction_verifier_assignments').select('operator_id, attraction_points(name)').eq('event_id', event.id).is('revoked_at', null)),
  ]);
  return profiles.map((profile) => {
    const mapped = mapProfile(profile);
    const judge = judgeAssignments.find((assignment) => assignment.judge_id === profile.id);
    const verifier = attractionAssignments.find((assignment) => assignment.operator_id === profile.id);
    return { ...mapped, email: 'Dikelola melalui Supabase Auth', role: roleLabel(profile.role), roleCode: profile.role,
      assignment: judge?.judging_locations?.name || verifier?.attraction_points?.name || 'Operasional umum' };
  });
}

async function setUserActive(id, isActive) {
  const profile = assertSupabase(await client().from('profiles').select('id, full_name, role').eq('id', id).single());
  return mapProfile(assertSupabase(await client().rpc('manage_profile', {
    target_user_id: profile.id,
    target_full_name: profile.full_name,
    target_role: profile.role,
    target_is_active: isActive,
  })));
}

async function createProfile({ id, fullName, role }) {
  return mapProfile(assertSupabase(await client().rpc('manage_profile', {
    target_user_id: id,
    target_full_name: fullName.trim(),
    target_role: role,
    target_is_active: true,
  })));
}

async function updateProfile({ id, fullName, role, isActive }) {
  const profile = assertSupabase(await client().rpc('manage_profile', {
    target_user_id: id,
    target_full_name: fullName.trim(),
    target_role: role,
    target_is_active: Boolean(isActive),
  }));
  return mapProfile(profile);
}

async function deleteProfile(id) {
  return mapProfile(assertSupabase(await client().rpc('delete_profile', { target_user_id: id })));
}

async function assignJudge(judgeId, locationId) {
  return assertSupabase(await client().rpc('assign_judge_to_location', {
    target_judge_id: judgeId,
    target_location_id: locationId,
  }));
}

async function revokeJudgeAssignment(id) {
  return assertSupabase(await client().rpc('revoke_judge_assignment', { target_assignment_id: id }));
}

async function assignAttractionVerifier(operatorId, pointId) {
  return assertSupabase(await client().rpc('assign_operator_to_attraction', {
    target_operator_id: operatorId,
    target_point_id: pointId,
  }));
}

async function revokeAttractionAssignment(id) {
  return assertSupabase(await client().rpc('revoke_attraction_assignment', { target_assignment_id: id }));
}

async function getAuditLogs() {
  const event = await activeEvent();
  const rows = assertSupabase(await client().from('audit_logs')
    .select('*, profiles!audit_logs_actor_id_fkey(full_name)').or(`event_id.eq.${event.id},event_id.is.null`)
    .order('created_at', { ascending: false }).limit(200));
  return rows.map((row) => ({ id: row.id, time: formatWib(row.created_at), action: auditActionLabel(row.action), actionCode: row.action,
    actor: row.profiles?.full_name || 'Sistem', entity: `${row.entity_type}${row.entity_id ? ` · ${row.entity_id}` : ''}`,
    tone: row.action.includes('CANCEL') || row.action.includes('UNLOCK') ? 'warning' : row.action.includes('PUBLISH') || row.action.includes('SUBMIT') ? 'success' : 'info' }));
}

async function getIncidents() {
  const event = await activeEvent();
  const rows = assertSupabase(await client().from('incidents').select('*').eq('event_id', event.id).order('occurred_at', { ascending: false }));
  return rows.map((row) => ({ id: row.id, participantId: row.participant_id, time: formatWib(row.occurred_at),
    type: row.incident_type, note: row.note, status: row.status === 'handled' ? 'ditangani' : 'baru' }));
}

async function createIncident(values) {
  const event = await activeEvent();
  return assertSupabase(await client().from('incidents').insert({
    event_id: event.id, participant_id: values.participantId, incident_type: values.type,
    note: values.note.trim(), status: 'open', recorded_by: getState().user.id,
    occurred_at: values.occurredAt || new Date().toISOString(),
  }).select().single());
}

async function handleIncident(id) {
  return assertSupabase(await client().from('incidents').update({ status: 'handled', handled_at: new Date().toISOString() }).eq('id', id).select().single());
}

async function getEventSettings() {
  const event = await activeEvent();
  const [locations, criteria, categories, points, penaltyTypes, judgeAssignments, attractionAssignments] = await Promise.all([
    getLocations(), getCriteria(), getCategories(), getAttractionPoints(), getPenaltyTypes(),
    assertSupabase(await client().from('judge_assignments').select(ASSIGNMENT_SELECTS.judge).eq('event_id', event.id).is('revoked_at', null)),
    assertSupabase(await client().from('attraction_verifier_assignments').select(ASSIGNMENT_SELECTS.attraction).eq('event_id', event.id).is('revoked_at', null)),
  ]);
  return { event, locations, criteria, categories, points, penaltyTypes, judgeAssignments, attractionAssignments };
}

async function updateEventSettings(values) {
  const event = await activeEvent();
  const updated = assertSupabase(await client().from('events').update({
    name: values.name.trim(),
    event_date: values.eventDate,
    route_description: values.route.trim(),
    aggregation_method: values.aggregationMethod,
    rounding_scale: Number(values.roundingScale),
    attraction_mode: values.attractionMode,
    attraction_point_value: values.attractionMode === 'fixed_points' ? Number(values.attractionPointValue) : null,
  }).eq('id', event.id).select(EVENT_SELECT).single());
  setState({ activeEvent: updated });
  return updated;
}


async function updateCriteria(criteria) {
  const event = await activeEvent();
  const payload = criteria.map((criterion) => ({
    id: criterion.id, event_id: event.id, code: criterion.code, name: criterion.name,
    description: criterion.hint || '', max_score: Number(criterion.max), sort_order: criterion.sortOrder, is_active: true,
  }));
  return assertSupabase(await client().from('score_criteria').upsert(payload).select());
}

async function transitionEvent(status) {
  const event = await activeEvent();
  const updated = assertSupabase(await client().rpc('transition_event_status', { target_event_id: event.id, target_status: status }));
  setState({ activeEvent: updated });
  return updated;
}

async function previewResults() {
  const event = await activeEvent();
  return assertSupabase(await client().rpc('calculate_event_results', { target_event_id: event.id }));
}

async function getResultSnapshots() {
  const event = await activeEvent();
  return assertSupabase(await client().from('result_snapshots').select('*').eq('event_id', event.id).order('version', { ascending: false }));
}

async function createResultSnapshot() {
  const event = await activeEvent();
  return assertSupabase(await client().rpc('snapshot_event_results', { target_event_id: event.id }));
}

async function publishResultSnapshot(id) {
  return assertSupabase(await client().rpc('publish_result_snapshot', { target_snapshot_id: id }));
}

async function getPublishedResults() {
  const rows = assertSupabase(await client().rpc('get_published_results'));
  return rows[0] || null;
}

async function setCouncilDecision(participantId, priority, minutesReference) {
  return assertSupabase(await client().rpc('set_jury_council_decision', {
    target_participant_id: participantId,
    target_priority: Number(priority),
    target_minutes_reference: minutesReference,
  }));
}

function subscribeOperational(table, eventId, callback) {
  const allowed = new Set(['participants', 'score_sheets', 'attraction_checks', 'events']);
  if (!allowed.has(table)) throw new Error('Tabel Realtime tidak diizinkan.');
  const filter = table === 'events' ? `id=eq.${eventId}` : `event_id=eq.${eventId}`;
  const channel = client().channel(`event:${eventId}:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, callback)
    .subscribe();
  return () => client().removeChannel(channel);
}

export const supabaseAdapter = {
  getActiveEvent: activeEvent,
  getParticipants, getParticipant, getCategories, saveParticipant, archiveParticipant, importParticipants,
  getLocations, updateLocations, getCriteria, getScoreSheets, getScoreSheet, getMyAssignment,
  saveScoreDraft, submitScoreSheet, unlockScoreSheet, waiveScore, getJudgingProgress,
  updateParticipantStatus, getStatusLogs,
  getAttractionPoints, getMyAttractionAssignment, getAttractionChecks, recordAttractionCheck,
  getPenaltyTypes, getPenalties, createPenalty, confirmPenalty, cancelPenalty,
  getUsers, setUserActive, createProfile, updateProfile, deleteProfile, assignJudge, revokeJudgeAssignment,
  assignAttractionVerifier, revokeAttractionAssignment,
  getAuditLogs, getIncidents, createIncident, handleIncident,
  getEventSettings, updateEventSettings, updateCriteria, transitionEvent,
  previewResults, getResultSnapshots, createResultSnapshot, publishResultSnapshot,
  getPublishedResults, setCouncilDecision, subscribeOperational,
};
