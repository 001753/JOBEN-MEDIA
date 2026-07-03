'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Header({ categories = [] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [query, setQuery]           = useState('');
  const searchRef = useRef(null);
  const pathname  = usePathname();
  const router    = useRouter();

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
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

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-50">
      {/* Top brand bar */}
      <div className="bg-[#0a0a0a] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="bg-brand-700 text-white font-black text-lg px-2.5 py-0.5 rounded tracking-tight leading-none group-hover:bg-brand-800 transition-colors">
              JOBEN
            </span>
            <span className="font-bold text-white text-sm tracking-widest uppercase">NEWS</span>
          </Link>

          {/* Desktop top-right */}
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
            <span id="live-date" suppressHydrationWarning>
              {new Intl.DateTimeFormat('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'Asia/Jakarta',
              }).format(new Date())}
            </span>
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <div
        className={`bg-white border-b border-gray-200 transition-shadow duration-200 ${
          scrolled ? 'shadow-md' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-11 gap-1">
            {/* Categories */}
            <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0 scrollbar-none">
              <Link
                href="/"
                className={`px-3 py-2 text-sm font-semibold rounded transition-colors whitespace-nowrap ${
                  pathname === '/'
                    ? 'text-brand-700 bg-brand-50'
                    : 'text-gray-600 hover:text-brand-700 hover:bg-gray-50'
                }`}
              >
                Beranda
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/kategori/${cat.slug}`}
                  className={`px-3 py-2 text-sm font-semibold rounded transition-colors whitespace-nowrap ${
                    isActive(`/kategori/${cat.slug}`)
                      ? 'text-brand-700 bg-brand-50'
                      : 'text-gray-600 hover:text-brand-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Search */}
            <div className="ml-auto flex items-center">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center gap-2 animate-fade-in">
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

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white animate-fade-in">
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              <Link href="/" className="px-3 py-2 text-sm font-semibold text-gray-700 hover:text-brand-700 hover:bg-gray-50 rounded">
                Beranda
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/kategori/${cat.slug}`}
                  className="px-3 py-2 text-sm font-semibold text-gray-700 hover:text-brand-700 hover:bg-gray-50 rounded"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
