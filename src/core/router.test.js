import { describe, expect, it } from 'vitest';
import { compilePath } from './router.js';

describe('router SPA', () => {
  it('mencocokkan route dinamis dan membaca nama parameter', () => {
    const route = compilePath('/admin/peserta/:id/edit');
    expect(route.keys).toEqual(['id']);
    expect(route.regex.test('/admin/peserta/p-12/edit')).toBe(true);
  });

  it('mencocokkan route wildcard untuk halaman tidak ditemukan', () => {
    const route = compilePath('*');
    expect(route.regex.test('/alamat-yang-tidak-ada')).toBe(true);
  });
});
