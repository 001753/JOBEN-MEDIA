import { notFound } from 'next/navigation';
import { getPageBySlug } from '@/lib/strapi';
import BlocksRenderer from '@/components/BlocksRenderer';

export const revalidate = 600;

export async function generateMetadata({ params }) {
  const page = await getPageBySlug(params.slug);
  if (!page) return { title: 'Halaman Tidak Ditemukan' };
  return {
    title: page.title,
    robots: { index: true, follow: true },
  };
}

export default async function StaticPage({ params }) {
  const page = await getPageBySlug(params.slug);
  if (!page) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white rounded-2xl shadow-sm p-6 md:p-10">
        <h1 className="text-3xl md:text-4xl font-black text-dark mb-8 pb-4 border-b border-gray-100">
          {page.title}
        </h1>
        <div className="rich-content">
          {page.content ? (
            <BlocksRenderer content={page.content} />
          ) : (
            <p className="text-gray-400 italic">Konten halaman belum tersedia.</p>
          )}
        </div>
      </div>
    </div>
  );
}
