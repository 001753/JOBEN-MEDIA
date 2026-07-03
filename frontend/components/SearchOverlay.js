'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

/* ── Format tanggal relatif ────────────────────────────────────────────────── */
function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = (Date.now() - new Date(dateString)) / 1000;
  if (diff < 60)    return 'baru saja';
  if (diff < 3600)  return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateString));
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SearchOverlay({ open, onClose }) {
  const router = useRouter();

  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(-1);   // indeks item aktif (keyboard)
  const [searched, setSearched] = useState(false); // sudah pernah search?

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);
  const abortRef    = useRef(null);

  /* ── Fokus input saat overlay buka ────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTotal(0);
      setFocused(-1);
      setSearched(false);
      setTimeout(() => inputRef.current?.focus(), 60);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  /* ── Tutup dengan Escape ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* ── Debounced search ─────────────────────────────────────────────────── */
  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      setLoading(false);
      return;
    }

    // Batalkan request sebelumnya
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setFocused(-1);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}`,
        { signal: abortRef.current.signal }
      );
      if (!res.ok) throw new Error('fetch error');
      const json = await res.json();
      setResults(json.data ?? []);
      setTotal(json.meta?.pagination?.total ?? (json.data?.length ?? 0));
      setSearched(true);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setResults([]);
        setTotal(0);
        setSearched(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 320);
  }

  /* ── Keyboard navigation hasil ────────────────────────────────────────── */
  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused((f) => Math.min(f + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused((f) => Math.max(f - 1, -1));
    } else if (e.key === 'Enter') {
      if (focused >= 0 && results[focused]) {
        router.push(`/artikel/${results[focused].slug}`);
        onClose();
      } else if (query.trim().length >= 2) {
        router.push(`/cari?q=${encodeURIComponent(query.trim())}`);
        onClose();
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    router.push(`/cari?q=${encodeURIComponent(query.trim())}`);
    onClose();
  }

  if (!open) return null;

  return (
    /* ── Backdrop ─────────────────────────────────────────────────────────── */
    <div
      className="search-overlay-enter fixed inset-0 z-[200] flex flex-col items-center pt-16 sm:pt-24 px-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      <div
        className="search-panel-enter w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          {/* Ikon search */}
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Cari berita, topik, kategori…"
            autoComplete="off"
            className="flex-1 text-lg text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none"
          />

          {/* Spinner / ESC hint */}
          {loading ? (
            <svg className="w-5 h-5 text-red-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150 group"
              aria-label="Tutup pencarian"
            >
              <kbd className="px-1.5 py-0.5 bg-gray-100 group-hover:bg-gray-200 rounded text-[10px] font-mono transition-colors duration-150">
                ESC
              </kbd>
            </button>
          )}
        </form>

        {/* ── Hasil pencarian ─────────────────────────────────────────────── */}
        {results.length > 0 && (
          <ul className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto overscroll-contain">
            {results.map((article, idx) => {
              const imgUrl   = article.cover_image?.url ?? null;
              const catName  = article.category?.name ?? '';
              const catSlug  = article.category?.slug ?? '';
              const isFocused = focused === idx;

              return (
                <li key={article.documentId ?? article.id}>
                  <Link
                    href={`/artikel/${article.slug}`}
                    onClick={onClose}
                    className={`flex items-start gap-3 px-5 py-3.5 transition-colors duration-100 group ${
                      isFocused ? 'bg-red-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setFocused(idx)}
                  >
                    {/* Thumbnail */}
                    <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={article.title ?? ''}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Teks */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-snug line-clamp-2 transition-colors duration-100 ${
                        isFocused ? 'text-red-700' : 'text-gray-900 group-hover:text-red-700'
                      }`}>
                        {article.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        {catName && (
                          <>
                            <span className="bg-red-50 text-red-600 font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-[10px]">
                              {catName}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        <span>{timeAgo(article.publishedAt)}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <svg
                      className={`w-4 h-4 shrink-0 mt-1 transition-all duration-150 ${
                        isFocused ? 'text-red-500 translate-x-0' : 'text-gray-300 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'
                      }`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Footer: lihat semua / empty state / hint ───────────────────── */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          {searched && results.length === 0 && !loading ? (
            <p className="text-sm text-gray-500">
              Tidak ada hasil untuk <span className="font-semibold text-gray-700">"{query}"</span>
            </p>
          ) : searched && total > results.length ? (
            <p className="text-xs text-gray-400">
              Menampilkan {results.length} dari {total} hasil
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              Tekan <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono">↵</kbd> untuk cari · 
              gunakan <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono">↑↓</kbd> untuk navigasi
            </p>
          )}

          {searched && query.trim().length >= 2 && (
            <Link
              href={`/cari?q=${encodeURIComponent(query.trim())}`}
              onClick={onClose}
              className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors duration-150 flex items-center gap-1"
            >
              Lihat semua
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
