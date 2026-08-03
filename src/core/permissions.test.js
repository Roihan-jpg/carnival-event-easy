import { describe, expect, it } from 'vitest';
import { canAccess, defaultRoute } from './permissions.js';

describe('izin route per role', () => {
  it('mengarahkan Admin dan Super Admin ke dashboard yang sama', () => {
    expect(defaultRoute('admin')).toBe('/admin/dashboard');
    expect(defaultRoute('super_admin')).toBe('/admin/dashboard');
  });

  it('menolak role yang tidak termasuk daftar izin', () => {
    expect(canAccess('judge', ['admin', 'super_admin'])).toBe(false);
    expect(canAccess('super_admin', ['admin', 'super_admin'])).toBe(true);
  });

  it('mengarahkan Viewer hanya ke hasil publik', () => {
    expect(defaultRoute('viewer')).toBe('/hasil');
  });
});
