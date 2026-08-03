export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function participantById(participants, id) {
  return participants.find((participant) => participant.id === id);
}
