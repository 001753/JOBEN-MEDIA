import { getBreakingNews, getHeroArticles, getPopularArticles, getCategories, getCategoryHomeSections } from '@/lib/strapi';
import BreakingNewsTicker from '@/components/BreakingNewsTicker';
import { ArticleCardHero, ArticleCardCompact, ArticleCardGrid } from '@/components/ArticleCard';
import CategorySection from '@/components/CategorySection';
import { AdLeaderboard, AdRectangle, AdMobile } from '@/components/AdSlot';
import ScrollReveal from '@/components/ScrollReveal';
import Link from 'next/link';

export const revalidate = 60;

export const metadata = {
  title:       'JOBEN NEWS — Berita Terkini Indonesia',
  description: 'Portal berita terkini Indonesia. Liputan mendalam, akurat, dan terpercaya seputar nasional, ekonomi, olahraga, teknologi, dan hiburan.',
};

export default async function HomePage() {
  const [breakingNews, heroArticles, popularArticles, categories] = await Promise.all([
    getBreakingNews(),
    getHeroArticles(5),
    getPopularArticles(5),
    getCategories(),
  ]);

  const categorySections = await getCategoryHomeSections(categories, 5);
  const [mainHero, ...secondaryHeroes] = heroArticles;

  return (
    <>
      {/* Breaking News Ticker */}
      {breakingNews && <BreakingNewsTicker article={breakingNews} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ════════════════════════ HERO SECTION ════════════════════════ */}
        {heroArticles.length > 0 && (
          <section className="py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Main hero */}
              <ScrollReveal className="lg:col-span-2" direction="left" delay={0}>
                {mainHero && <ArticleCardHero article={mainHero} />}
              </ScrollReveal>

              {/* Sidebar: Terpopuler */}
              <ScrollReveal className="lg:col-span-1 flex flex-col" direction="right" delay={80}>
                <div className="terpopuler-sidebar p-5 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="section-accent-bar" />
                    <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                      Terpopuler
                    </h2>
                    <span className="ml-auto w-2 h-2 rounded-full live-dot" />
                  </div>
                  <div>
                    {(popularArticles.length > 0 ? popularArticles : secondaryHeroes).map((article, i) => (
                      <ArticleCardCompact key={article.slug ?? article.id} article={article} rank={i + 1} />
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>
        )}

        {/* ════════════ Sub-hero strip ════════════ */}
        {secondaryHeroes.length > 1 && (
          <section className="mb-6 hidden md:grid grid-cols-3 gap-4">
            {secondaryHeroes.slice(0, 3).map((article, i) => (
              <ScrollReveal key={article.slug ?? article.id} delay={i * 80} direction="up">
                <ArticleCardGrid article={article} />
              </ScrollReveal>
            ))}
          </section>
        )}

        {/* Ad */}
        <AdLeaderboard />
        <AdMobile />

        {/* ════════════ Category Sections ════════════ */}
        {categorySections.map(({ category, articles }, idx) => (
          <ScrollReveal key={category.slug} delay={idx * 60} direction="up">
            <CategorySection category={category} articles={articles} />
          </ScrollReveal>
        ))}

        {/* Empty state */}
        {heroArticles.length === 0 && categorySections.length === 0 && (
          <div className="py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-500 mb-2">Belum ada artikel</h2>
            <p className="text-slate-600 text-sm">Artikel akan tampil di sini setelah diterbitkan.</p>
          </div>
        )}

        <AdRectangle />

        {/* ════════════ Jelajahi Kategori ════════════ */}
        {categories.length > 0 && (
          <ScrollReveal direction="up" delay={0}>
            <section className="explore-section my-10 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="section-accent-bar" />
                <h2 className="font-black text-lg uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Jelajahi Kategori
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <Link key={cat.slug} href={`/kategori/${cat.slug}`} className="cat-pill">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </section>
          </ScrollReveal>
        )}
      </div>
    </>
  );
}
