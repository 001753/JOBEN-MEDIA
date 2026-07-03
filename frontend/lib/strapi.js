'use strict';

const STRAPI_API_URL = process.env.STRAPI_API_URL || 'http://localhost:3001';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

const DEFAULT_REVALIDATE = 60;

async function fetchStrapi(path, params = {}, options = {}) {
  const url = new URL(`${STRAPI_API_URL}/api${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const headers = { 'Content-Type': 'application/json' };
  if (STRAPI_API_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;

  try {
    let res = await fetch(url.toString(), {
      headers,
      next: { revalidate: options.revalidate ?? DEFAULT_REVALIDATE },
      ...options.fetchOptions,
      signal: AbortSignal.timeout(10000),
    });

    // Jika token invalid (401), coba ulang tanpa token (public API)
    if (res.status === 401 && STRAPI_API_TOKEN) {
      const publicHeaders = { 'Content-Type': 'application/json' };
      res = await fetch(url.toString(), {
        headers: publicHeaders,
        next: { revalidate: options.revalidate ?? DEFAULT_REVALIDATE },
        ...options.fetchOptions,
        signal: AbortSignal.timeout(10000),
      });
    }

    if (!res.ok) {
      console.error(`[strapi] ${res.status} ${res.statusText} — ${url.toString()}`);
      return null;
    }

    return res.json();
  } catch (err) {
    // Graceful fallback — jangan crash Next.js saat Strapi belum ready atau down
    if (err.name !== 'AbortError') {
      console.warn(`[strapi] Tidak dapat terhubung ke Strapi (${STRAPI_API_URL}): ${err.message}`);
    }
    return null;
  }
}

function buildArticleFilters(extra = {}) {
  return {
    'filters[editorial_status][$eq]': 'published',
    ...extra,
  };
}

const ARTICLE_POPULATE =
  'populate[cover_image]=true&populate[category][fields][0]=name&populate[category][fields][1]=slug&populate[tags][fields][0]=name&populate[tags][fields][1]=slug&populate[author][fields][0]=name&populate[author][fields][1]=role_label&populate[author][populate][photo]=true';

export async function getLatestArticles(limit = 10, page = 1) {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[editorial_status][$eq]': 'published',
      'sort[0]': 'publishedAt:desc',
      'pagination[page]': page,
      'pagination[pageSize]': limit,
    },
    { revalidate: 60 }
  );
  return res ?? { data: [], meta: { pagination: { total: 0, pageCount: 0 } } };
}

export async function getBreakingNews() {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[editorial_status][$eq]': 'published',
      'filters[is_breaking_news][$eq]': 'true',
      'sort[0]': 'breaking_news_priority:desc',
      'sort[1]': 'publishedAt:desc',
      'pagination[pageSize]': 1,
    },
    { revalidate: 30 }
  );
  return res?.data?.[0] ?? null;
}

export async function getHeroArticles(limit = 5) {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[editorial_status][$eq]': 'published',
      'sort[0]': 'publishedAt:desc',
      'pagination[pageSize]': limit,
    },
    { revalidate: 60 }
  );
  return res?.data ?? [];
}

export async function getPopularArticles(limit = 5) {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[editorial_status][$eq]': 'published',
      'sort[0]': 'publishedAt:desc',
      'pagination[pageSize]': limit,
    },
    { revalidate: 120 }
  );
  return res?.data ?? [];
}

export async function getArticlesByCategory(categorySlug, page = 1, pageSize = 12) {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[editorial_status][$eq]': 'published',
      'filters[category][slug][$eq]': categorySlug,
      'sort[0]': 'publishedAt:desc',
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
    },
    { revalidate: 60 }
  );
  return res ?? { data: [], meta: { pagination: { total: 0, pageCount: 0, page: 1 } } };
}

export async function getArticleBySlug(slug) {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[slug][$eq]': slug,
      'filters[editorial_status][$eq]': 'published',
      'pagination[pageSize]': 1,
    },
    { revalidate: 60 }
  );
  return res?.data?.[0] ?? null;
}

export async function getRelatedArticles(categorySlug, currentSlug, limit = 4) {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[editorial_status][$eq]': 'published',
      'filters[category][slug][$eq]': categorySlug,
      'filters[slug][$ne]': currentSlug,
      'sort[0]': 'publishedAt:desc',
      'pagination[pageSize]': limit,
    },
    { revalidate: 120 }
  );
  return res?.data ?? [];
}

export async function searchArticles(keyword, page = 1, pageSize = 20) {
  // Gunakan _q (Strapi full-text search) → jauh lebih cepat dari $containsi
  // PostgreSQL prod: pakai FTS index; SQLite dev: still works
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      '_q': keyword,
      'filters[editorial_status][$eq]': 'published',
      'sort[0]': 'publishedAt:desc',
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
    },
    { fetchOptions: { cache: 'no-store' } }
  );
  return res ?? { data: [], meta: { pagination: { total: 0, pageCount: 0 } } };
}

export async function getCategories() {
  const res = await fetchStrapi(
    '/categories',
    {
      'filters[parent][$null]': 'true',
      'sort[0]': 'name:asc',
      'pagination[pageSize]': 50,
      'populate[children][fields][0]': 'name',
      'populate[children][fields][1]': 'slug',
      'populate[children][sort]': 'name:asc',
    },
    { revalidate: 300 }
  );
  return res?.data ?? [];
}

export async function getCategoryBySlug(slug) {
  const res = await fetchStrapi(
    '/categories',
    {
      'filters[slug][$eq]': slug,
      'pagination[pageSize]': 1,
      'populate[parent][fields][0]': 'name',
      'populate[parent][fields][1]': 'slug',
      'populate[children][fields][0]': 'name',
      'populate[children][fields][1]': 'slug',
      'populate[children][sort]': 'name:asc',
    },
    { revalidate: 300 }
  );
  return res?.data?.[0] ?? null;
}

export async function getAllTags() {
  const res = await fetchStrapi(
    '/tags',
    {
      'sort[0]': 'name:asc',
      'pagination[pageSize]': 100,
    },
    { revalidate: 300 }
  );
  return res?.data ?? [];
}

export async function getTagBySlug(slug) {
  const res = await fetchStrapi(
    '/tags',
    {
      'filters[slug][$eq]': slug,
      'pagination[pageSize]': 1,
    },
    { revalidate: 120 }
  );
  return res?.data?.[0] ?? null;
}

export async function getArticlesByTag(tagSlug, page = 1, pageSize = 20) {
  const res = await fetchStrapi(
    `/articles?${ARTICLE_POPULATE}`,
    {
      'filters[editorial_status][$eq]': 'published',
      'filters[tags][slug][$eq]': tagSlug,
      'sort[0]': 'publishedAt:desc',
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
    },
    { revalidate: 60 }
  );
  return res ?? { data: [], meta: { pagination: { total: 0, pageCount: 0, page: 1 } } };
}

export async function getPageBySlug(slug) {
  const res = await fetchStrapi(
    '/pages',
    {
      'filters[slug][$eq]': slug,
      'populate[content]=true': '',
      'pagination[pageSize]': 1,
    },
    { revalidate: 600 }
  );
  return res?.data?.[0] ?? null;
}

export async function getAuthors() {
  const res = await fetchStrapi(
    '/authors',
    {
      'populate[photo]=true': '',
      'sort[0]': 'name:asc',
      'pagination[pageSize]': 50,
    },
    { revalidate: 300 }
  );
  return res?.data ?? [];
}

export async function getCategoryHomeSections(categories, articlesPerSection = 5) {
  const results = await Promise.all(
    categories.slice(0, 6).map(async (cat) => {
      const data = await getArticlesByCategory(cat.slug, 1, articlesPerSection);
      return { category: cat, articles: data.data };
    })
  );
  return results.filter((s) => s.articles.length > 0);
}

export function getImageUrl(media) {
  if (!media) return null;
  if (typeof media === 'string') return media;
  return media.url ?? null;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString) {
  if (!dateString) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}
