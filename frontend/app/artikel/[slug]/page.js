import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getRelatedArticles, getPopularArticles, getImageUrl, formatDate } from '@/lib/strapi';
import { ArticleCardGrid } from '@/components/ArticleCard';
import { AdLeaderboard, AdRectangle } from '@/components/AdSlot';
import BlocksRenderer from '@/components/BlocksRenderer';
import ReadProgressBar from '@/components/ReadProgressBar';

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: 'Artikel Tidak Ditemukan' };

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';
  const img = getImageUrl(article.cover_image);

  return {
    title: article.title,
    description: article.excerpt ?? article.title,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? article.title,
      url: `${SITE_URL}/artikel/${article.slug}`,
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author?.name].filter(Boolean),
      images: img ? [{ url: img, width: 1200, height: 630, alt: article.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt ?? '',
      images: img ? [img] : [],
    },
  };
}

export default async function ArticlePage({ params }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  const [relatedArticles, popularArticles] = await Promise.all([
    article.category?.slug
      ? getRelatedArticles(article.category.slug, article.slug, 4)
      : Promise.resolve([]),
    getPopularArticles(5),
  ]);

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';
  const img = getImageUrl(article.cover_image);
  const authorImg = getImageUrl(article.author?.photo);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt ?? '',
    image: img ? [img] : [],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: article.author?.name
      ? [{ '@type': 'Person', name: article.author.name }]
      : [],
    publisher: {
      '@type': 'Organization',
      name: 'JOBEN NEWS',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    url: `${SITE_URL}/artikel/${article.slug}`,
  };

  return (
    <>
      <ReadProgressBar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ======= MAIN CONTENT ======= */}
          <article className="lg:col-span-2 min-w-0">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
              <Link href="/" className="hover:text-brand-700">Beranda</Link>
              <span>›</span>
              {article.category && (
                <>
                  <Link href={`/kategori/${article.category.slug}`} className="hover:text-brand-700">
                    {article.category.name}
                  </Link>
                  <span>›</span>
                </>
              )}
              <span className="text-gray-600 line-clamp-1">{article.title}</span>
            </nav>

            {/* Category badge */}
            {article.category && (
              <Link href={`/kategori/${article.category.slug}`}>
                <span className="category-badge bg-brand-700 text-white text-xs mb-3">
                  {article.category.name}
                </span>
              </Link>
            )}

            {/* Title */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-dark leading-tight mb-4">
              {article.title}
            </h1>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-gray-500 text-base md:text-lg leading-relaxed border-l-4 border-brand-700 pl-4 mb-5 italic">
                {article.excerpt}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 pb-5 mb-5 border-b border-gray-200">
              {/* Author */}
              <div className="flex items-center gap-2.5">
                {authorImg ? (
                  <Image
                    src={authorImg}
                    alt={article.author?.name ?? 'Penulis'}
                    width={36}
                    height={36}
                    className="rounded-full object-cover ring-2 ring-brand-100"
                  />
                ) : (
                  <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm text-gray-800">
                    {article.author?.name ?? 'Redaksi JOBEN NEWS'}
                  </p>
                  {article.author?.role_label && (
                    <p className="text-xs text-gray-400">{article.author.role_label}</p>
                  )}
                </div>
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              </div>

              {/* Share */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-400 hidden sm:inline">Bagikan:</span>
                <ShareButtons url={`${SITE_URL}/artikel/${article.slug}`} title={article.title} />
              </div>
            </div>

            {/* Cover image */}
            {img && (
              <figure className="mb-6 -mx-4 sm:mx-0">
                <div className="relative aspect-video sm:rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={img}
                    alt={article.title}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 66vw"
                    className="object-cover"
                  />
                </div>
              </figure>
            )}

            {/* Ad inline */}
            <AdLeaderboard />

            {/* Article body */}
            <div className="rich-content">
              {article.content ? (
                <BlocksRenderer content={article.content} />
              ) : (
                <p className="text-gray-400 italic">Konten artikel belum tersedia.</p>
              )}
            </div>

            {/* Tags */}
            {article.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-1">Tag:</span>
                {article.tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/cari?q=${encodeURIComponent(tag.name)}`}
                    className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 px-3 py-1 rounded-full transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Share bottom */}
            <div className="mt-8 p-5 bg-gray-50 rounded-xl flex flex-col sm:flex-row items-center gap-4">
              <p className="font-semibold text-gray-700 text-sm">Bagikan artikel ini:</p>
              <ShareButtons url={`${SITE_URL}/artikel/${article.slug}`} title={article.title} large />
            </div>

            {/* Related articles */}
            {relatedArticles.length > 0 && (
              <section className="mt-10">
                <div className="section-title">
                  <div className="w-1 h-5 bg-brand-700 rounded-full" />
                  Artikel Terkait
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {relatedArticles.map((a) => (
                    <ArticleCardGrid key={a.slug ?? a.id} article={a} />
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* ======= SIDEBAR ======= */}
          <aside className="lg:col-span-1 space-y-6">
            <AdRectangle />

            {popularArticles.length > 0 && (
              <div className="bg-white rounded-xl p-5 card-shadow">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-5 bg-brand-700 rounded-full" />
                  <h3 className="text-sm font-black text-dark uppercase tracking-wider">Terpopuler</h3>
                </div>
                {popularArticles.map((a, i) => (
                  <div key={a.slug ?? a.id} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                    <span className="text-2xl font-black text-gray-100 w-7 shrink-0 leading-none">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <Link href={`/artikel/${a.slug}`} className="text-sm font-semibold text-gray-800 hover:text-brand-700 transition-colors line-clamp-3 leading-snug block">
                        {a.title}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function ShareButtons({ url, title, large = false }) {
  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const iconClass = large ? 'w-5 h-5' : 'w-4 h-4';
  const btnClass = large ? 'p-2.5' : 'p-2';

  const networks = [
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      bg: 'bg-blue-600 hover:bg-blue-700',
      icon: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
    },
    {
      name: 'Twitter',
      href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`,
      bg: 'bg-sky-500 hover:bg-sky-600',
      icon: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z',
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodedTitle}%20${encoded}`,
      bg: 'bg-green-600 hover:bg-green-700',
      icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M11.5 2C6.253 2 2 6.477 2 12.018c0 1.76.455 3.408 1.252 4.846L2 22l5.293-1.38A9.945 9.945 0 0011.5 22C16.747 22 21 17.523 21 12.018 21 6.477 16.747 2 11.5 2z',
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encoded}&text=${encodedTitle}`,
      bg: 'bg-sky-400 hover:bg-sky-500',
      icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {networks.map(({ name, href, bg, icon }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Bagikan ke ${name}`}
          className={`${bg} text-white ${btnClass} rounded-full transition-colors`}
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
          </svg>
        </a>
      ))}
    </div>
  );
}
