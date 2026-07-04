'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import SearchOverlay from '@/components/SearchOverlay';
import ThemeToggle from '@/components/ThemeToggle';

const NAV_SHORT = {
  'artificial-intelligence': 'AI',
  'software-development':    'Software Dev',
  'kripto-blockchain':       'Kripto',
  'teknologi-masa-depan':    'Tek. Masa Depan',
  'cyber-security':          'Cyber Security',
};
function navLabel(cat) { return NAV_SHORT[cat.slug] ?? cat.name; }

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function Header({ categories = [], breakingNews = null }) {
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const [activeMenu,  setActiveMenu]  = useState(null);
  const [scrolled,    setScrolled]    = useState(false);
  const [query,       setQuery]       = useState('');

  const closeTimer = useRef(null);
  let pathname, router;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- guards against a Next.js edge case where the router context is unavailable during static prerendering of built-in error pages; hooks are still called unconditionally on every render.
    pathname = usePathname();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router   = useRouter();
  } catch {
    pathname = '/';
    router   = null;
  }

  useEffect(() => { setMobileOpen(false); setSearchOpen(false); setExpandedCat(null); setActiveMenu(null); }, [pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const openMenu      = useCallback((slug) => { clearTimeout(closeTimer.current); setActiveMenu(slug); }, []);
  const scheduleClose = useCallback(() => { closeTimer.current = setTimeout(() => setActiveMenu(null), 120); }, []);
  const cancelClose   = useCallback(() => { clearTimeout(closeTimer.current); }, []);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/cari?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setQuery('');
  }

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Desktop overlay */}
      {activeMenu && <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />}

      <header className={`site-header sticky top-0 z-50${scrolled ? ' scrolled' : ''}`}>

        {/* ══ Brand bar ══════════════════════════════════════════════════════ */}
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 flex items-center justify-between h-[46px]">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="bg-red-600 text-white font-black text-xl px-3 py-0.5 rounded-sm tracking-tight
              leading-none group-hover:bg-red-700 transition-colors duration-200 select-none header-logo-glow">
              JOBEN
            </span>
            <span className="news-shimmer font-bold text-sm tracking-[0.2em] uppercase hidden sm:inline">
              NEWS
            </span>
          </Link>

          {/* Breaking badge */}
          {breakingNews && (
            <Link
              href={`/artikel/${breakingNews.slug}`}
              className="breaking-badge hidden sm:flex items-center gap-2 ml-4 max-w-xs lg:max-w-sm xl:max-w-md group"
              title={breakingNews.title}
            >
              <span className="shrink-0 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm">
                <span className="breaking-dot text-white">
                  <span className="breaking-dot-inner" />
                </span>
                Breaking
              </span>
              <span className="header-breaking-title text-xs font-medium truncate group-hover:text-red-600 dark:group-hover:text-white transition-colors duration-200">
                {breakingNews.title}
              </span>
            </Link>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="hidden lg:block text-xs header-date tabular-nums" suppressHydrationWarning>
              {new Intl.DateTimeFormat('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'Asia/Jakarta',
              }).format(new Date())}
            </span>

            <button
              onClick={() => setSearchOpen(true)}
              className="header-icon-btn flex items-center gap-1.5 text-xs group"
              aria-label="Cari berita"
            >
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden lg:inline">Cari</span>
            </button>

            <ThemeToggle />

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden header-icon-btn p-1"
              aria-label="Menu"
            >
              {mobileOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>

        {/* ══ Nav bar — desktop ════════════════════════════════════════════════ */}
        <div className="hidden md:block site-nav-bar">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
            <nav className="flex items-stretch h-10" aria-label="Navigasi utama">

              {/* Beranda */}
              <Link
                href="/"
                className={`nav-item-link flex items-center px-3 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap${pathname === '/' ? ' active' : ''}`}
              >
                Beranda
              </Link>

              <div className="w-px my-2 mx-0.5 nav-divider" />

              {categories.map((cat, idx) => {
                const hasChildren = (cat.children?.length ?? 0) > 0;
                const active      = isActive(`/kategori/${cat.slug}`);
                const menuOpen    = activeMenu === cat.slug;
                const cols        = hasChildren ? chunkArray(cat.children, 5) : [];
                const alignRight  = idx >= categories.length - 3;

                return (
                  <div
                    key={cat.slug}
                    className="relative flex items-stretch"
                    onMouseEnter={() => hasChildren ? openMenu(cat.slug) : setActiveMenu(null)}
                    onMouseLeave={scheduleClose}
                  >
                    <Link
                      href={`/kategori/${cat.slug}`}
                      className={`nav-item-link flex items-center gap-1 px-3 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap${
                        active ? ' active' : menuOpen ? ' menu-open' : ''
                      }`}
                    >
                      {navLabel(cat)}
                      {hasChildren && (
                        <svg
                          className={`w-2.5 h-2.5 transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </Link>

                    {/* Mega-menu */}
                    {hasChildren && menuOpen && (
                      <div
                        key={`menu-${cat.slug}`}
                        className={`nav-dropdown nav-dropdown-enter absolute top-full z-50 rounded-b-xl overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}
                        style={{ minWidth: cols.length > 1 ? `${cols.length * 185}px` : '210px' }}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                      >
                        <div className="nav-dropdown-header px-4 py-2 flex items-center justify-between">
                          <span className="font-black text-[10px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                            {cat.name}
                          </span>
                          <Link
                            href={`/kategori/${cat.slug}`}
                            className="text-[10px] font-semibold transition-colors duration-150"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Lihat semua →
                          </Link>
                        </div>
                        <div className="flex divide-x" style={{ borderColor: 'var(--border)' }}>
                          {cols.map((col, ci) => (
                            <div key={ci} className="flex flex-col py-2 min-w-[175px]">
                              {col.map((sub, si) => (
                                <Link
                                  key={sub.slug}
                                  href={`/kategori/${sub.slug}`}
                                  className={`nav-sub-item nav-dropdown-item px-4 py-2 text-[12px] flex items-center gap-2 group${
                                    isActive(`/kategori/${sub.slug}`) ? ' active-sub' : ''
                                  }`}
                                  style={{ animationDelay: `${(ci * col.length + si) * 28}ms` }}
                                >
                                  <span className="w-1 h-1 rounded-full shrink-0 bg-current opacity-40 group-hover:opacity-100 transition-opacity" />
                                  {sub.name}
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* ════════════════ MOBILE DRAWER ════════════════ */}
      <div
        className={`fixed inset-0 z-[60] md:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={() => setMobileOpen(false)}
      />

      <div
        className={`mobile-drawer fixed top-0 left-0 z-[70] h-full w-[310px] max-w-[85vw] flex flex-col md:hidden
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="drawer-header flex items-center justify-between px-4 h-[46px] shrink-0">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
            <span className="bg-red-600 text-white font-black text-lg px-2.5 py-0.5 rounded-sm header-logo-glow">JOBEN</span>
            <span className="news-shimmer font-bold text-xs tracking-widest">NEWS</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="header-icon-btn p-1" aria-label="Tutup menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-theme">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari berita…"
              className="flex-1 search-input rounded-full px-4 py-2 text-sm"
            />
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 transition-colors duration-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`mobile-nav-link flex items-center px-5 py-3 text-sm font-semibold${pathname === '/' ? ' active' : ''}`}
          >
            Beranda
          </Link>

          {categories.map((cat) => {
            const hasChildren = (cat.children?.length ?? 0) > 0;
            const open        = expandedCat === cat.slug;
            const active      = isActive(`/kategori/${cat.slug}`);

            return (
              <div key={cat.slug} className="border-t border-theme">
                <div className="flex items-stretch">
                  <Link
                    href={`/kategori/${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={`mobile-nav-link flex-1 flex items-center px-5 py-3 text-sm font-semibold${active ? ' active' : ''}`}
                  >
                    {cat.name}
                  </Link>
                  {hasChildren && (
                    <button
                      onClick={() => setExpandedCat(open ? null : cat.slug)}
                      className="header-icon-btn px-4 flex items-center"
                      aria-label={open ? 'Tutup' : 'Buka subkategori'}
                    >
                      <svg className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>

                {hasChildren && (
                  <div className={`mobile-sub-wrapper mobile-sub-bg border-l-4 border-cyan-500/30 ml-5 ${open ? 'open' : 'closed'}`}>
                    {cat.children.map((sub, si) => (
                      <Link
                        key={sub.slug}
                        href={`/kategori/${sub.slug}`}
                        onClick={() => setMobileOpen(false)}
                        className={`mobile-nav-link flex items-center gap-2 px-5 py-2.5 text-sm${
                          isActive(`/kategori/${sub.slug}`) ? ' active' : ''
                        }`}
                        style={open ? { transitionDelay: `${si * 18}ms` } : {}}
                      >
                        <span className="w-1 h-1 rounded-full bg-current opacity-40 shrink-0" />
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-theme text-xs" style={{ color: 'var(--text-faint)' }}>
          © {new Date().getFullYear()} JOBEN NEWS
        </div>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
