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
              <ScrollReveal className="lg:col-span-1 flex flex-col gap-0" direction="right" delay={80}>
                <div className="glass-card p-5 h-full border-glow-anim">
                  <div className="flex items-center gap-2 mb-3">
                    {/* glowing bar */}
                    <div className="w-1 h-5 rounded-full"
                      style={{ background: 'linear-gradient(180deg,#06b6d4,#c10f0f)', boxShadow: '0 0 10px rgba(6,182,212,0.8)' }} />
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
                      Terpopuler
                    </h2>
                    {/* pulsing dot */}
                    <span className="ml-auto w-2 h-2 rounded-full"
                      style={{ background: '#06b6d4', boxShadow: '0 0 8px #06b6d4', animation: 'breaking-pulse 2s ease-in-out infinite' }} />
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
            <section className="my-10 rounded-2xl p-6 md:p-8 relative overflow-hidden"
              style={{
                background: 'rgba(2,8,23,0.7)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(56,189,248,0.15)',
                boxShadow: '0 0 60px rgba(6,182,212,0.06) inset',
              }}>
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-24 h-24 pointer-events-none"
                style={{ background: 'radial-gradient(circle at top left, rgba(6,182,212,0.12) 0%, transparent 70%)' }} />
              <div className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none"
                style={{ background: 'radial-gradient(circle at bottom right, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full"
                  style={{ background: 'linear-gradient(180deg,#06b6d4,#7c3aed)', boxShadow: '0 0 12px rgba(6,182,212,0.7)' }} />
                <h2 className="text-white font-black text-lg uppercase tracking-tight">Jelajahi Kategori</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                {categories.map((cat, i) => (
                  <Link
                    key={cat.slug}
                    href={`/kategori/${cat.slug}`}
                    className="cat-pill"
                  >
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
