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
  const [expandedCat, setExpandedCat] = useState(null); // mobile accordion
  const [activeMenu,  setActiveMenu]  = useState(null); // desktop mega-menu
  const [scrolled,    setScrolled]    = useState(false);
  const [query,       setQuery]       = useState('');

  const closeTimer  = useRef(null);
  const pathname    = usePathname();
  const router      = useRouter();

  /* tutup semua saat navigasi */
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setExpandedCat(null);
    setActiveMenu(null);
  }, [pathname]);

  /* shadow on scroll */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* lock body scroll saat mobile menu buka */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const openMenu  = useCallback((slug) => {
    clearTimeout(closeTimer.current);
    setActiveMenu(slug);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setActiveMenu(null), 120);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/cari?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setQuery('');
  }

  const isActive = (href) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP OVERLAY: klik di luar tutup menu
      ════════════════════════════════════════════════════════════════════ */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveMenu(null)}
        />
      )}

      <header className={`sticky top-0 z-50 transition-shadow duration-300 ${scrolled ? 'shadow-lg' : ''}`}>

        {/* ══ Brand bar hitam ══════════════════════════════════════════════ */}
        <div className="bg-[#0a0a0a] text-white">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 flex items-center justify-between h-[46px]">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <span className="bg-red-600 text-white font-black text-xl px-3 py-0.5 rounded-sm tracking-tight leading-none group-hover:bg-red-700 transition-colors duration-200 select-none">
                JOBEN
              </span>
              <span className="font-bold text-white text-sm tracking-[0.2em] uppercase hidden sm:inline">
                NEWS
              </span>
            </Link>

            {/* Breaking news badge — muncul jika ada artikel breaking */}
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
                <span className="text-gray-300 text-xs font-medium truncate group-hover:text-white transition-colors duration-200">
                  {breakingNews.title}
                </span>
              </Link>
            )}

            {/* Kanan: tanggal + search desktop */}
            <div className="flex items-center gap-4 ml-auto">
              <span className="hidden lg:block text-xs text-gray-400 tabular-nums" suppressHydrationWarning>
                {new Intl.DateTimeFormat('id-ID', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  timeZone: 'Asia/Jakarta',
                }).format(new Date())}
              </span>

              {/* Tombol Cari — membuka SearchOverlay */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors duration-200 text-xs group"
                aria-label="Cari berita"
              >
                <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden lg:inline">Cari</span>
              </button>

              {/* Toggle dark/light mode */}
              <ThemeToggle />

              {/* Hamburger mobile */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-1 text-gray-300 hover:text-white transition-colors duration-200"
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
        </div>

        {/* ══ Nav bar putih — DESKTOP ONLY ════════════════════════════════ */}
        <div className="hidden md:block bg-white border-b border-gray-200">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
            <nav className="flex items-stretch h-10" aria-label="Navigasi utama">

              {/* Beranda */}
              <Link
                href="/"
                className={`nav-item-link flex items-center px-3 text-[11px] font-bold uppercase tracking-wide border-b-2 whitespace-nowrap ${
                  pathname === '/'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-600 hover:text-red-600 hover:border-red-400'
                }`}
              >
                Beranda
              </Link>

              {/* Divider */}
              <div className="w-px bg-gray-100 my-2 mx-0.5" />

              {categories.map((cat, idx) => {
                const hasChildren = (cat.children?.length ?? 0) > 0;
                const active      = isActive(`/kategori/${cat.slug}`);
                const menuOpen    = activeMenu === cat.slug;
                const cols        = hasChildren ? chunkArray(cat.children, 5) : [];
                /* item di 3 terakhir → dropdown right-align agar tidak keluar layar */
                const alignRight  = idx >= categories.length - 3;

                return (
                  <div
                    key={cat.slug}
                    className="relative flex items-stretch"
                    onMouseEnter={() => hasChildren ? openMenu(cat.slug) : setActiveMenu(null)}
                    onMouseLeave={scheduleClose}
                  >
                    {/* Nav item */}
                    <Link
                      href={`/kategori/${cat.slug}`}
                      className={`nav-item-link flex items-center gap-1 px-3 text-[11px] font-bold uppercase tracking-wide border-b-2 whitespace-nowrap ${
                        active
                          ? 'border-red-600 text-red-600'
                          : menuOpen
                          ? 'border-red-400 text-red-600'
                          : 'border-transparent text-gray-600 hover:text-red-600 hover:border-red-400'
                      }`}
                    >
                      {navLabel(cat)}
                      {hasChildren && (
                        <svg
                          className={`w-2.5 h-2.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </Link>

                    {/* ── Mega-menu / dropdown ──────────────────────────────── */}
                    {hasChildren && menuOpen && (
                      <div
                        key={`menu-${cat.slug}`}
                        className={`nav-dropdown-enter absolute top-full z-50 bg-white border border-gray-200 shadow-2xl rounded-b-xl overflow-hidden ${
                          alignRight ? 'right-0' : 'left-0'
                        }`}
                        style={{ minWidth: cols.length > 1 ? `${cols.length * 180}px` : '200px' }}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                      >
                        {/* Header merah */}
                        <div className="bg-red-600 px-4 py-2 flex items-center justify-between">
                          <span className="text-white font-black text-[10px] uppercase tracking-widest">
                            {cat.name}
                          </span>
                          <Link
                            href={`/kategori/${cat.slug}`}
                            className="text-red-100 hover:text-white text-[10px] font-semibold transition-colors duration-150"
                          >
                            Lihat semua →
                          </Link>
                        </div>

                        {/* Grid subkategori */}
                        <div className="flex gap-0 divide-x divide-gray-100">
                          {cols.map((col, ci) => (
                            <div key={ci} className="flex flex-col py-2 min-w-[175px]">
                              {col.map((sub, si) => (
                                <Link
                                  key={sub.slug}
                                  href={`/kategori/${sub.slug}`}
                                  className={`nav-sub-item px-4 py-2 text-[12px] flex items-center gap-2 group ${
                                    isActive(`/kategori/${sub.slug}`)
                                      ? 'text-red-600 font-bold bg-red-50'
                                      : 'text-gray-700 hover:text-red-600 hover:bg-gray-50'
                                  }`}
                                  style={{ animationDelay: `${(ci * col.length + si) * 28}ms` }}
                                >
                                  <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-red-500 transition-colors duration-200 shrink-0" />
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
          MOBILE DRAWER — slide in dari kiri
      ════════════════════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 left-0 z-[70] h-full w-[320px] max-w-[85vw] bg-white shadow-2xl flex flex-col md:hidden
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="bg-[#0a0a0a] flex items-center justify-between px-4 h-[46px] shrink-0">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
            <span className="bg-red-600 text-white font-black text-lg px-2.5 py-0.5 rounded-sm">JOBEN</span>
            <span className="text-white font-bold text-xs tracking-widest">NEWS</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 text-gray-300 hover:text-white transition-colors duration-200"
            aria-label="Tutup menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search mobile */}
        <div className="px-4 py-3 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari berita…"
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200"
            />
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 transition-colors duration-200">
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
                ? 'border-red-600 text-red-600 bg-red-50'
                : 'border-transparent text-gray-800 hover:text-red-600 hover:bg-gray-50 hover:border-red-200 hover:pl-6'
            }`}
          >
            Beranda
          </Link>

          {categories.map((cat) => {
            const hasChildren = (cat.children?.length ?? 0) > 0;
            const open        = expandedCat === cat.slug;
            const active      = isActive(`/kategori/${cat.slug}`);

            return (
              <div key={cat.slug} className="border-t border-gray-50">
                <div className="flex items-stretch">
                  {/* Link nama kategori */}
                  <Link
                    href={`/kategori/${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex-1 flex items-center px-5 py-3 text-sm font-semibold border-l-4 transition-all duration-200 ${
                      active
                        ? 'border-red-600 text-red-600 bg-red-50'
                        : 'border-transparent text-gray-800 hover:text-red-600 hover:bg-gray-50 hover:border-red-200 hover:pl-6'
                    }`}
                  >
                    {cat.name}
                  </Link>
                  {/* Tombol expand */}
                  {hasChildren && (
                    <button
                      onClick={() => setExpandedCat(open ? null : cat.slug)}
                      className={`px-4 flex items-center transition-colors duration-200 ${
                        open ? 'text-red-600' : 'text-gray-400 hover:text-red-600'
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

                {/* Sub-kategori list — smooth height transition */}
                {hasChildren && (
                  <div className={`mobile-sub-wrapper bg-gray-50 border-l-4 border-red-200 ml-5 ${open ? 'open' : 'closed'}`}>
                    {cat.children.map((sub, si) => (
                      <Link
                        key={sub.slug}
                        href={`/kategori/${sub.slug}`}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm transition-all duration-150 ${
                          isActive(`/kategori/${sub.slug}`)
                            ? 'text-red-600 font-semibold bg-red-50'
                            : 'text-gray-600 hover:text-red-600 hover:bg-white hover:pl-6'
                        }`}
                        style={open ? { transitionDelay: `${si * 20}ms` } : {}}
                      >
                        <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
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
        <div className="px-5 py-4 border-t border-gray-100 text-xs text-gray-400">
          © {new Date().getFullYear()} JOBEN NEWS
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SEARCH OVERLAY — fullscreen, real-time results
      ════════════════════════════════════════════════════════════════════ */}
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
