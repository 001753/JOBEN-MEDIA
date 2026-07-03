import { getLatestArticles, getCategories } from '@/lib/strapi';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://news.jobenapp.cloud';

export const revalidate = 3600;

export default async function sitemap() {
  const staticPages = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/redaksi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/tentang-kami`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/kebijakan-privasi`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/kontak`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const [articlesResult, categories] = await Promise.all([
    getLatestArticles(200, 1),
    getCategories(),
  ]);

  const articleUrls = (articlesResult?.data ?? []).map((article) => ({
    url: `${SITE_URL}/artikel/${article.slug}`,
    lastModified: new Date(article.updatedAt ?? article.publishedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const categoryUrls = categories.map((cat) => ({
    url: `${SITE_URL}/kategori/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.7,
  }));

  return [...staticPages, ...categoryUrls, ...articleUrls];
}
