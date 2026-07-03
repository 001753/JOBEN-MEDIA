import { Suspense } from 'react';
import { searchArticles } from '@/lib/strapi';
import { ArticleCardHorizontal } from '@/components/ArticleCard';
import SearchInput from './SearchInput';
import SearchPagination from './SearchPagination';
import { AdLeaderboard } from '@/components/AdSlot';

export const dynamic   = 'force-dynamic'; // selalu fresh, tidak di-cache
export const revalidate = 0;

export async function generateMetadata({ searchParams }) {
  const q = (searchParams?.q ?? '').trim();
  return {
    title: q ? `"${q}" — Pencarian JOBEN NEWS` : 'Cari Berita — JOBEN NEWS',
    description: q ? `Hasil pencarian untuk "${q}" di JOBEN NEWS.` : 'Cari berita terkini di JOBEN NEWS.',
    robots: { index: false, follow: false },
  };
}

/* ─── Komponen hasil pencarian (server, streaming) ──────────────────────── */
async function SearchResults({ q, page }) {
  if (!q || q.length < 2) return null;

  const { data: articles, meta } = await searchArticles(q, page, 20);
  const totalArticles = meta?.pagination?.total ?? 0;
  const totalPages    = meta?.pagination?.pageCount ?? 1;

  if (articles.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-5">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-gray-700 text-xl font-bold mb-2">Tidak ada hasil untuk &ldquo;{q}&rdquo;</p>
        <p className="text-gray-400 text-sm">Coba kata kunci lain atau cek ejaan.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {['AI', 'Bitcoin', 'Startup', 'iPhone', 'ChatGPT'].map((sug) => (
            <a
              key={sug}
              href={`/cari?q=${encodeURIComponent(sug)}`}
              className="px-4 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-full text-sm font-medium transition-colors"
            >
              {sug}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-gray-500 mb-5">
        Menampilkan <span className="font-semibold text-gray-800">{totalArticles.toLocaleString('id-ID')}</span> artikel
        {totalPages > 1 && ` — halaman ${page} dari ${totalPages}`}
      </p>

      <div className="divide-y divide-gray-100">
        {articles.map((article) => (
          <div key={article.slug ?? article.id} className="py-4 first:pt-0">
            <ArticleCardHorizontal article={article} />
          </div>
        ))}
      </div>

      <SearchPagination currentPage={page} totalPages={totalPages} q={q} />
    </>
  );
}

/* ─── Skeleton hasil (saat streaming) ───────────────────────────────────── */
function ResultsSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="py-4 flex gap-4 items-start">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-4/5 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="w-36 h-24 bg-gray-200 rounded-lg animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ─── Page utama ─────────────────────────────────────────────────────────── */
export default async function SearchPage({ searchParams }) {
  const q    = (searchParams?.q ?? '').trim();
  const page = Math.max(1, parseInt(searchParams?.halaman ?? '1', 10));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-7 bg-red-600 rounded-full" />
          <h1 className="text-2xl font-black text-gray-900">
            {q ? (
              <>Hasil pencarian: <span className="text-red-600">&ldquo;{q}&rdquo;</span></>
            ) : (
              'Cari Berita'
            )}
          </h1>
        </div>
        <p className="text-gray-400 text-sm ml-4">
          {q ? 'Pencarian di seluruh artikel JOBEN NEWS' : 'Temukan berita dari ribuan artikel kami'}
        </p>
      </div>

      {/* ── Search input (Client Component, live debounce) ───────────────── */}
      <Suspense fallback={
        <div className="flex gap-3 max-w-2xl mb-8">
          <div className="flex-1 h-12 bg-gray-100 rounded-xl animate-pulse" />
          <div className="w-24 h-12 bg-red-100 rounded-xl animate-pulse" />
        </div>
      }>
        <SearchInput defaultValue={q} />
      </Suspense>

      <AdLeaderboard />

      {/* ── Empty state saat belum ada query ────────────────────────────── */}
      {(!q || q.length < 2) && (
        <div className="py-20 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 rounded-full mb-5">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-base mb-1">Ketik kata kunci untuk mulai mencari</p>
          <p className="text-gray-400 text-sm">Pencarian berjalan otomatis setelah 0.5 detik</p>
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Trending pencarian</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['ChatGPT', 'AI', 'Bitcoin', 'NVIDIA', 'Startup Indonesia', 'iPhone', 'Cybersecurity', 'OpenAI'].map((sug) => (
                <a
                  key={sug}
                  href={`/cari?q=${encodeURIComponent(sug)}`}
                  className="px-4 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-full text-sm font-medium transition-colors"
                >
                  {sug}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Hasil pencarian — streaming via Suspense ─────────────────────── */}
      {q.length >= 2 && (
        <Suspense fallback={<ResultsSkeleton />}>
          <SearchResults q={q} page={page} />
        </Suspense>
      )}
    </div>
  );
}
