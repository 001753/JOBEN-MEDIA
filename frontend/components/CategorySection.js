import Link from 'next/link';
import { ArticleCardGrid, ArticleCardHorizontal } from './ArticleCard';

export default function CategorySection({ category, articles }) {
  if (!articles?.length) return null;

  const [featured, ...rest] = articles;

  return (
    <section className="mb-12">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 bg-brand-700 rounded-full" />
          <h2 className="text-xl font-black text-dark uppercase tracking-tight">
            {category.name}
          </h2>
        </div>
        <Link
          href={`/kategori/${category.slug}`}
          className="text-xs font-bold text-brand-700 hover:text-brand-800 uppercase tracking-wide flex items-center gap-1 transition-colors"
        >
          Lihat Semua
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Layout: featured left + mini list right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Featured article */}
        <div className="lg:col-span-3">
          <ArticleCardGrid article={featured} />
        </div>

        {/* Side list */}
        {rest.length > 0 && (
          <div className="lg:col-span-2 flex flex-col divide-y divide-gray-100">
            {rest.slice(0, 4).map((article) => (
              <div key={article.slug ?? article.id} className="py-3 first:pt-0 last:pb-0">
                <ArticleCardHorizontal article={article} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
