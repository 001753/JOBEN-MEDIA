import { getBreakingNews, getHeroArticles, getPopularArticles, getCategories, getCategoryHomeSections } from '@/lib/strapi';
import BreakingNewsTicker from '@/components/BreakingNewsTicker';
import { ArticleCardHero, ArticleCardCompact, ArticleCardGrid } from '@/components/ArticleCard';
import CategorySection from '@/components/CategorySection';
import { AdLeaderboard, AdRectangle, AdMobile } from '@/components/AdSlot';
import Link from 'next/link';

export const revalidate = 60;

export const metadata = {
  title: 'JOBEN NEWS — Berita Terkini Indonesia',
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
        {/* ======================== HERO SECTION ======================== */}
        {heroArticles.length > 0 && (
          <section className="py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Main hero — large */}
              <div className="lg:col-span-2">
                {mainHero && <ArticleCardHero article={mainHero} />}
              </div>

              {/* Right sidebar: popular + secondary heroes */}
              <div className="lg:col-span-1 flex flex-col gap-0">
                {/* Terpopuler / terbaru */}
                <div className="bg-white rounded-xl p-5 card-shadow h-full">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-5 bg-brand-700 rounded-full" />
                    <h2 className="text-sm font-black text-dark uppercase tracking-wider">Terpopuler</h2>
                  </div>
                  <div>
                    {(popularArticles.length > 0 ? popularArticles : secondaryHeroes).map((article, i) => (
                      <ArticleCardCompact key={article.slug ?? article.id} article={article} rank={i + 1} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Sub-hero strip (articles 2-4 below main hero, desktop only) */}
        {secondaryHeroes.length > 1 && (
          <section className="mb-6 hidden md:grid grid-cols-3 gap-4">
            {secondaryHeroes.slice(0, 3).map((article) => (
              <ArticleCardGrid key={article.slug ?? article.id} article={article} />
            ))}
          </section>
        )}

        {/* Ad leaderboard */}
        <AdLeaderboard />
        <AdMobile />

        {/* ======================== CATEGORY SECTIONS ======================== */}
        {categorySections.map(({ category, articles }) => (
          <CategorySection
            key={category.slug}
            category={category}
            articles={articles}
          />
        ))}

        {/* Empty state */}
        {heroArticles.length === 0 && categorySections.length === 0 && (
          <div className="py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-600 mb-2">Belum ada artikel</h2>
            <p className="text-gray-400 text-sm">Artikel akan tampil di sini setelah diterbitkan.</p>
          </div>
        )}

        {/* Ad rectangle (sidebar mobile) */}
        <AdRectangle />

        {/* ======================== TREN TERKINI STRIP ======================== */}
        {categories.length > 0 && (
          <section className="my-8 bg-dark rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 bg-brand-700 rounded-full" />
              <h2 className="text-white font-black text-lg uppercase tracking-tight">Jelajahi Kategori</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/kategori/${cat.slug}`}
                  className="bg-gray-800 hover:bg-brand-700 text-gray-300 hover:text-white px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
