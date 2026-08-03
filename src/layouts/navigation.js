export const NAVIGATION = {
  admin: [
    { label: 'Ringkasan', path: '/admin/dashboard', icon: 'LayoutDashboard' },
    { label: 'Peserta', path: '/admin/peserta', icon: 'Users' },
    { label: 'Jadwal & Status', path: '/admin/jadwal', icon: 'CalendarDays' },
    { label: 'Penjurian', path: '/admin/penjurian', icon: 'ClipboardCheck' },
    { label: 'Atraksi Wajib', path: '/admin/atraksi', icon: 'Sparkles' },
    { label: 'Penalti', path: '/admin/penalti', icon: 'Gavel' },
    { label: 'Hasil', path: '/admin/hasil', icon: 'Trophy' },
    { label: 'Pengguna', path: '/admin/pengguna', icon: 'UserCog' },
    { label: 'Pengaturan Event', path: '/admin/pengaturan', icon: 'Settings' },
    { label: 'Audit Log', path: '/admin/audit', icon: 'History' },
  ],
  judge: [
    { label: 'Penilaian', path: '/juri/penilaian', icon: 'ClipboardCheck' },
    { label: 'Riwayat Nilai Saya', path: '/juri/riwayat', icon: 'History' },
    { label: 'Panduan', path: '/juri/panduan', icon: 'BookOpen' },
  ],
  operator: [
    { label: 'Monitor Peserta', path: '/operator/monitor', icon: 'Radio' },
    { label: 'Atraksi Wajib', path: '/operator/atraksi', icon: 'Sparkles' },
    { label: 'Insiden', path: '/operator/insiden', icon: 'AlertTriangle' },
  ],
};
