'use strict';

/**
 * Bagi array blok konten Strapi menjadi halaman (array of arrays).
 *
 * Aturan:
 * - Setiap heading h2 (level 2) yang BUKAN di posisi 0 memulai halaman baru.
 * - Jika tidak ada h2 → paksa bagi 2 halaman (split di titik tengah).
 * - Minimum 2 halaman, maksimum 5 halaman.
 * - Jika > 5 halaman → merge pasangan adjacent dengan total blok terkecil.
 *
 * @param {Array} content — article.content dari Strapi (Blocks array)
 * @returns {Array[]} array of page content arrays
 */
export function splitContentIntoPages(content) {
  if (!Array.isArray(content) || content.length === 0) return [[]];

  // Cari posisi semua h2 heading kecuali posisi 0
  const splitPoints = [];
  for (let i = 1; i < content.length; i++) {
    if (content[i].type === 'heading' && content[i].level === 2) {
      splitPoints.push(i);
    }
  }

  // Tidak ada h2 → paksa split dua halaman di titik tengah
  if (splitPoints.length === 0) {
    const mid = Math.ceil(content.length / 2);
    const half2 = content.slice(mid);
    return half2.length > 0
      ? [content.slice(0, mid), half2]
      : [content];
  }

  // Buat slice per segmen antar split points
  const boundaries = [0, ...splitPoints, content.length];
  let pages = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const slice = content.slice(boundaries[i], boundaries[i + 1]);
    if (slice.length > 0) pages.push(slice);
  }

  // Pastikan minimum 2 halaman
  if (pages.length < 2) {
    const all = pages[0] ?? [];
    const mid = Math.ceil(all.length / 2);
    const half2 = all.slice(mid);
    return half2.length > 0 ? [all.slice(0, mid), half2] : [all];
  }

  // Batasi maksimum 5 halaman dengan merge pasangan terkecil
  while (pages.length > 5) {
    let minIdx = 0;
    let minLen = Infinity;
    for (let i = 0; i < pages.length - 1; i++) {
      const len = pages[i].length + pages[i + 1].length;
      if (len < minLen) { minLen = len; minIdx = i; }
    }
    pages.splice(minIdx, 2, [...pages[minIdx], ...pages[minIdx + 1]]);
  }

  return pages;
}

/**
 * Hitung nomor halaman yang valid berdasarkan query param.
 * Selalu kembalikan angka 1..totalPages.
 *
 * @param {string|undefined} param — nilai searchParams.halaman
 * @param {number} totalPages
 * @returns {number}
 */
export function resolvePageNumber(param, totalPages) {
  const n = parseInt(param ?? '1', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > totalPages) return totalPages;
  return n;
}
