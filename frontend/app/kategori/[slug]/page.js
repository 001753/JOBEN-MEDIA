import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryBySlug, getArticlesByCategory } from '@/lib/strapi';
import { ArticleCardGrid } from '@/components/ArticleCard';
import Pagination from '@/components/Pagination';
import { AdLeaderboard } from '@/components/AdSlot';

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: 'Kategori Tidak Ditemukan' };
  const parentName = category.parent?.name ? ` — ${category.parent.name}` : '';
  return {
    title: `${category.name}${parentName} — Berita Terkini`,
    description: category.description ?? `Kumpulan berita terkini seputar ${category.name} dari JOBEN NEWS.`,
  };
}

export default async function CategoryPage({ params, searchParams }) {
  const page = Math.max(1, parseInt(searchParams?.halaman ?? '1', 10));

  const [category, { data: articles, meta }] = await Promise.all([
    getCategoryBySlug(params.slug),
    getArticlesByCategory(params.slug, page, 12),
  ]);

  if (!category) notFound();

  const totalPages    = meta?.pagination?.pageCount ?? 1;
  const totalArticles = meta?.pagination?.total ?? 0;
  const hasChildren   = category.children?.length > 0;
  const hasParent     = !!category.parent;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      {hasParent && (
        <nav className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text-faint)' }}>
          <Link href="/" className="hover:text-brand-700 transition-colors">Beranda</Link>
          <span>/</span>
          <Link href={`/kategori/${category.parent.slug}`} className="hover:text-brand-700 transition-colors">
            {category.parent.name}
          </Link>
          <span>/</span>
          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{category.name}</span>
        </nav>
      )}

      {/* ── Header kategori ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="section-accent-bar" />
          <h1 className="text-3xl md:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>
            {category.name}
          </h1>
        </div>
        {category.description && (
          <p className="text-base mt-2 ml-5" style={{ color: 'var(--text-muted)' }}>
            {category.description}
          </p>
        )}
        <p className="text-sm mt-1 ml-5" style={{ color: 'var(--text-faint)' }}>
          {totalArticles} artikel
        </p>
      </div>

      {/* ── Pill subkategori ─────────────────────────────────────────────── */}
      {hasChildren && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/kategori/${category.slug}`}
            className="px-3 py-1.5 rounded-full text-sm font-semibold bg-brand-700 text-white transition-colors"
          >
            Semua
          </Link>
          {category.children.map((sub) => (
            <Link
              key={sub.slug}
              href={`/kategori/${sub.slug}`}
              className="cat-pill"
            >
              {sub.name}
            </Link>
          ))}
        </div>
      )}

      <AdLeaderboard />

      {/* ── Grid artikel ─────────────────────────────────────────────────── */}
      {articles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-6">
            {articles.map((article) => (
              <ArticleCardGrid key={article.slug ?? article.id} article={article} />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath={`/kategori/${params.slug}`}
          />
        </>
      ) : (
        <div className="py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ background: 'var(--bg-sub-nav)', border: '1px solid var(--border)' }}>
            <svg className="w-7 h-7" style={{ color: 'var(--text-faint)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <p className="text-lg" style={{ color: 'var(--text-faint)' }}>Belum ada artikel di kategori ini.</p>
          {hasParent && (
            <Link
              href={`/kategori/${category.parent.slug}`}
              className="mt-4 inline-block text-sm text-brand-700 hover:underline"
            >
              ← Lihat semua {category.parent.name}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
