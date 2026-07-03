'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[JOBEN NEWS] Error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6">
        <span className="text-8xl md:text-9xl font-black text-gray-100 select-none">500</span>
      </div>
      <div className="w-16 h-1 bg-brand-700 rounded-full mb-6" />
      <h1 className="text-2xl md:text-3xl font-black text-dark mb-3">Terjadi Kesalahan</h1>
      <p className="text-gray-400 text-base mb-8 max-w-md">
        Kami mengalami masalah teknis. Tim kami sedang menangani hal ini. Silakan coba lagi.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={reset}
          className="btn-primary rounded-full px-8"
        >
          Coba Lagi
        </button>
        <Link
          href="/"
          className="px-8 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-600 hover:border-brand-600 hover:text-brand-700 transition-colors"
        >
          ← Beranda
        </Link>
      </div>
    </div>
  );
}
