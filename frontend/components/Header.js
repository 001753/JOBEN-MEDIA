'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Header({ categories = [] }) {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const [hoveredCat, setHoveredCat]   = useState(null);
  const [scrolled, setScrolled]       = useState(false);
  const [query, setQuery]             = useState('');
  const searchRef  = useRef(null);
  const hoverTimer = useRef(null);
  const pathname   = usePathname();
  const router     = useRouter();

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setExpandedCat(null);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/cari?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setQuery('');
  }

  function handleMouseEnter(slug) {
    clearTimeout(hoverTimer.current);
    setHoveredCat(slug);
  }

  function handleMouseLeave() {
    hoverTimer.current = setTimeout(() => setHoveredCat(null), 150);
  }

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-50">
      {/* ── Top brand bar ──────────────────────────────────────────────── */}
      <div className="bg-[#0a0a0a] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="bg-brand-700 text-white font-black text-lg px-2.5 py-0.5 rounded tracking-tight leading-none group-hover:bg-brand-800 transition-colors">
              JOBEN
            </span>
            <span className="font-bold text-white text-sm tracking-widest uppercase">NEWS</span>
          </Link>
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
            <span suppressHydrationWarning>
              {new Intl.DateTimeFormat('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'Asia/Jakarta',
              }).format(new Date())}
            </span>
          </div>
        </div>
      </div>

      {/* ── Nav bar ────────────────────────────────────────────────────── */}
      <div className={`bg-white border-b border-gray-200 transition-shadow duration-200 ${scrolled ? 'shadow-md' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-11 gap-1">

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0 scrollbar-none">
              <Link
                href="/"
                className={`px-3 py-2 text-sm font-semibold rounded transition-colors whitespace-nowrap ${
                  pathname === '/' ? 'text-brand-700 bg-brand-50' : 'text-gray-600 hover:text-brand-700 hover:bg-gray-50'
                }`}
              >
                Beranda
              </Link>

              {categories.map((cat) => {
                const hasChildren = cat.children?.length > 0;
                const active = isActive(`/kategori/${cat.slug}`);
                return (
                  <div
                    key={cat.slug}
                    className="relative"
                    onMouseEnter={() => hasChildren && handleMouseEnter(cat.slug)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <Link
                      href={`/kategori/${cat.slug}`}
                      className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded transition-colors whitespace-nowrap ${
                        active ? 'text-brand-700 bg-brand-50' : 'text-gray-600 hover:text-brand-700 hover:bg-gray-50'
                      }`}
                    >
                      {cat.name}
                      {hasChildren && (
                        <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </Link>

                    {/* Dropdown subkategori */}
                    {hasChildren && hoveredCat === cat.slug && (
                      <div
                        className="absolute top-full left-0 mt-0 bg-white border border-gray-100 rounded-xl shadow-xl py-3 z-50 min-w-[200px]"
                        onMouseEnter={() => handleMouseEnter(cat.slug)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <p className="px-4 pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 mb-1">
                          {cat.name}
                        </p>
                        {cat.children.map((sub) => (
                          <Link
                            key={sub.slug}
                            href={`/kategori/${sub.slug}`}
                            className={`block px-4 py-1.5 text-sm transition-colors whitespace-nowrap ${
                              isActive(`/kategori/${sub.slug}`)
                                ? 'text-brand-700 font-semibold bg-brand-50'
                                : 'text-gray-600 hover:text-brand-700 hover:bg-gray-50'
                            }`}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Search */}
            <div className="ml-auto flex items-center">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari berita..."
                    className="border border-gray-300 rounded-full px-4 py-1.5 text-sm w-48 md:w-64 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setQuery(''); }}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                    aria-label="Tutup pencarian"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-gray-500 hover:text-brand-700 transition-colors"
                  aria-label="Buka pencarian"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Mobile burger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700 ml-1"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ──────────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white max-h-[75vh] overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-0.5">
              <Link href="/" className="px-3 py-2 text-sm font-semibold text-gray-700 hover:text-brand-700 hover:bg-gray-50 rounded">
                Beranda
              </Link>
              {categories.map((cat) => {
                const hasChildren = cat.children?.length > 0;
                const open = expandedCat === cat.slug;
                return (
                  <div key={cat.slug}>
                    <div className="flex items-center">
                      <Link
                        href={`/kategori/${cat.slug}`}
                        className="flex-1 px-3 py-2 text-sm font-semibold text-gray-700 hover:text-brand-700 hover:bg-gray-50 rounded-l"
                      >
                        {cat.name}
                      </Link>
                      {hasChildren && (
                        <button
                          onClick={() => setExpandedCat(open ? null : cat.slug)}
                          className="px-2 py-2 text-gray-400 hover:text-brand-700"
                          aria-label={open ? 'Tutup' : 'Buka sub-kategori'}
                        >
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {hasChildren && open && (
                      <div className="ml-4 mb-1 border-l-2 border-brand-100 pl-3">
                        {cat.children.map((sub) => (
                          <Link
                            key={sub.slug}
                            href={`/kategori/${sub.slug}`}
                            className="block px-2 py-1.5 text-sm text-gray-500 hover:text-brand-700 hover:bg-gray-50 rounded"
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
