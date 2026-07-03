'use client';

import { trackShareClick } from '@/lib/analytics';

const NETWORKS = (encoded, encodedTitle) => [
  {
    name: 'Facebook',
    href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    bg: 'bg-blue-600 hover:bg-blue-700',
    icon: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
  },
  {
    name: 'Twitter',
    href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`,
    bg: 'bg-sky-500 hover:bg-sky-600',
    icon: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z',
  },
  {
    name: 'WhatsApp',
    href: `https://wa.me/?text=${encodedTitle}%20${encoded}`,
    bg: 'bg-green-600 hover:bg-green-700',
    icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M11.5 2C6.253 2 2 6.477 2 12.018c0 1.76.455 3.408 1.252 4.846L2 22l5.293-1.38A9.945 9.945 0 0011.5 22C16.747 22 17.523 17.523 21 12.018 21 6.477 16.747 2 11.5 2z',
  },
  {
    name: 'Telegram',
    href: `https://t.me/share/url?url=${encoded}&text=${encodedTitle}`,
    bg: 'bg-sky-400 hover:bg-sky-500',
    icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  },
];

export default function ShareButtons({ url, title, slug, large = false }) {
  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const iconClass = large ? 'w-5 h-5' : 'w-4 h-4';
  const btnClass = large ? 'p-2.5' : 'p-2';
  const networks = NETWORKS(encoded, encodedTitle);

  return (
    <div className="flex items-center gap-2">
      {networks.map(({ name, href, bg, icon }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Bagikan ke ${name}`}
          onClick={() => trackShareClick(name, slug ?? url)}
          className={`${bg} text-white ${btnClass} rounded-full transition-colors`}
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
          </svg>
        </a>
      ))}
    </div>
  );
}
