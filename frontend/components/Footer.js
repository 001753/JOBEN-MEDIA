import Link from 'next/link';

export default function Footer({ categories = [] }) {
  const year = new Date().getFullYear();

  const pages = [
    { label: 'Tentang Kami', href: '/tentang-kami' },
    { label: 'Redaksi', href: '/redaksi' },
    { label: 'Kebijakan Privasi', href: '/kebijakan-privasi' },
    { label: 'Pedoman Siber', href: '/pedoman-siber' },
    { label: 'Kontak', href: '/kontak' },
  ];

  return (
    <footer className="bg-[#0a0a0a] text-gray-300 mt-12">
      {/* Top section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <span className="bg-brand-700 text-white font-black text-xl px-2.5 py-1 rounded">JOBEN</span>
              <span className="font-bold text-white text-sm tracking-widest uppercase">NEWS</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">
              Portal berita terkini Indonesia. Liputan mendalam, akurat, dan terpercaya.
            </p>
          </div>

          {/* Kategori */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Kategori</h3>
            <ul className="space-y-2">
              {categories.slice(0, 8).map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/kategori/${cat.slug}`}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Halaman */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Tentang</h3>
            <ul className="space-y-2">
              {pages.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak & Sosmed */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Ikuti Kami</h3>
            <div className="flex gap-3 mb-4">
              {[
                { label: 'Facebook', href: '#', icon: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z' },
                { label: 'Twitter/X', href: '#', icon: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z' },
                { label: 'Instagram', href: '#', icon: 'M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01M6.5 19.5h11a3 3 0 003-3v-11a3 3 0 00-3-3h-11a3 3 0 00-3 3v11a3 3 0 003 3z' },
                { label: 'YouTube', href: '#', icon: 'M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58zM10 15.5V8.5l6 3.5z' },
              ].map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="bg-gray-800 hover:bg-brand-700 p-2 rounded-full transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                </a>
              ))}
            </div>
            <p className="text-gray-400 text-xs">
              Redaksi:{' '}
              <a href="mailto:redaksi@jobenapp.cloud" className="hover:text-white transition-colors">
                redaksi@jobenapp.cloud
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <p>© {year} JOBEN NEWS. Hak cipta dilindungi undang-undang.</p>
          <p>
            Dibuat dengan ❤ di Indonesia &nbsp;·&nbsp;{' '}
            <Link href="/kebijakan-privasi" className="hover:text-gray-300">Privasi</Link>
            {' '}·{' '}
            <Link href="/pedoman-siber" className="hover:text-gray-300">Pedoman Siber</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
