import Image from 'next/image';
import Link from 'next/link';
import { getImageUrl, formatDateShort } from '@/lib/strapi';

const CATEGORY_COLORS = {
  nasional: 'bg-blue-600',
  internasional: 'bg-indigo-600',
  ekonomi: 'bg-emerald-600',
  olahraga: 'bg-orange-600',
  teknologi: 'bg-violet-600',
  hiburan: 'bg-pink-600',
  gaya_hidup: 'bg-teal-600',
  otomotif: 'bg-amber-600',
};

function getCategoryColor(slug) {
  return CATEGORY_COLORS[slug?.toLowerCase()?.replace(/-/g, '_')] ?? 'bg-brand-700';
}

export function ArticleCardHero({ article }) {
  if (!article) return null;
  const img    = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link href={`/artikel/${article.slug}`} className="group block h-full">
      <article className="relative h-full min-h-[400px] md:min-h-[480px] rounded-xl overflow-hidden bg-gray-900 card-shadow">
        {img ? (
          <Image
            src={img}
            alt={article.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 65vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
          {catName && (
            <span className={`category-badge text-white mb-3 ${getCategoryColor(catSlug)}`}>
              {catName}
            </span>
          )}
          <h2 className="text-white font-bold text-xl md:text-2xl lg:text-3xl leading-tight mb-3 group-hover:text-brand-200 transition-colors line-clamp-3">
            {article.title}
          </h2>
          {article.excerpt && (
            <p className="text-gray-300 text-sm leading-relaxed line-clamp-2 mb-3 hidden md:block">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            {article.author?.name && (
              <span className="font-medium text-gray-300">{article.author.name}</span>
            )}
            {article.author?.name && <span>·</span>}
            <time dateTime={article.publishedAt}>{formatDateShort(article.publishedAt)}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function ArticleCardCompact({ article, rank }) {
  if (!article) return null;
  const img    = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link href={`/artikel/${article.slug}`} className="group flex gap-3 items-start py-3 border-b border-gray-100 last:border-0">
      {rank !== undefined && (
        <span className="text-3xl font-black text-gray-100 leading-none w-8 shrink-0 mt-0.5">
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <div className="flex-1 min-w-0">
        {catName && (
          <span className={`category-badge text-white text-[10px] mb-1 ${getCategoryColor(catSlug)}`}>
            {catName}
          </span>
        )}
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-3 group-hover:text-brand-700 transition-colors leading-snug">
          {article.title}
        </h3>
        <time className="text-xs text-gray-400 mt-1 block" dateTime={article.publishedAt}>
          {formatDateShort(article.publishedAt)}
        </time>
      </div>
      {img && (
        <div className="relative w-20 h-16 shrink-0 rounded overflow-hidden">
          <Image src={img} alt={article.title} fill sizes="80px" className="object-cover" />
        </div>
      )}
    </Link>
  );
}

export function ArticleCardGrid({ article }) {
  if (!article) return null;
  const img    = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link href={`/artikel/${article.slug}`} className="group block">
      <article className="bg-white rounded-xl overflow-hidden card-shadow h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-[16/9] bg-gray-100 shrink-0">
          {img ? (
            <Image
              src={img}
              alt={article.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {catName && (
            <span className={`absolute top-3 left-3 category-badge text-white text-[10px] ${getCategoryColor(catSlug)}`}>
              {catName}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-3 group-hover:text-brand-700 transition-colors mb-2 flex-1">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-gray-500 text-sm line-clamp-2 mb-3 hidden sm:block">{article.excerpt}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto">
            {article.author?.name && <span className="font-medium text-gray-600">{article.author.name}</span>}
            {article.author?.name && <span>·</span>}
            <time dateTime={article.publishedAt}>{formatDateShort(article.publishedAt)}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function ArticleCardHorizontal({ article }) {
  if (!article) return null;
  const img    = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link href={`/artikel/${article.slug}`} className="group flex gap-4 items-start">
      <article className="flex gap-4 items-start w-full">
        <div className="relative w-28 h-20 md:w-36 md:h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
          {img ? (
            <Image src={img} alt={article.title} fill sizes="144px" className="object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="absolute inset-0 bg-gray-200" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {catName && (
            <span className={`category-badge text-white text-[10px] mb-1.5 ${getCategoryColor(catSlug)}`}>
              {catName}
            </span>
          )}
          <h3 className="font-bold text-gray-900 text-sm md:text-base leading-snug line-clamp-3 group-hover:text-brand-700 transition-colors">
            {article.title}
          </h3>
          <time className="text-xs text-gray-400 mt-1.5 block" dateTime={article.publishedAt}>
            {formatDateShort(article.publishedAt)}
          </time>
        </div>
      </article>
    </Link>
  );
}
