import { NextResponse } from 'next/server';

const STRAPI_API_URL   = process.env.STRAPI_API_URL   || 'http://localhost:3001';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

const POPULATE =
  'populate[cover_image]=true' +
  '&populate[category][fields][0]=name' +
  '&populate[category][fields][1]=slug' +
  '&populate[author][fields][0]=name';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json({ data: [], meta: { pagination: { total: 0 } } });
  }

  const url = new URL(`${STRAPI_API_URL}/api/articles?${POPULATE}`);
  url.searchParams.set('_q', q);
  url.searchParams.set('filters[editorial_status][$eq]', 'published');
  url.searchParams.set('sort[0]', 'publishedAt:desc');
  url.searchParams.set('pagination[pageSize]', '7');

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (STRAPI_API_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;

    const res = await fetch(url.toString(), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ data: [], meta: { pagination: { total: 0 } } });
    }

    const data = await res.json();
    return NextResponse.json(data ?? { data: [], meta: { pagination: { total: 0 } } });
  } catch {
    return NextResponse.json({ data: [], meta: { pagination: { total: 0 } } });
  }
}
