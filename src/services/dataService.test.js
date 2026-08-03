import { describe, expect, it, vi } from 'vitest';
import { createDataService } from './dataService.js';

describe('data service dengan query caching', () => {
  it('meng-cache seluruh method baca dan menginvalidasi cache setelah mutasi', async () => {
    const adapter = {
      getUsers: vi.fn().mockResolvedValue(['Admin']),
      getEventSettings: vi.fn().mockResolvedValue({ event: { id: 'event-1' } }),
      saveParticipant: vi.fn().mockResolvedValue({ id: 'participant-1' }),
    };
    const service = createDataService(adapter, { getScope: () => 'admin-1', ttlMs: 30_000 });

    await service.getUsers();
    await service.getUsers();
    await service.getEventSettings();
    await service.getEventSettings();

    expect(adapter.getUsers).toHaveBeenCalledTimes(1);
    expect(adapter.getEventSettings).toHaveBeenCalledTimes(1);

    await service.saveParticipant({ name: 'Peserta' });
    await service.getUsers();
    await service.getEventSettings();

    expect(adapter.getUsers).toHaveBeenCalledTimes(2);
    expect(adapter.getEventSettings).toHaveBeenCalledTimes(2);
  });

  it('memisahkan cache berdasarkan pengguna aktif', async () => {
    let scope = 'admin-1';
    const adapter = { getUsers: vi.fn().mockResolvedValue(['Pengguna']) };
    const service = createDataService(adapter, { getScope: () => scope, ttlMs: 30_000 });

    await service.getUsers();
    scope = 'admin-2';
    await service.getUsers();

    expect(adapter.getUsers).toHaveBeenCalledTimes(2);
  });
});
