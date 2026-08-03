function countDelimiter(line, delimiter) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (line[index] === delimiter && !quoted) count += 1;
  }
  return count;
}

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value.trim()); value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim()); value = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error('Format CSV tidak valid: tanda kutip belum ditutup.');
  return rows;
}

function normalizedHeader(value) {
  return value.toLowerCase().trim().replaceAll(/[-\s]+/g, '_');
}

export function parseParticipantCsv(source) {
  const text = String(source || '').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = countDelimiter(firstLine, ';') > countDelimiter(firstLine, ',') ? ';' : ',';
  const parsed = parseRows(text, delimiter);
  if (parsed.length < 2) throw new Error('CSV harus memiliki header dan minimal satu baris peserta.');
  const headers = parsed[0].map(normalizedHeader);
  const required = ['nomor_urut', 'nama', 'kategori', 'jumlah_anggota'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Kolom wajib CSV belum lengkap: ${missing.join(', ')}.`);
  const valueAt = (row, key) => row[headers.indexOf(key)] || '';
  return parsed.slice(1).map((row) => ({
    sequenceNumber: Number(valueAt(row, 'nomor_urut')),
    name: valueAt(row, 'nama'),
    category: valueAt(row, 'kategori'),
    memberCount: Number(valueAt(row, 'jumlah_anggota')),
    theme: valueAt(row, 'tema'),
    coordinator: valueAt(row, 'koordinator'),
    phone: valueAt(row, 'kontak'),
    exceptionReason: valueAt(row, 'alasan_pengecualian'),
    scheduledTime: valueAt(row, 'jadwal_berangkat'),
  }));
}
