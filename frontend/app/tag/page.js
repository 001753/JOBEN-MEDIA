import Link from 'next/link';
import { getAllTags } from '@/lib/strapi';

export const revalidate = 300;

export const metadata = {
  title: 'Semua Tag — JOBEN NEWS',
  description: 'Jelajahi semua tag topik di JOBEN NEWS — portal berita teknologi Indonesia.',
  robots: { index: true, follow: true },
};

/* Kelompokkan tag berdasarkan huruf awal */
function groupByInitial(tags) {
  const map = {};
  for (const tag of tags) {
    const initial = tag.name[0].toUpperCase();
    const key = /^[A-Z]$/.test(initial) ? initial : '#';
    if (!map[key]) map[key] = [];
    map[key].push(tag);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export default async function AllTagsPage() {
  const tags = await getAllTags();
  const grouped = groupByInitial(tags);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <Link href="/" className="hover:text-red-600 transition-colors">Beranda</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Semua Tag</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-red-600 rounded-full" />
          <h1 className="text-3xl font-black text-gray-900">Semua Tag</h1>
        </div>
        <p className="text-gray-400 text-sm mt-1 ml-4">
          {tags.length} tag tersedia — klik untuk melihat artikel terkait
        </p>
      </div>

      {/* ── Alphabet jump links ──────────────────────────────────────────── */}
      {grouped.length > 4 && (
        <div className="flex flex-wrap gap-1.5 mb-8 p-4 bg-gray-50 rounded-xl">
          {grouped.map(([letter]) => (
            <a
              key={letter}
              href={`#group-${letter}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-gray-500 hover:bg-red-600 hover:text-white transition-colors"
            >
              {letter}
            </a>
          ))}
        </div>
      )}

      {tags.length === 0 ? (
        <div className="py-20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-5">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <p className="text-gray-400">Belum ada tag tersedia.</p>
        </div>
      ) : (
        /* ── Tag dikelompokkan per huruf ─────────────────────────────────── */
        <div className="space-y-10">
          {grouped.map(([letter, groupTags]) => (
            <div key={letter} id={`group-${letter}`}>
              {/* Huruf awal */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-black text-red-600 w-8 shrink-0">{letter}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Tag pills */}
              <div className="flex flex-wrap gap-2 ml-11">
                {groupTags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/tag/${tag.slug}`}
                    className="group flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-full text-sm font-medium text-gray-700 hover:text-red-600 transition-all shadow-sm"
                  >
                    <span className="text-gray-400 group-hover:text-red-500 transition-colors">#</span>
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CTA bawah ─────────────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="text-gray-400 text-sm mb-4">Tidak menemukan topik yang dicari?</p>
          <Link
            href="/cari"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Cari Berita
          </Link>
        </div>
      )}
    </div>
  );
}
