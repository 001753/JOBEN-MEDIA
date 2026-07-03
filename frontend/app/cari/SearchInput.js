'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useRef, useTransition, useEffect, useState } from 'react';
import { trackSearch } from '@/lib/analytics';

/**
 * SearchInput — Client Component
 * - Debounce 500ms saat ngetik → otomatis push URL
 * - Tampilkan spinner saat loading (useTransition)
 * - Input menjaga posisi kursor
 */
export default function SearchInput({ defaultValue = '' }) {
  const router        = useRouter();
  const pathname      = usePathname();
  const searchParams  = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);
  const debounceRef   = useRef(null);
  const inputRef      = useRef(null);

  /* Sync value saat searchParams berubah (navigasi antar halaman) */
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setValue(q);
  }, [searchParams]);

  function pushSearch(q) {
    const params = new URLSearchParams(searchParams.toString());
    if (q.length >= 2) {
      params.set('q', q);
      params.delete('halaman');
      trackSearch(q);
    } else {
      params.delete('q');
      params.delete('halaman');
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleChange(e) {
    const q = e.target.value;
    setValue(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushSearch(q.trim()), 500);
  }

  function handleSubmit(e) {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    pushSearch(value.trim());
  }

  function handleClear() {
    setValue('');
    pushSearch('');
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8" role="search">
      <div className="flex gap-3 max-w-2xl">
        <div className="relative flex-1">
          {/* Icon search */}
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {isPending ? (
              <svg className="w-4 h-4 text-red-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          <input
            ref={inputRef}
            type="search"
            name="q"
            value={value}
            onChange={handleChange}
            placeholder="Cari berita, topik, atau kata kunci…"
            autoComplete="off"
            autoFocus={!defaultValue}
            className="w-full border border-gray-300 rounded-xl pl-11 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
            aria-label="Kata kunci pencarian"
          />

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Hapus pencarian"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Cari
        </button>
      </div>
    </form>
  );
}
