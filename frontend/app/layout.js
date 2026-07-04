import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCategories, getBreakingNews } from '@/lib/strapi';
import Script from 'next/script';
import BackToTop from '@/components/BackToTop';
import NavigationProgress from '@/components/NavigationProgress';
import PageTransition from '@/components/PageTransition';
import AnimatedBackground from '@/components/AnimatedBackground';
import TechGrid from '@/components/TechGrid';

const ANTI_FOUC = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';
const GA_ID    = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:  'JOBEN NEWS — Berita Terkini Indonesia',
    template: '%s | JOBEN NEWS',
  },
  description:
    'Portal berita terkini Indonesia. Liputan mendalam, akurat, dan terpercaya seputar nasional, ekonomi, olahraga, teknologi, dan hiburan.',
  keywords: ['berita', 'news', 'indonesia', 'terkini', 'joben news'],
  authors:   [{ name: 'Redaksi JOBEN NEWS' }],
  creator:   'JOBEN NEWS',
  publisher: 'JOBEN NEWS',
  openGraph: {
    type:      'website',
    locale:    'id_ID',
    url:       SITE_URL,
    siteName:  'JOBEN NEWS',
    images:    [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@jobennews' },
  robots:  { index: true, follow: true },
};

export const revalidate = 60;

export default async function RootLayout({ children }) {
  const [categories, breakingNews] = await Promise.all([
    getCategories(),
    getBreakingNews(),
  ]);

  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_FOUC }} suppressHydrationWarning />
      </head>
      <body className="min-h-screen flex flex-col" style={{ background: '#020817' }}>
        {/* Fixed animated layers — below all content */}
        <AnimatedBackground />
        <TechGrid />

        {/* App shell — above canvas layers */}
        <div className="relative z-10 flex flex-col min-h-screen">
          <NavigationProgress />
          <Header categories={categories} breakingNews={breakingNews} />
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer categories={categories} />
          <BackToTop />
        </div>

        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
