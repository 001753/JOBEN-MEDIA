import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTagBySlug, getArticlesByTag, getAllTags } from '@/lib/strapi';
import { ArticleCardHorizontal, ArticleCardGrid } from '@/components/ArticleCard';
import Pagination from '@/components/Pagination';
import { AdLeaderboard, AdRectangle } from '@/components/AdSlot';

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const tag = await getTagBySlug(params.slug);
  if (!tag) return { title: 'Tag Tidak Ditemukan' };
  return {
    title: `#${tag.name} — Berita & Artikel`,
    description: `Kumpulan artikel dan berita bertag "${tag.name}" dari JOBEN NEWS — portal berita teknologi Indonesia.`,
    openGraph: {
      title: `#${tag.name} di JOBEN NEWS`,
      description: `Semua berita dan artikel tentang ${tag.name}.`,
    },
  };
}

export default async function TagPage({ params, searchParams }) {
  const page = Math.max(1, parseInt(searchParams?.halaman ?? '1', 10));

  const [tag, { data: articles, meta }, allTags] = await Promise.all([
    getTagBySlug(params.slug),
    getArticlesByTag(params.slug, page, 20),
    getAllTags(),
  ]);

  if (!tag) notFound();

  const totalPages    = meta?.pagination?.pageCount ?? 1;
  const totalArticles = meta?.pagination?.total ?? 0;

  // Tag lainnya — excludes tag aktif, maksimal 30
  const otherTags = allTags
    .filter((t) => t.slug !== params.slug)
    .slice(0, 30);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 mb-5">
        <Link href="/" className="hover:text-red-600 transition-colors">Beranda</Link>
        <span>/</span>
        <Link href="/tag" className="hover:text-red-600 transition-colors">Semua Tag</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">#{tag.name}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ════ KONTEN UTAMA ════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0">

          {/* ── Header tag ──────────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl md:text-4xl font-black text-gray-900">
                <span className="text-red-600">#</span>{tag.name}
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              {totalArticles > 0
                ? `${totalArticles.toLocaleString('id-ID')} artikel ditemukan`
                : 'Belum ada artikel dengan tag ini'}
              {totalPages > 1 && ` — halaman ${page} dari ${totalPages}`}
            </p>
          </div>

          <AdLeaderboard />

          {/* ── Artikel list ─────────────────────────────────────────────── */}
          {articles.length > 0 ? (
            <>
              {/* Halaman 1: card besar untuk 2 artikel teratas, sisanya horizontal */}
              {page === 1 && articles.length > 0 && (
                <>
                  {/* 2 artikel pertama — grid card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                    {articles.slice(0, 2).map((article) => (
                      <ArticleCardGrid
                        key={article.slug ?? article.id}
                        article={article}
                      />
                    ))}
                  </div>

                  {/* Sisanya — horizontal list */}
                  {articles.length > 2 && (
                    <div className="divide-y divide-gray-100">
                      {articles.slice(2).map((article) => (
                        <div key={article.slug ?? article.id} className="py-4 first:pt-0">
                          <ArticleCardHorizontal article={article} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Halaman 2+: semua horizontal */}
              {page > 1 && (
                <div className="divide-y divide-gray-100">
                  {articles.map((article) => (
                    <div key={article.slug ?? article.id} className="py-4 first:pt-0">
                      <ArticleCardHorizontal article={article} />
                    </div>
                  ))}
                </div>
              )}

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                basePath={`/tag/${params.slug}`}
              />
            </>
          ) : (
            /* ── Empty state ──────────────────────────────────────────────── */
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-5">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <p className="text-gray-500 font-semibold text-lg mb-1">
                Belum ada artikel untuk <span className="text-red-600">#{tag.name}</span>
              </p>
              <p className="text-gray-400 text-sm mb-6">Coba jelajahi tag lain di bawah.</p>
              <Link
                href="/tag"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Lihat Semua Tag →
              </Link>
            </div>
          )}
        </div>

        {/* ════ SIDEBAR ═════════════════════════════════════════════════════ */}
        <aside className="w-full lg:w-[300px] shrink-0 space-y-6">

          {/* Ad */}
          <AdRectangle />

          {/* Tag cloud */}
          {otherTags.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">
                Tag Lainnya
              </h2>
              <div className="flex flex-wrap gap-2">
                {otherTags.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/tag/${t.slug}`}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 text-sm rounded-full transition-colors font-medium"
                  >
                    #{t.name}
                  </Link>
                ))}
              </div>
              <Link
                href="/tag"
                className="block mt-4 text-xs text-center text-red-600 hover:underline font-semibold"
              >
                Lihat semua tag →
              </Link>
            </div>
          )}

          {/* Cari dengan tag ini */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-3">
              Cari Lebih Spesifik
            </h2>
            <Link
              href={`/cari?q=${encodeURIComponent(tag.name)}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors group"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Cari artikel &ldquo;{tag.name}&rdquo;
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
