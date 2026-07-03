'use client';

import { useState, useEffect, useCallback } from 'react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = useCallback(() => {
    setLeaving(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setLeaving(false), 500);
  }, []);

  return (
    <button
      onClick={handleClick}
      aria-label="Kembali ke atas"
      className={`fixed bottom-6 right-6 z-[150] w-11 h-11 rounded-full bg-red-600 text-white shadow-lg
        flex items-center justify-center
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        hover:bg-red-700 hover:shadow-xl hover:-translate-y-1 hover:scale-110
        active:scale-95
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
        ${leaving ? 'scale-90' : ''}
      `}
    >
      {/* Ripple ring on hover */}
      <span className="absolute inset-0 rounded-full ring-0 ring-red-400 transition-all duration-300 group-hover:ring-4 group-hover:ring-offset-2" />

      {/* Arrow icon */}
      <svg
        className="w-5 h-5 transition-transform duration-200 group-hover:-translate-y-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
