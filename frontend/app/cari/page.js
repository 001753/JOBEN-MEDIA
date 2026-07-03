import { searchArticles } from '@/lib/strapi';
import { ArticleCardGrid } from '@/components/ArticleCard';
import Pagination from '@/components/Pagination';
import { AdLeaderboard } from '@/components/AdSlot';

export const revalidate = 0;

export async function generateMetadata({ searchParams }) {
  const q = searchParams?.q ?? '';
  return {
    title: q ? `Hasil pencarian: "${q}"` : 'Pencarian — JOBEN NEWS',
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }) {
  const q    = (searchParams?.q ?? '').trim();
  const page = Math.max(1, parseInt(searchParams?.halaman ?? '1', 10));

  let result = { data: [], meta: { pagination: { total: 0, pageCount: 0 } } };

  if (q.length >= 2) {
    result = await searchArticles(q, page, 12);
  }

  const { data: articles, meta } = result;
  const totalPages    = meta?.pagination?.pageCount ?? 1;
  const totalArticles = meta?.pagination?.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1.5 h-8 bg-brand-700 rounded-full" />
          <h1 className="text-2xl md:text-3xl font-black text-dark">
            {q ? `Pencarian: "${q}"` : 'Cari Berita'}
          </h1>
        </div>
        {q && (
          <p className="text-gray-400 text-sm ml-5">
            {totalArticles > 0
              ? `Ditemukan ${totalArticles} artikel`
              : 'Tidak ada artikel yang cocok'}
          </p>
        )}
      </div>

      {/* Search form */}
      <SearchForm defaultValue={q} />

      <AdLeaderboard />

      {/* Results */}
      {q.length < 2 && (
        <div className="py-16 text-center">
          <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-400">Masukkan kata kunci untuk mencari berita.</p>
        </div>
      )}

      {q.length >= 2 && articles.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-gray-500 text-lg font-semibold mb-2">Tidak ada hasil untuk &quot;{q}&quot;</p>
          <p className="text-gray-400 text-sm">Coba kata kunci lain atau cek ejaan Anda.</p>
        </div>
      )}

      {articles.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-6">
            {articles.map((article) => (
              <ArticleCardGrid key={article.slug ?? article.id} article={article} />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/cari"
          />
        </>
      )}
    </div>
  );
}

function SearchForm({ defaultValue }) {
  return (
    <form method="GET" action="/cari" className="mb-8">
      <div className="flex gap-3 max-w-xl">
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Ketik kata kunci..."
          className="flex-1 border border-gray-300 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
          autoFocus={!defaultValue}
          minLength={2}
        />
        <button
          type="submit"
          className="btn-primary rounded-xl flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Cari
        </button>
      </div>
    </form>
  );
}
