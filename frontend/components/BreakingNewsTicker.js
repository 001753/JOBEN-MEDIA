import Link from 'next/link';

export default function BreakingNewsTicker({ article }) {
  if (!article) return null;

  return (
    <div className="bg-brand-700 text-white" role="marquee" aria-live="polite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-9 gap-0 overflow-hidden">
        {/* Label */}
        <span className="bg-white text-brand-700 font-black text-xs uppercase tracking-widest px-3 py-1 rounded-sm shrink-0 mr-4">
          BREAKING
        </span>

        {/* Ticker */}
        <div className="ticker-wrapper flex-1 overflow-hidden">
          <Link
            href={`/artikel/${article.slug}`}
            className="ticker-content text-sm font-semibold hover:text-brand-100 transition-colors inline-block"
          >
            {article.title}
            &nbsp;&nbsp;&nbsp;▶&nbsp;&nbsp;&nbsp;
            {article.excerpt ?? article.title}
          </Link>
        </div>
      </div>
    </div>
  );
}
