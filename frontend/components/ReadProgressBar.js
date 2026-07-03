'use client';

import { useState, useEffect } from 'react';

export default function ReadProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible]   = useState(false);

  useEffect(() => {
    function onScroll() {
      const scrollTop    = window.scrollY;
      const docHeight    = document.documentElement.scrollHeight - window.innerHeight;
      const pct          = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;

      setProgress(pct);
      setVisible(scrollTop > 80);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`fixed top-0 left-0 right-0 z-[200] h-[3px] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Track */}
      <div className="absolute inset-0 bg-gray-200/40" />

      {/* Fill — GPU-accelerated via scaleX */}
      <div
        className="absolute inset-0 bg-red-600 origin-left"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: 'transform 0.1s linear',
        }}
      />

      {/* Glow di ujung bar */}
      <div
        className="absolute top-0 h-full w-8 bg-red-400/60 blur-sm origin-left"
        style={{
          left: `calc(${progress}% - 2rem)`,
          opacity: progress > 2 && progress < 99 ? 1 : 0,
          transition: 'left 0.1s linear, opacity 0.2s ease',
        }}
      />
    </div>
  );
}
