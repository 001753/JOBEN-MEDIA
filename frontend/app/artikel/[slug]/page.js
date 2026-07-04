import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getArticleBySlug, getRelatedArticles, getPopularArticles,
  getImageUrl, formatDate,
} from '@/lib/strapi';
import { splitContentIntoPages, resolvePageNumber } from '@/lib/splitContent';
import { ArticleCardGrid } from '@/components/ArticleCard';
import { AdLeaderboard, AdRectangle, AdMobile } from '@/components/AdSlot';
import BlocksRenderer from '@/components/BlocksRenderer';
import ReadProgressBar from '@/components/ReadProgressBar';
import TableOfContents from '@/components/TableOfContents';
import { extractHeadings } from '@/lib/extractHeadings';
import ShareButtons from '@/components/ShareButtons';
import ArticleViewTracker from '@/components/ArticleViewTracker';
import Pagination from '@/components/Pagination';

export const revalidate = 60;

/* ── generateMetadata ─────────────────────────────────────────────────── */
export async function generateMetadata({ params, searchParams }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: 'Artikel Tidak Ditemukan' };

  const pages       = splitContentIntoPages(article.content ?? []);
  const totalPages  = pages.length;
  const currentPage = resolvePageNumber(searchParams?.halaman, totalPages);

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';
  const img      = getImageUrl(article.cover_image);
  const canonical = `${SITE_URL}/artikel/${article.slug}`;

  const title = currentPage > 1
    ? `${article.title} — Halaman ${currentPage}`
    : article.title;

  const paginationLinks = {};
  if (currentPage > 1)
    paginationLinks.prev = currentPage === 2
      ? canonical
      : `${canonical}?halaman=${currentPage - 1}`;
  if (currentPage < totalPages)
    paginationLinks.next = `${canonical}?halaman=${currentPage + 1}`;

  return {
    title,
    description: article.excerpt ?? article.title,
    alternates: { canonical, ...paginationLinks },
    robots: currentPage > 1 ? { index: true, follow: true } : undefined,
    openGraph: {
      title,
      description: article.excerpt ?? article.title,
      url: currentPage > 1 ? `${canonical}?halaman=${currentPage}` : canonical,
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author?.name].filter(Boolean),
      images: img ? [{ url: img, width: 1200, height: 630, alt: article.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: article.excerpt ?? '',
      images: img ? [img] : [],
    },
  };
}

