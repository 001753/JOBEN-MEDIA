'use client';

import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [dark, setDark]       = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    const html   = document.documentElement;
    const isDark = html.classList.toggle('dark');
    setDark(isDark);
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
  }

  if (!mounted) {
    return <div className="w-8 h-8 rounded-full shrink-0" aria-hidden="true" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Mode Terang' : 'Mode Gelap'}
      title={dark ? 'Mode Terang' : 'Mode Gelap'}
      className="theme-toggle-btn relative w-8 h-8 rounded-full flex items-center justify-center shrink-0"
    >
      {/* Matahari */}
      <svg
        className={`absolute w-4 h-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          dark ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
        }`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
      >
        <circle cx="12" cy="12" r="5" />
        <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>

      {/* Bulan */}
      <svg
        className={`absolute w-4 h-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          dark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
        }`}
        fill="currentColor" viewBox="0 0 24 24"
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
}
