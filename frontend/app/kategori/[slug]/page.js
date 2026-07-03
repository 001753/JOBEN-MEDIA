import { notFound } from 'next/navigation';
import { getCategoryBySlug, getArticlesByCategory } from '@/lib/strapi';
import { ArticleCardGrid } from '@/components/ArticleCard';
import Pagination from '@/components/Pagination';
import { AdLeaderboard } from '@/components/AdSlot';

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: 'Kategori Tidak Ditemukan' };
  return {
    title: `${category.name} — Berita Terkini`,
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

  const totalPages   = meta?.pagination?.pageCount ?? 1;
  const totalArticles = meta?.pagination?.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1.5 h-8 bg-brand-700 rounded-full" />
          <h1 className="text-3xl md:text-4xl font-black text-dark">{category.name}</h1>
        </div>
        {category.description && (
          <p className="text-gray-500 text-base mt-2 ml-5">{category.description}</p>
        )}
        <p className="text-sm text-gray-400 mt-2 ml-5">{totalArticles} artikel</p>
      </div>

      <AdLeaderboard />

      {/* Grid */}
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
          <p className="text-gray-400 text-lg">Belum ada artikel di kategori ini.</p>
        </div>
      )}
    </div>
  );
}
