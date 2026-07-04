import Image from 'next/image';
import Link from 'next/link';
import { getImageUrl, formatDateShort } from '@/lib/strapi';

const CATEGORY_COLORS = {
  nasional:      'bg-blue-600',
  internasional: 'bg-indigo-600',
  ekonomi:       'bg-emerald-600',
  olahraga:      'bg-orange-600',
  teknologi:     'bg-violet-600',
  hiburan:       'bg-pink-600',
  gaya_hidup:    'bg-teal-600',
  otomotif:      'bg-amber-600',
};

function getCategoryColor(slug) {
  return CATEGORY_COLORS[slug?.toLowerCase()?.replace(/-/g, '_')] ?? 'bg-brand-700';
}

/* ═══════════════════════════════════════════════════════════════════
   HERO CARD — full-bleed dengan glassmorphism overlay + scan line
═══════════════════════════════════════════════════════════════════ */
export function ArticleCardHero({ article }) {
  if (!article) return null;
  const img     = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link href={`/artikel/${article.slug}`} className="group block h-full">
      <article className="relative h-full min-h-[400px] md:min-h-[480px] rounded-2xl overflow-hidden bg-slate-900 hero-scan"
        style={{ boxShadow: '0 0 0 1px rgba(56,189,248,0.15), 0 24px 48px rgba(0,0,0,0.5)' }}>
        {img ? (
          <Image
            src={img}
            alt={article.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 65vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg,#0c1a2e 0%,#0f172a 50%,#1e293b 100%)' }} />
        )}

        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(2,8,23,0.97) 0%, rgba(2,8,23,0.55) 45%, rgba(2,8,23,0.15) 100%)' }} />
        {/* Cyan side glow */}
        <div className="absolute bottom-0 left-0 w-1/2 h-1/3 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at bottom left, rgba(6,182,212,0.12) 0%, transparent 70%)' }} />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
          {catName && (
            <span className={`category-badge text-white mb-3 ${getCategoryColor(catSlug)}`}
              style={{ boxShadow: '0 0 12px rgba(6,182,212,0.3)' }}>
              {catName}
            </span>
          )}
          <h2 className="text-white font-bold text-xl md:text-2xl lg:text-3xl leading-tight mb-3
            group-hover:text-cyan-300 transition-colors duration-300 line-clamp-3">
            {article.title}
          </h2>
          {article.excerpt && (
            <p className="text-slate-400 text-sm leading-relaxed line-clamp-2 mb-3 hidden md:block">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs" style={{ color: '#64748b' }}>
            {article.author?.name && (
              <span className="font-medium text-slate-400">{article.author.name}</span>
            )}
            {article.author?.name && <span>·</span>}
            <time dateTime={article.publishedAt}>{formatDateShort(article.publishedAt)}</time>
          </div>
        </div>

        {/* Corner tech accent */}
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full"
          style={{ background: '#06b6d4', boxShadow: '0 0 10px rgba(6,182,212,0.9)' }} />
      </article>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPACT CARD — terpopuler sidebar, glassmorphism rows
═══════════════════════════════════════════════════════════════════ */
export function ArticleCardCompact({ article, rank }) {
  if (!article) return null;
  const img     = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link
      href={`/artikel/${article.slug}`}
      className="group flex gap-3 items-start py-3 border-b last:border-0 transition-all duration-200
        hover:bg-white/[0.03] rounded-lg px-2 -mx-2"
      style={{ borderColor: 'rgba(56,189,248,0.1)' }}
    >
      {rank !== undefined && (
        <span className="rank-number shrink-0 mt-0.5 w-8 text-center">
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <div className="flex-1 min-w-0">
        {catName && (
          <span className={`category-badge text-white text-[10px] mb-1 ${getCategoryColor(catSlug)}`}>
            {catName}
          </span>
        )}
        <h3 className="text-sm font-semibold text-slate-300 line-clamp-3 group-hover:text-cyan-400
          transition-colors leading-snug">
          {article.title}
        </h3>
        <time className="text-xs text-slate-500 mt-1 block" dateTime={article.publishedAt}>
          {formatDateShort(article.publishedAt)}
        </time>
      </div>
      {img && (
        <div className="relative w-20 h-16 shrink-0 rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(56,189,248,0.15)' }}>
          <Image src={img} alt={article.title} fill sizes="80px" className="object-cover group-hover:scale-110 transition-transform duration-300" />
        </div>
      )}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GRID CARD — sub-hero + category sections, glassmorphism
═══════════════════════════════════════════════════════════════════ */
export function ArticleCardGrid({ article }) {
  if (!article) return null;
  const img     = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link href={`/artikel/${article.slug}`} className="group block h-full">
      <article className="glass-card h-full flex flex-col overflow-hidden">
        {/* Image */}
        <div className="relative aspect-[16/9] shrink-0 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#0c1a2e,#0f172a)' }}>
          {img ? (
            <Image
              src={img}
              alt={article.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* image gradient */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(2,8,23,0.6) 0%, transparent 60%)' }} />
          {catName && (
            <span className={`absolute top-3 left-3 category-badge text-white text-[10px] ${getCategoryColor(catSlug)}`}>
              {catName}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-slate-200 text-base leading-snug line-clamp-3
            group-hover:text-cyan-400 transition-colors mb-2 flex-1">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-slate-500 text-sm line-clamp-2 mb-3 hidden sm:block">{article.excerpt}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-auto">
            {article.author?.name && <span className="font-medium text-slate-400">{article.author.name}</span>}
            {article.author?.name && <span>·</span>}
            <time dateTime={article.publishedAt}>{formatDateShort(article.publishedAt)}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HORIZONTAL CARD — side lists
═══════════════════════════════════════════════════════════════════ */
export function ArticleCardHorizontal({ article }) {
  if (!article) return null;
  const img     = getImageUrl(article.cover_image);
  const catSlug = article.category?.slug ?? '';
  const catName = article.category?.name ?? '';

  return (
    <Link href={`/artikel/${article.slug}`} className="group flex gap-4 items-start">
      <article className="flex gap-4 items-start w-full">
        <div className="relative w-28 h-20 md:w-36 md:h-24 shrink-0 rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(56,189,248,0.12)', background: '#0c1a2e' }}>
          {img ? (
            <Image src={img} alt={article.title} fill sizes="144px"
              className="object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="absolute inset-0" style={{ background: '#0f172a' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {catName && (
            <span className={`category-badge text-white text-[10px] mb-1.5 ${getCategoryColor(catSlug)}`}>
              {catName}
            </span>
          )}
          <h3 className="font-bold text-slate-300 text-sm md:text-base leading-snug line-clamp-3
            group-hover:text-cyan-400 transition-colors duration-200">
            {article.title}
          </h3>
          <time className="text-xs text-slate-500 mt-1.5 block" dateTime={article.publishedAt}>
            {formatDateShort(article.publishedAt)}
          </time>
        </div>
      </article>
    </Link>
  );
}
