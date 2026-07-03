'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
   Scroll ke heading dengan offset untuk kompensasi sticky header (~90px)
   ────────────────────────────────────────────────────────────────────────── */
function scrollToHeading(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const HEADER_OFFSET = 96;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: 'smooth' });
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function TableOfContents({ headings = [] }) {
  const [activeId,  setActiveId]  = useState('');
  const [collapsed, setCollapsed] = useState(false);

  /* Map id → IntersectionObserverEntry, selalu up-to-date */
  const entriesRef = useRef({});
  const observerRef = useRef(null);

  /* ── IntersectionObserver: deteksi heading yang sedang dibaca ─────────── */
  const updateActive = useCallback(() => {
    /* Heading yang sedang terlihat di area atas viewport */
    const visible = headings.filter(
      (h) => entriesRef.current[h.id]?.isIntersecting
    );

    if (visible.length > 0) {
      setActiveId(visible[0].id);
      return;
    }

    /* Tidak ada yang intersecting → pakai heading terakhir yang sudah
       melewati atas viewport (user sedang di tengah section) */
    const passed = headings.filter((h) => {
      const e = entriesRef.current[h.id];
      return e && !e.isIntersecting && e.boundingClientRect.top < 120;
    });

    if (passed.length > 0) {
      setActiveId(passed[passed.length - 1].id);
    }
  }, [headings]);

  useEffect(() => {
    if (!headings.length) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entriesRef.current[entry.target.id] = entry;
        });
        updateActive();
      },
      {
        /* Heading dianggap "aktif" saat berada di 15% teratas viewport */
        rootMargin: '-80px 0px -65% 0px',
        threshold: 0,
      }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [headings, updateActive]);

  /* Tidak render jika artikel tidak punya cukup heading */
  if (headings.length < 2) return null;

  return (
    <div className="bg-white rounded-xl overflow-hidden toc-card" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>

      {/* ── Header toggle ───────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 group"
        aria-expanded={!collapsed}
        aria-controls="toc-list"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-brand-700 rounded-full" />
          <span className="text-[11px] font-black text-dark uppercase tracking-wider">Daftar Isi</span>
          <span className="text-[10px] text-gray-400 font-normal">
            ({headings.length} bagian)
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-transform duration-250 ${
            collapsed ? 'rotate-0' : 'rotate-180'
          }`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Daftar heading ──────────────────────────────────────────────── */}
      <div
        id="toc-list"
        className="toc-body overflow-hidden"
        style={{
          maxHeight: collapsed ? 0 : '400px',
          opacity: collapsed ? 0 : 1,
          transition: 'max-height 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease',
        }}
      >
        <nav className="p-3 overflow-y-auto" style={{ maxHeight: '380px' }}>
          <ol className="space-y-0.5">
            {headings.map(({ id, text, level }, idx) => {
              const isActive = activeId === id;

              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToHeading(id);
                    }}
                    title={text}
                    className={`
                      toc-item group flex items-start gap-2 rounded-lg py-1.5 text-[12.5px] leading-snug
                      transition-all duration-150 cursor-pointer select-none
                      ${level === 3 ? 'ml-3 px-2.5' : 'px-2.5'}
                      ${isActive
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }
                    `}
                  >
                    {/* Indikator aktif / nesting */}
                    <span className={`
                      shrink-0 mt-[5px] rounded-full transition-all duration-150
                      ${level === 3
                        ? `w-1 h-1 ${isActive ? 'bg-brand-600' : 'bg-gray-300 group-hover:bg-gray-400'}`
                        : `w-1.5 h-1.5 ${isActive ? 'bg-brand-700' : 'bg-gray-200 group-hover:bg-gray-400'}`
                      }
                    `} />

                    {/* Teks heading — terpotong jika terlalu panjang */}
                    <span className="line-clamp-2">{text}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Nomor aktif di footer */}
        {activeId && (
          <div className="px-4 pb-3 pt-0.5">
            <div className="h-px bg-gray-100 mb-2" />
            <p className="text-[10px] text-gray-400">
              Bagian{' '}
              <span className="font-semibold text-brand-600">
                {headings.findIndex((h) => h.id === activeId) + 1}
              </span>{' '}
              dari {headings.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
