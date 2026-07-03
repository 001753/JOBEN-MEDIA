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

/* ─────────────────────────────────────────────────────── generateMetadata ── */
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
    alternates: {
      canonical,
      ...paginationLinks,
    },
    robots: currentPage > 1
      ? { index: true, follow: true }
      : undefined,
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

/* ─────────────────────────────────────────────────────────── Page Component ── */
export default async function ArticlePage({ params, searchParams }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  /* ── Pagination ─────────────────────────────────────────────────────────── */
  const allPages    = splitContentIntoPages(article.content ?? []);
  const totalPages  = allPages.length;
  const currentPage = resolvePageNumber(searchParams?.halaman, totalPages);
  const pageContent = allPages[currentPage - 1] ?? [];

  const articleBasePath = `/artikel/${article.slug}`;
  const isFirstPage     = currentPage === 1;

  /* ── Fetch data paralel ─────────────────────────────────────────────────── */
  const [relatedArticles, popularArticles] = await Promise.all([
    article.category?.slug
      ? getRelatedArticles(article.category.slug, article.slug, 4)
      : Promise.resolve([]),
    getPopularArticles(5),
  ]);

  /* ── Metadata artikel ───────────────────────────────────────────────────── */
  const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';
  const img       = getImageUrl(article.cover_image);
  const authorImg = getImageUrl(article.author?.photo);
  const headings  = extractHeadings(pageContent);

  /* ── JSON-LD (hanya halaman 1) ──────────────────────────────────────────── */
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

          {/* ═══════════════════════ MAIN CONTENT ═══════════════════════ */}
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

            {/* Excerpt — hanya halaman 1 */}
            {isFirstPage && article.excerpt && (
              <p className="text-gray-500 text-base md:text-lg leading-relaxed border-l-4 border-brand-700 pl-4 mb-5 italic">
                {article.excerpt}
              </p>
            )}

            {/* Meta (penulis, tanggal, share) */}
            <div className="flex flex-wrap items-center gap-4 pb-5 mb-5 border-b border-gray-200">
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
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-400 hidden sm:inline">Bagikan:</span>
                <ShareButtons url={`${SITE_URL}/artikel/${article.slug}`} title={article.title} slug={article.slug} />
              </div>
            </div>

            {/* ── Halaman 1: Cover image ────────────────────────────────── */}
            {isFirstPage && img && (
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

            {/* ── Halaman 1: Iklan inline pertama ──────────────────────── */}
            {isFirstPage && <AdLeaderboard />}

            {/* ── Halaman 2+: Banner lanjutan + iklan atas ─────────────── */}
            {!isFirstPage && (
              <>
                {/* Banner penanda halaman lanjutan */}
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-5">
                  <svg className="w-4 h-4 text-brand-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">Lanjutan artikel</span>
                    {' — '}Halaman <span className="font-bold text-brand-700">{currentPage}</span> dari {totalPages}
                  </p>
                  <Link
                    href={articleBasePath}
                    className="ml-auto text-xs text-brand-700 hover:text-brand-800 font-medium shrink-0"
                  >
                    ← Ke halaman 1
                  </Link>
                </div>

                {/* Iklan atas halaman 2+ */}
                <AdLeaderboard />
                <AdMobile />
              </>
            )}

            {/* ── Konten artikel (halaman saat ini) ────────────────────── */}
            <div className="rich-content">
              {pageContent.length > 0 ? (
                <BlocksRenderer content={pageContent} />
              ) : (
                <p className="text-gray-400 italic">Konten artikel belum tersedia.</p>
              )}
            </div>

            {/* ── Iklan bawah konten (semua halaman) ───────────────────── */}
            <div className="mt-8">
              <AdLeaderboard />
            </div>

            {/* ── Navigasi halaman ─────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="mt-4">
                {/* Label info */}
                <p className="text-center text-xs text-gray-400 mb-3">
                  Halaman {currentPage} dari {totalPages}
                </p>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  basePath={articleBasePath}
                />
              </div>
            )}

            {/* ── Tag ──────────────────────────────────────────────────── */}
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

            {/* ── Share bawah (hanya halaman terakhir atau satu halaman) ─ */}
            {currentPage === totalPages && (
              <div className="mt-8 p-5 bg-gray-50 rounded-xl flex flex-col sm:flex-row items-center gap-4">
                <p className="font-semibold text-gray-700 text-sm">Bagikan artikel ini:</p>
                <ShareButtons url={`${SITE_URL}/artikel/${article.slug}`} title={article.title} slug={article.slug} large />
              </div>
            )}

            {/* ── Artikel terkait (hanya halaman terakhir) ─────────────── */}
            {currentPage === totalPages && relatedArticles.length > 0 && (
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

          {/* ═══════════════════════════ SIDEBAR ═══════════════════════ */}
          <aside className="lg:col-span-1 space-y-6">

            {/* TOC — tampil jika halaman ini punya ≥2 heading */}
            {headings.length >= 2 && (
              <div className="lg:sticky lg:top-24">
                <TableOfContents headings={headings} />
              </div>
            )}

            {/* Navigasi halaman di sidebar (jika multi-halaman) */}
            {totalPages > 1 && (
              <div className="bg-white rounded-xl p-4 card-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 bg-brand-700 rounded-full" />
                  <h3 className="text-sm font-black text-dark uppercase tracking-wider">Halaman Artikel</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={p === 1 ? articleBasePath : `${articleBasePath}?halaman=${p}`}
                      className={`w-9 h-9 flex items-center justify-center rounded text-sm font-semibold transition-colors ${
                        p === currentPage
                          ? 'bg-brand-700 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-brand-700'
                      }`}
                      aria-label={`Halaman ${p}`}
                      aria-current={p === currentPage ? 'page' : undefined}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Sedang membaca halaman {currentPage}
                </p>
              </div>
            )}

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
                      <Link
                        href={`/artikel/${a.slug}`}
                        className="text-sm font-semibold text-gray-800 hover:text-brand-700 transition-colors line-clamp-3 leading-snug block"
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