/* ── Page Component ───────────────────────────────────────────────────── */
export default async function ArticlePage({ params, searchParams }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  const allPages    = splitContentIntoPages(article.content ?? []);
  const totalPages  = allPages.length;
  const currentPage = resolvePageNumber(searchParams?.halaman, totalPages);
  const pageContent = allPages[currentPage - 1] ?? [];

  const articleBasePath = `/artikel/${article.slug}`;
  const isFirstPage     = currentPage === 1;

  const [relatedArticles, popularArticles] = await Promise.all([
    article.category?.slug
      ? getRelatedArticles(article.category.slug, article.slug, 4)
      : Promise.resolve([]),
    getPopularArticles(5),
  ]);

  const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';
  const img       = getImageUrl(article.cover_image);
  const authorImg = getImageUrl(article.author?.photo);
  const headings  = extractHeadings(pageContent);

  const jsonLd = isFirstPage ? {
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
  } : null;

  return (
    <>
      <ReadProgressBar />
      {isFirstPage && (
        <ArticleViewTracker title={article.title} category={article.category?.name} />
      )}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ═══════════════ MAIN CONTENT ═══════════════ */}
          <article className="lg:col-span-2 min-w-0">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--text-faint)' }}>
              <Link href="/" className="hover:text-brand-700 transition-colors">Beranda</Link>
              <span>›</span>
              {article.category && (
                <>
                  <Link href={`/kategori/${article.category.slug}`} className="hover:text-brand-700 transition-colors">
                    {article.category.name}
                  </Link>
                  <span>›</span>
                </>
              )}
              <span className="line-clamp-1" style={{ color: 'var(--text-muted)' }}>{article.title}</span>
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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black leading-tight mb-4"
              style={{ color: 'var(--text-primary)' }}>
              {article.title}
            </h1>

            {/* Excerpt */}
            {isFirstPage && article.excerpt && (
              <p className="text-base md:text-lg leading-relaxed border-l-4 border-brand-700 pl-4 mb-5 italic"
                style={{ color: 'var(--text-muted)' }}>
                {article.excerpt}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 pb-5 mb-5 border-b border-theme">
              <div className="flex items-center gap-2.5">
                {authorImg ? (
                  <Image
                    src={authorImg}
                    alt={article.author?.name ?? 'Penulis'}
                    width={36} height={36}
                    className="rounded-full object-cover ring-2 ring-brand-100"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--bg-sub-nav)', border: '1px solid var(--border)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--text-faint)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {article.author?.name ?? 'Redaksi JOBEN NEWS'}
                  </p>
                  {article.author?.role_label && (
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{article.author.role_label}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-faint)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-faint)' }}>Bagikan:</span>
                <ShareButtons url={`${SITE_URL}/artikel/${article.slug}`} title={article.title} slug={article.slug} />
              </div>
            </div>

            {/* Cover image */}
            {isFirstPage && img && (
              <figure className="mb-6 -mx-4 sm:mx-0">
                <div className="relative aspect-video sm:rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-sub-nav)' }}>
                  <Image
                    src={img} alt={article.title} fill priority
                    sizes="(max-width: 768px) 100vw, 66vw"
                    className="object-cover"
                  />
                </div>
              </figure>
            )}

            {isFirstPage && <AdLeaderboard />}

            {/* Halaman 2+ banner */}
            {!isFirstPage && (
              <>
                <div className="flex items-center gap-3 rounded-lg px-4 py-3 mb-5"
                  style={{ background: 'var(--bg-sub-nav)', border: '1px solid var(--border)' }}>
                  <svg className="w-4 h-4 text-brand-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Lanjutan artikel</span>
                    {' — '}Halaman <span className="font-bold text-brand-700">{currentPage}</span> dari {totalPages}
                  </p>
                  <Link href={articleBasePath}
                    className="ml-auto text-xs text-brand-700 hover:text-brand-800 font-medium shrink-0">
                    ← Ke halaman 1
                  </Link>
                </div>
                <AdLeaderboard />
                <AdMobile />
              </>
            )}

            {/* Konten artikel */}
            <div className="article-body">
              {pageContent.length > 0 ? (
                <BlocksRenderer content={pageContent} />
              ) : (
                <p className="italic" style={{ color: 'var(--text-faint)' }}>Konten artikel belum tersedia.</p>
              )}
            </div>

            <div className="mt-8"><AdLeaderboard /></div>

            {/* Navigasi halaman */}
            {totalPages > 1 && (
              <div className="mt-4">
                <p className="text-center text-xs mb-3" style={{ color: 'var(--text-faint)' }}>
                  Halaman {currentPage} dari {totalPages}
                </p>
                <Pagination currentPage={currentPage} totalPages={totalPages} basePath={articleBasePath} />
              </div>
            )}

            {/* Tags */}
            {article.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-theme">
                <span className="text-xs font-bold uppercase tracking-wide mr-1" style={{ color: 'var(--text-faint)' }}>Tag:</span>
                {article.tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/cari?q=${encodeURIComponent(tag.name)}`}
                    className="article-tag-chip"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Share bawah */}
            {currentPage === totalPages && (
              <div className="mt-8 p-5 rounded-xl flex flex-col sm:flex-row items-center gap-4"
                style={{ background: 'var(--bg-sub-nav)', border: '1px solid var(--border)' }}>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>Bagikan artikel ini:</p>
                <ShareButtons url={`${SITE_URL}/artikel/${article.slug}`} title={article.title} slug={article.slug} large />
              </div>
            )}

            {/* Artikel terkait */}
            {currentPage === totalPages && relatedArticles.length > 0 && (
              <section className="mt-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="section-accent-bar" />
                  <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Artikel Terkait
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {relatedArticles.map((a) => (
                    <ArticleCardGrid key={a.slug ?? a.id} article={a} />
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* ═══════════════ SIDEBAR ═══════════════ */}
          <aside className="lg:col-span-1 space-y-6">

            {headings.length >= 2 && (
              <div className="lg:sticky lg:top-24">
                <TableOfContents headings={headings} />
              </div>
            )}

            {/* Navigasi halaman (sidebar) */}
            {totalPages > 1 && (
              <div className="article-sidebar-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="section-accent-bar" style={{ height: '20px' }} />
                  <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    Halaman Artikel
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={p === 1 ? articleBasePath : `${articleBasePath}?halaman=${p}`}
                      className={`w-9 h-9 flex items-center justify-center rounded text-sm font-semibold transition-colors ${
                        p === currentPage
                          ? 'bg-brand-700 text-white'
                          : 'article-page-btn'
                      }`}
                      aria-label={`Halaman ${p}`}
                      aria-current={p === currentPage ? 'page' : undefined}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
                  Sedang membaca halaman {currentPage}
                </p>
              </div>
            )}

            <AdRectangle />

            {/* Terpopuler sidebar */}
            {popularArticles.length > 0 && (
              <div className="article-sidebar-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="section-accent-bar" style={{ height: '20px' }} />
                  <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    Terpopuler
                  </h3>
                </div>
                {popularArticles.map((a, i) => (
                  <div key={a.slug ?? a.id} className="flex items-start gap-3 py-3 border-b border-theme last:border-0">
                    <span className="text-2xl font-black w-7 shrink-0 leading-none"
                      style={{ color: 'var(--border-hover)' }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/artikel/${a.slug}`}
                        className="text-sm font-semibold hover:text-brand-700 transition-colors line-clamp-3 leading-snug block"
                        style={{ color: 'var(--text-secondary)' }}
                      >
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
