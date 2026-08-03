import { describe, expect, it } from 'vitest';
import { parseParticipantCsv } from './csv.js';

describe('parseParticipantCsv', () => {
  it('membaca kolom peserta dan nilai dalam tanda kutip', () => {
    const rows = parseParticipantCsv('nomor_urut,nama,kategori,jumlah_anggota,tema\n21,"Sanggar, Maju",Umum,35,"Bumi, Air"');
    expect(rows).toEqual([{ sequenceNumber: 21, name: 'Sanggar, Maju', category: 'Umum', memberCount: 35, theme: 'Bumi, Air', coordinator: '', phone: '', exceptionReason: '', scheduledTime: '' }]);
  });

  it('mendukung delimiter titik koma dan BOM', () => {
    const rows = parseParticipantCsv('\uFEFFnomor_urut;nama;kategori;jumlah_anggota\r\n22;SDN 1;Pendidikan;40');
    expect(rows[0]).toMatchObject({ sequenceNumber: 22, name: 'SDN 1', category: 'Pendidikan', memberCount: 40 });
  });

  it('menolak header wajib yang tidak tersedia', () => {
    expect(() => parseParticipantCsv('nama,kategori\nTim A,Umum')).toThrow('Kolom wajib CSV');
  });
});
