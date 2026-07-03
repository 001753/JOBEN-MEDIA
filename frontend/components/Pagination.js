import Link from 'next/link';

export default function Pagination({ currentPage, totalPages, basePath }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  const left  = currentPage - delta;
  const right = currentPage + delta + 1;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i < right)) {
      pages.push(i);
    }
  }

  const withEllipsis = [];
  let prev;
  for (const page of pages) {
    if (prev && page - prev > 1) withEllipsis.push('...');
    withEllipsis.push(page);
    prev = page;
  }

  function pageUrl(p) {
    return p === 1 ? basePath : `${basePath}?halaman=${p}`;
  }

  return (
    <nav className="flex justify-center items-center gap-1.5 mt-10" aria-label="Navigasi halaman">
      {/* Prev */}
      {currentPage > 1 && (
        <Link
          href={pageUrl(currentPage - 1)}
          className="px-3 py-2 rounded border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-700 transition-colors"
        >
          ← Sebelumnya
        </Link>
      )}

      {/* Pages */}
      {withEllipsis.map((item, i) =>
        item === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-2 text-gray-400 text-sm">…</span>
        ) : (
          <Link
            key={item}
            href={pageUrl(item)}
            className={`w-9 h-9 flex items-center justify-center rounded text-sm font-semibold transition-colors ${
              item === currentPage
                ? 'bg-brand-700 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-brand-700'
            }`}
          >
            {item}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages && (
        <Link
          href={pageUrl(currentPage + 1)}
          className="px-3 py-2 rounded border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-700 transition-colors"
        >
          Berikutnya →
        </Link>
      )}
    </nav>
  );
}
