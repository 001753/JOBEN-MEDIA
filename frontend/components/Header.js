'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import SearchOverlay from '@/components/SearchOverlay';
import ThemeToggle from '@/components/ThemeToggle';

/* ─── Label singkat di nav bar ─────────────────────────────────────────────── */
const NAV_SHORT = {
  'artificial-intelligence': 'AI',
  'software-development':    'Software Dev',
  'kripto-blockchain':       'Kripto',
  'teknologi-masa-depan':    'Tek. Masa Depan',
  'cyber-security':          'Cyber Security',
};

function navLabel(cat) {
  return NAV_SHORT[cat.slug] ?? cat.name;
}

/* ─── Split children ke kolom ──────────────────────────────────────────────── */
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function Header({ categories = [], breakingNews = null }) {
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const [activeMenu,  setActiveMenu]  = useState(null);
  const [scrolled,    setScrolled]    = useState(false);
  const [query,       setQuery]       = useState('');

  const closeTimer = useRef(null);
  const pathname   = usePathname();
  const router     = useRouter();

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setExpandedCat(null);
    setActiveMenu(null);
  }, [pathname]);

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

  /* ── Glassmorphism header bg ── */
  const headerBg = scrolled
    ? 'bg-[rgba(2,8,23,0.92)] backdrop-blur-xl border-b border-[rgba(56,189,248,0.12)] shadow-[0_4px_32px_rgba(0,0,0,0.5)]'
    : 'bg-[rgba(2,8,23,0.75)] backdrop-blur-md border-b border-[rgba(56,189,248,0.08)]';

  return (
    <>
      {/* Desktop overlay — klik di luar tutup menu */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}

      <header className={`sticky top-0 z-50 transition-all duration-300 ${headerBg}`}>

        {/* ══ Brand bar ══════════════════════════════════════════════════════ */}
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 flex items-center justify-between h-[46px]">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="bg-red-600 text-white font-black text-xl px-3 py-0.5 rounded-sm tracking-tight leading-none
              group-hover:bg-red-700 transition-colors duration-200 select-none"
              style={{ boxShadow: '0 0 12px rgba(220,38,38,0.4)' }}>
              JOBEN
            </span>
            <span className="news-shimmer font-bold text-sm tracking-[0.2em] uppercase hidden sm:inline">
              NEWS
            </span>
          </Link>

          {/* Breaking news badge */}
          {breakingNews && (
            <Link
              href={`/artikel/${breakingNews.slug}`}
              className="breaking-badge hidden sm:flex items-center gap-2 ml-4 max-w-xs lg:max-w-sm xl:max-w-md group"
              title={breakingNews.title}
            >
              <span className="shrink-0 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm"
                style={{ boxShadow: '0 0 8px rgba(220,38,38,0.5)' }}>
                <span className="breaking-dot text-white">
                  <span className="breaking-dot-inner" />
                </span>
                Breaking
              </span>
              <span className="text-slate-400 text-xs font-medium truncate group-hover:text-white transition-colors duration-200">
                {breakingNews.title}
              </span>
            </Link>
          )}

          {/* Kanan: tanggal + search + theme */}
          <div className="flex items-center gap-4 ml-auto">
            <span className="hidden lg:block text-xs text-slate-500 tabular-nums" suppressHydrationWarning>
              {new Intl.DateTimeFormat('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'Asia/Jakarta',
              }).format(new Date())}
            </span>

            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors duration-200 text-xs group"
              aria-label="Cari berita"
            >
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden lg:inline">Cari</span>
            </button>

            <ThemeToggle />

            {/* Hamburger mobile */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1 text-slate-400 hover:text-cyan-400 transition-colors duration-200"
              aria-label="Menu"
            >
              {mobileOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
              }
            </button>
          </div>
        </div>

        {/* ══ Nav bar — DESKTOP ONLY ══════════════════════════════════════════ */}
        <div className="hidden md:block border-t"
          style={{ borderColor: 'rgba(56,189,248,0.08)', background: 'rgba(2,8,23,0.6)' }}>
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
            <nav className="flex items-stretch h-10" aria-label="Navigasi utama">

              {/* Beranda */}
              <Link
                href="/"
                className={`nav-item-link flex items-center px-3 text-[11px] font-bold uppercase tracking-wide border-b-2 whitespace-nowrap transition-all duration-200 ${
                  pathname === '/'
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-slate-400 hover:text-cyan-400 hover:border-cyan-500'
                }`}
              >
                Beranda
              </Link>

              <div className="w-px my-2 mx-0.5" style={{ background: 'rgba(56,189,248,0.12)' }} />

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
                      className={`nav-item-link flex items-center gap-1 px-3 text-[11px] font-bold uppercase tracking-wide border-b-2 whitespace-nowrap transition-all duration-200 ${
                        active
                          ? 'border-red-500 text-red-400'
                          : menuOpen
                          ? 'border-cyan-500 text-cyan-400'
                          : 'border-transparent text-slate-400 hover:text-cyan-400 hover:border-cyan-500'
                      }`}
                    >
                      {navLabel(cat)}
                      {hasChildren && (
                        <svg
                          className={`w-2.5 h-2.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? 'rotate-180 text-cyan-400' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </Link>

                    {/* ── Mega-menu dropdown ──────────────────────────────── */}
                    {hasChildren && menuOpen && (
                      <div
                        key={`menu-${cat.slug}`}
                        className={`nav-dropdown-enter absolute top-full z-50 rounded-b-xl overflow-hidden ${
                          alignRight ? 'right-0' : 'left-0'
                        }`}
                        style={{
                          minWidth: cols.length > 1 ? `${cols.length * 185}px` : '210px',
                          background: 'rgba(2,8,23,0.95)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(56,189,248,0.2)',
                          boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.05)',
                        }}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                      >
                        {/* Header cyan */}
                        <div className="px-4 py-2 flex items-center justify-between"
                          style={{ background: 'rgba(6,182,212,0.12)', borderBottom: '1px solid rgba(56,189,248,0.2)' }}>
                          <span className="text-cyan-300 font-black text-[10px] uppercase tracking-widest">
                            {cat.name}
                          </span>
                          <Link
                            href={`/kategori/${cat.slug}`}
                            className="text-slate-400 hover:text-cyan-400 text-[10px] font-semibold transition-colors duration-150"
                          >
                            Lihat semua →
                          </Link>
                        </div>

                        {/* Grid subkategori */}
                        <div className="flex gap-0 divide-x" style={{ borderColor: 'rgba(56,189,248,0.08)' }}>
                          {cols.map((col, ci) => (
                            <div key={ci} className="flex flex-col py-2 min-w-[175px]">
                              {col.map((sub, si) => (
                                <Link
                                  key={sub.slug}
                                  href={`/kategori/${sub.slug}`}
                                  className={`nav-sub-item px-4 py-2 text-[12px] flex items-center gap-2 group transition-all duration-150 ${
                                    isActive(`/kategori/${sub.slug}`)
                                      ? 'text-cyan-400 font-bold'
                                      : 'text-slate-400 hover:text-cyan-300'
                                  }`}
                                  style={{
                                    animationDelay: `${(ci * col.length + si) * 28}ms`,
                                    background: isActive(`/kategori/${sub.slug}`) ? 'rgba(6,182,212,0.1)' : undefined,
                                  }}
                                >
                                  <span className={`w-1 h-1 rounded-full shrink-0 transition-colors duration-200 ${
                                    isActive(`/kategori/${sub.slug}`) ? 'bg-cyan-400' : 'bg-slate-600 group-hover:bg-cyan-500'
                                  }`} />
                                  <span className="transition-transform duration-150 group-hover:translate-x-0.5">
                                    {sub.name}
                                  </span>
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

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE DRAWER
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-[60] md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={() => setMobileOpen(false)}
      />

      <div
        className={`fixed top-0 left-0 z-[70] h-full w-[320px] max-w-[85vw] flex flex-col md:hidden
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          background: 'rgba(2,8,23,0.97)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(56,189,248,0.15)',
          boxShadow: '8px 0 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-[46px] shrink-0"
          style={{ borderBottom: '1px solid rgba(56,189,248,0.1)', background: 'rgba(2,8,23,0.8)' }}>
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
            <span className="bg-red-600 text-white font-black text-lg px-2.5 py-0.5 rounded-sm"
              style={{ boxShadow: '0 0 10px rgba(220,38,38,0.4)' }}>JOBEN</span>
            <span className="news-shimmer font-bold text-xs tracking-widest">NEWS</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 text-slate-400 hover:text-cyan-400 transition-colors duration-200"
            aria-label="Tutup menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search mobile */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari berita…"
              className="flex-1 rounded-full px-4 py-2 text-sm focus:outline-none transition-all duration-200 text-slate-200 placeholder-slate-500"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(56,189,248,0.2)',
              }}
            />
            <button type="submit"
              className="bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 transition-colors duration-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center px-5 py-3 text-sm font-semibold border-l-4 transition-all duration-200 ${
              pathname === '/'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-cyan-400 hover:border-cyan-500 hover:pl-6'
            }`}
          >
            Beranda
          </Link>

          {categories.map((cat) => {
            const hasChildren = (cat.children?.length ?? 0) > 0;
            const open        = expandedCat === cat.slug;
            const active      = isActive(`/kategori/${cat.slug}`);

            return (
              <div key={cat.slug} className="border-t" style={{ borderColor: 'rgba(56,189,248,0.06)' }}>
                <div className="flex items-stretch">
                  <Link
                    href={`/kategori/${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex-1 flex items-center px-5 py-3 text-sm font-semibold border-l-4 transition-all duration-200 ${
                      active
                        ? 'border-red-500 text-red-400'
                        : 'border-transparent text-slate-400 hover:text-cyan-400 hover:border-cyan-500 hover:pl-6'
                    }`}
                  >
                    {cat.name}
                  </Link>
                  {hasChildren && (
                    <button
                      onClick={() => setExpandedCat(open ? null : cat.slug)}
                      className={`px-4 flex items-center transition-colors duration-200 ${
                        open ? 'text-cyan-400' : 'text-slate-500 hover:text-cyan-400'
                      }`}
                      aria-label={open ? 'Tutup' : 'Buka subkategori'}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>

                {hasChildren && (
                  <div
                    className={`mobile-sub-wrapper border-l-4 border-cyan-900 ml-5 ${open ? 'open' : 'closed'}`}
                    style={{ background: 'rgba(6,182,212,0.04)' }}
                  >
                    {cat.children.map((sub, si) => (
                      <Link
                        key={sub.slug}
                        href={`/kategori/${sub.slug}`}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm transition-all duration-150 ${
                          isActive(`/kategori/${sub.slug}`)
                            ? 'text-cyan-400 font-semibold'
                            : 'text-slate-500 hover:text-cyan-300 hover:pl-6'
                        }`}
                        style={open ? { transitionDelay: `${si * 20}ms` } : {}}
                      >
                        <span className={`w-1 h-1 rounded-full shrink-0 ${
                          isActive(`/kategori/${sub.slug}`) ? 'bg-cyan-400' : 'bg-slate-600'
                        }`} />
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer drawer */}
        <div className="px-5 py-4 text-xs text-slate-600"
          style={{ borderTop: '1px solid rgba(56,189,248,0.08)' }}>
          © {new Date().getFullYear()} JOBEN NEWS
        </div>
      </div>

      {/* Search Overlay */}
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
