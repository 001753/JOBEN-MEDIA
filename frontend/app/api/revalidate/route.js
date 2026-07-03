import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || token !== REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { model, slug, categorySlug } = body ?? {};

  try {
    if (model === 'article' || model === 'article.article') {
      revalidatePath('/', 'page');

      if (slug) {
        revalidatePath(`/artikel/${slug}`, 'page');
      }

      if (categorySlug) {
        revalidatePath(`/kategori/${categorySlug}`, 'page');
      }

      revalidatePath('/sitemap.xml');
    }

    if (model === 'category' || model === 'api::category.category') {
      revalidatePath('/', 'layout');
    }

    if (model === 'page' || model === 'api::page.page') {
      if (slug) {
        revalidatePath(`/${slug}`, 'page');
      }
    }

    return NextResponse.json({
      revalidated: true,
      model,
      slug,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[revalidate] Error:', err.message);
    return NextResponse.json({ error: 'Revalidation failed', detail: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Revalidation endpoint aktif.' });
}
