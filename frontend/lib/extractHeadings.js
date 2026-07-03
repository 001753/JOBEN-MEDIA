'use strict';

/**
 * Ubah teks heading menjadi slug yang aman untuk dijadikan HTML id.
 * Algoritma ini HARUS identik dengan yang ada di BlocksRenderer.js.
 */
export function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // hapus diakritik (é→e, dll)
      .replace(/[^a-z0-9\s-]/g, '')      // hanya huruf, angka, spasi, strip
      .trim()
      .replace(/\s+/g, '-')              // spasi → dash
      .replace(/-+/g, '-')              // collapse multiple dash
    || 'heading'
  );
}

/**
 * Ekstrak daftar heading (h2 & h3) dari blok konten Strapi.
 * Dipanggil di server — output dipakai untuk render TOC dan generate heading id.
 *
 * @param {Array} blocks — article.content dari Strapi
 * @returns {{ id: string, text: string, level: number }[]}
 */
export function extractHeadings(blocks) {
  if (!Array.isArray(blocks)) return [];

  const slugCount = {};

  return blocks
    .filter((b) => b.type === 'heading' && (b.level === 2 || b.level === 3))
    .map((b) => {
      // Gabungkan semua teks dari children blok
      const text = (b.children ?? [])
        .map((c) => c.text ?? '')
        .join('')
        .trim();

      let base = slugify(text);

      // Handle duplicate slugs
      slugCount[base] = (slugCount[base] ?? 0) + 1;
      const id = slugCount[base] > 1 ? `${base}-${slugCount[base]}` : base;

      return { id, text, level: b.level };
    });
}
