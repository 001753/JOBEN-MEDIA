import Link from 'next/link';

export const metadata = { title: '404 — Halaman Tidak Ditemukan' };

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6">
        <span className="text-8xl md:text-9xl font-black text-gray-100 select-none">404</span>
      </div>
      <div className="w-16 h-1 bg-brand-700 rounded-full mb-6" />
      <h1 className="text-2xl md:text-3xl font-black text-dark mb-3">Halaman Tidak Ditemukan</h1>
      <p className="text-gray-400 text-base mb-8 max-w-md">
        Artikel atau halaman yang Anda cari tidak ada, telah dipindah, atau mungkin sudah dihapus.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="btn-primary rounded-full px-8"
        >
          ← Kembali ke Beranda
        </Link>
        <Link
          href="/cari"
          className="px-8 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-600 hover:border-brand-600 hover:text-brand-700 transition-colors"
        >
          Cari Berita
        </Link>
      </div>
    </div>
  );
}
