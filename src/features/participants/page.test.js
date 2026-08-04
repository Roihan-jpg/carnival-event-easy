import { describe, expect, it } from 'vitest';
import { renderCategoryOptions } from './page.js';

describe('renderCategoryOptions', () => {
  it('menampilkan seluruh kategori peserta dari database', () => {
    const html = renderCategoryOptions([
      { name: 'Pendidikan' },
      { name: 'Umum' },
      { name: 'Pemdes' },
    ], 'Pemdes');

    expect(html).toContain('value="Pemdes"');
    expect(html).toContain('value="Pemdes" selected');
  });
});
