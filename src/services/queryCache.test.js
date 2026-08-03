import { describe, expect, it, vi } from 'vitest';
import { createQueryCache } from './queryCache.js';

describe('query cache', () => {
  it('menggunakan hasil yang sama selama TTL masih berlaku', async () => {
    const loader = vi.fn().mockResolvedValue({ id: 'event-1' });
    const cache = createQueryCache({ ttlMs: 30_000 });

    const first = await cache.query('admin-1:getEvent', loader);
    const second = await cache.query('admin-1:getEvent', loader);

    expect(second).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('mendeduplikasi request bersamaan untuk query yang sama', async () => {
    let resolveLoader;
    const loader = vi.fn(() => new Promise((resolve) => { resolveLoader = resolve; }));
    const cache = createQueryCache({ ttlMs: 30_000 });

    const first = cache.query('admin-1:getUsers', loader);
    const second = cache.query('admin-1:getUsers', loader);
    await Promise.resolve();
    resolveLoader(['Admin']);

    await expect(Promise.all([first, second])).resolves.toEqual([['Admin'], ['Admin']]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('tidak menyimpan query gagal dan dapat diinvalisasi per scope', async () => {
    const cache = createQueryCache({ ttlMs: 30_000 });
    const failedLoader = vi.fn().mockRejectedValueOnce(new Error('gagal')).mockResolvedValueOnce('pulih');

    await expect(cache.query('admin-1:getSettings', failedLoader)).rejects.toThrow('gagal');
    await expect(cache.query('admin-1:getSettings', failedLoader)).resolves.toBe('pulih');

    const otherLoader = vi.fn().mockResolvedValue('juri');
    await cache.query('judge-1:getParticipants', otherLoader);
    cache.invalidate('admin-1:');
    await cache.query('judge-1:getParticipants', otherLoader);

    expect(failedLoader).toHaveBeenCalledTimes(2);
    expect(otherLoader).toHaveBeenCalledTimes(1);
  });

  it('memuat ulang data setelah TTL berakhir', async () => {
    let currentTime = 1_000;
    const loader = vi.fn().mockResolvedValueOnce('lama').mockResolvedValueOnce('baru');
    const cache = createQueryCache({ ttlMs: 100, now: () => currentTime });

    await expect(cache.query('admin-1:getEvent', loader)).resolves.toBe('lama');
    currentTime = 1_101;
    await expect(cache.query('admin-1:getEvent', loader)).resolves.toBe('baru');

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('tidak memasukkan kembali respons lama setelah cache diinvalisasi', async () => {
    let resolveFirst;
    const loader = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce('data-baru');
    const cache = createQueryCache({ ttlMs: 30_000 });

    const pending = cache.query('admin-1:getParticipants', loader);
    await Promise.resolve();
    cache.clear();
    resolveFirst('data-lama');
    await expect(pending).resolves.toBe('data-lama');
    await expect(cache.query('admin-1:getParticipants', loader)).resolves.toBe('data-baru');

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
