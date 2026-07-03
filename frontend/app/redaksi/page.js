import Image from 'next/image';
import { getAuthors, getImageUrl } from '@/lib/strapi';

export const revalidate = 600;

export const metadata = {
  title: 'Redaksi — JOBEN NEWS',
  description: 'Susunan redaksi JOBEN NEWS, portal berita terkini Indonesia.',
};

const ROLE_ORDER = ['Pemimpin Redaksi', 'Wakil Pemimpin Redaksi', 'Redaktur Pelaksana', 'Editor', 'Redaktur', 'Penulis', 'Kontributor', 'Fotografer'];

function sortByRole(authors) {
  return [...authors].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a.role_label ?? '');
    const ib = ROLE_ORDER.indexOf(b.role_label ?? '');
    const ra = ia === -1 ? 99 : ia;
    const rb = ib === -1 ? 99 : ib;
    if (ra !== rb) return ra - rb;
    return (a.name ?? '').localeCompare(b.name ?? '', 'id');
  });
}

export default async function RedaksiPage() {
  const authors = await getAuthors();
  const sorted  = sortByRole(authors);

  const grouped = sorted.reduce((acc, author) => {
    const role = author.role_label ?? 'Tim Redaksi';
    if (!acc[role]) acc[role] = [];
    acc[role].push(author);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="h-px w-12 bg-brand-700" />
          <span className="text-brand-700 text-sm font-bold uppercase tracking-widest">Tim Kami</span>
          <div className="h-px w-12 bg-brand-700" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-dark mb-4">Susunan Redaksi</h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Profesional berpengalaman yang berdedikasi menghadirkan berita akurat dan terpercaya untuk Indonesia.
        </p>
      </div>

      {authors.length === 0 ? (
        <p className="text-center text-gray-400 py-16">Data redaksi belum tersedia.</p>
      ) : (
        <div className="space-y-12">
          {Object.entries(grouped).map(([role, members]) => (
            <section key={role}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-brand-700 rounded-full" />
                <h2 className="text-lg font-black text-dark uppercase tracking-wide">{role}</h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                {members.map((author) => {
                  const img = getImageUrl(author.photo);
                  return (
                    <div key={author.id} className="bg-white rounded-2xl p-5 text-center card-shadow group hover:-translate-y-1 transition-transform duration-200">
                      {img ? (
                        <div className="relative w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden ring-4 ring-brand-50 group-hover:ring-brand-200 transition-all">
                          <Image
                            src={img}
                            alt={author.name}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-brand-100 flex items-center justify-center ring-4 ring-brand-50 group-hover:ring-brand-200 transition-all">
                          <span className="text-2xl font-black text-brand-600">
                            {(author.name ?? 'A').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <p className="font-bold text-dark text-sm leading-tight">{author.name}</p>
                      {author.bio && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{author.bio}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pedoman */}
      <div className="mt-16 bg-dark text-white rounded-2xl p-8 md:p-10 text-center">
        <h3 className="text-xl font-bold mb-3">Kode Etik Jurnalistik</h3>
        <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
          JOBEN NEWS berkomitmen pada akurasi, independensi, dan integritas jurnalistik. Setiap artikel melewati proses editorial ketat sebelum dipublikasikan.
        </p>
        <a
          href="mailto:redaksi@jobenapp.cloud"
          className="inline-block mt-5 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
        >
          Hubungi Redaksi
        </a>
      </div>
    </div>
  );
}
