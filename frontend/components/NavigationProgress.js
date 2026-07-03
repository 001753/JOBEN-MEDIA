'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'loading' | 'completing' | 'done'
  const intervalRef = useRef(null);
  const doneTimerRef = useRef(null);
  const isFirstRender = useRef(true);

  /* ── Mulai progress saat link diklik ─────────────────────────────────── */
  useEffect(() => {
    function handleClick(e) {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('http://') ||
        href.startsWith('https://')
      ) return;

      startProgress();
    }

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  /* ── Selesai saat pathname berubah (navigasi selesai) ───────────────── */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    completeProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* ── Cleanup ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(doneTimerRef.current);
    };
  }, []);

  function startProgress() {
    clearInterval(intervalRef.current);
    clearTimeout(doneTimerRef.current);

    setPhase('loading');
    setProgress(0);

    let current = 0;
    intervalRef.current = setInterval(() => {
      // Melambat saat mendekati 85%
      const increment = Math.max((85 - current) * 0.09, 0.4);
      current = Math.min(current + increment, 85);
      setProgress(current);
      if (current >= 84.9) clearInterval(intervalRef.current);
    }, 60);
  }

  function completeProgress() {
    clearInterval(intervalRef.current);
    setPhase('completing');
    setProgress(100);

    doneTimerRef.current = setTimeout(() => {
      setPhase('done');
      doneTimerRef.current = setTimeout(() => {
        setPhase('idle');
        setProgress(0);
      }, 200);
    }, 300);
  }

  if (phase === 'idle') return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: phase === 'done' ? 0 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Bar utama */}
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #c10f0f 0%, #e51717 60%, #ff4444 100%)',
          transition: phase === 'completing'
            ? 'width 0.25s cubic-bezier(0.4,0,0.2,1)'
            : 'width 0.06s linear',
          boxShadow: '2px 0 12px 2px rgba(193,15,15,0.55)',
          borderRadius: '0 2px 2px 0',
        }}
      />
      {/* Titik terang di ujung */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${progress}%`,
          transform: 'translate(-50%, -50%)',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#ff6666',
          boxShadow: '0 0 8px 4px rgba(255,100,100,0.7)',
          opacity: progress > 0 && progress < 100 ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      />
    </div>
  );
}
