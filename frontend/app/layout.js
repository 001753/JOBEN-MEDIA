import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCategories, getBreakingNews } from '@/lib/strapi';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'JOBEN NEWS — Berita Terkini Indonesia',
    template: '%s | JOBEN NEWS',
  },
  description:
    'Portal berita terkini Indonesia. Liputan mendalam, akurat, dan terpercaya seputar nasional, ekonomi, olahraga, teknologi, dan hiburan.',
  keywords: ['berita', 'news', 'indonesia', 'terkini', 'joben news'],
  authors: [{ name: 'Redaksi JOBEN NEWS' }],
  creator: 'JOBEN NEWS',
  publisher: 'JOBEN NEWS',
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: SITE_URL,
    siteName: 'JOBEN NEWS',
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@jobennews',
  },
  robots: { index: true, follow: true },
};

export const revalidate = 60;

export default async function RootLayout({ children }) {
  const [categories, breakingNews] = await Promise.all([
    getCategories(),
    getBreakingNews(),
  ]);

  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen flex flex-col">
        <Header categories={categories} breakingNews={breakingNews} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} />
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
