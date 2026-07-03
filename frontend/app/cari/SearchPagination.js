'use client';

import Link from 'next/link';

/**
 * Pagination khusus search — menyertakan ?q= di setiap URL halaman
 */
export default function SearchPagination({ currentPage, totalPages, q }) {
  if (totalPages <= 1) return null;

  function pageUrl(p) {
    const params = new URLSearchParams({ q });
    if (p > 1) params.set('halaman', String(p));
    return `/cari?${params.toString()}`;
  }

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= delta) {
      pages.push(i);
    }
  }

  const withEllipsis = [];
  let prev;
  for (const p of pages) {
    if (prev && p - prev > 1) withEllipsis.push('…');
    withEllipsis.push(p);
    prev = p;
  }

  return (
    <nav className="flex justify-center items-center gap-1.5 mt-10" aria-label="Halaman hasil pencarian">
      {currentPage > 1 && (
        <Link
          href={pageUrl(currentPage - 1)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors"
        >
          ← Sebelumnya
        </Link>
      )}

      {withEllipsis.map((item, i) =>
        item === '…' ? (
          <span key={`e${i}`} className="px-2 text-gray-400 text-sm select-none">…</span>
        ) : (
          <Link
            key={item}
            href={pageUrl(item)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
              item === currentPage
                ? 'bg-red-600 text-white shadow-sm'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-red-600'
            }`}
          >
            {item}
          </Link>
        )
      )}

      {currentPage < totalPages && (
        <Link
          href={pageUrl(currentPage + 1)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors"
        >
          Berikutnya →
        </Link>
      )}
    </nav>
  );
}
