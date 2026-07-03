import { BlocksRenderer as StrapiBlocksRenderer } from '@strapi/blocks-react-renderer';
import Image from 'next/image';
import { slugify } from '@/lib/extractHeadings';

/* ──────────────────────────────────────────────────────────────────────────
   Rekursif ekstrak teks dari React node (children dari StrapiBlocksRenderer)
   Dipakai untuk generate id heading yang konsisten dengan extractHeadings.
   ────────────────────────────────────────────────────────────────────────── */
function getNodeText(node) {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (node?.props?.children !== undefined) return getNodeText(node.props.children);
  return '';
}

/* ── Counter duplicate slug — di-reset tiap render BlocksRenderer ────────── */
function makeSlugTracker() {
  const counts = {};
  return (base) => {
    counts[base] = (counts[base] ?? 0) + 1;
    return counts[base] > 1 ? `${base}-${counts[base]}` : base;
  };
}

export default function BlocksRenderer({ content }) {
  if (!content) return null;

  /* Satu counter per render pass — aman karena server renders are synchronous */
  const trackSlug = makeSlugTracker();

  return (
    <StrapiBlocksRenderer
      content={content}
      blocks={{
        image: ({ image }) => (
          <figure className="my-6">
            <div
              className="relative w-full overflow-hidden rounded-xl bg-gray-100"
              style={{ aspectRatio: `${image.width}/${image.height}` }}
            >
              <Image
                src={image.url}
                alt={image.alternativeText ?? ''}
                fill
                sizes="(max-width: 768px) 100vw, 66vw"
                className="object-cover"
              />
            </div>
            {image.caption && (
              <figcaption className="text-center text-xs text-gray-400 mt-2 italic">
                {image.caption}
              </figcaption>
            )}
          </figure>
        ),

        paragraph: ({ children }) => (
          <p className="text-gray-700 leading-relaxed mb-5 text-[17px]">{children}</p>
        ),

        heading: ({ children, level }) => {
          const Tag = `h${level}`;
          const cls = {
            1: 'text-3xl font-black text-dark mt-10 mb-4',
            2: 'text-2xl font-bold text-dark mt-8 mb-4',
            3: 'text-xl font-bold text-dark mt-6 mb-3',
            4: 'text-lg font-semibold text-dark mt-5 mb-2',
            5: 'text-base font-semibold text-dark mt-4 mb-2',
            6: 'text-sm font-semibold text-dark mt-4 mb-2',
          }[level] ?? 'text-base font-semibold';

          /* Hanya h2 & h3 yang butuh id untuk TOC */
          if (level !== 2 && level !== 3) {
            return <Tag className={cls}>{children}</Tag>;
          }

          const text = getNodeText(children).trim();
          const id   = trackSlug(slugify(text));

          return (
            <Tag id={id} className={`${cls} scroll-mt-28`}>
              {children}
            </Tag>
          );
        },

        quote: ({ children }) => (
          <blockquote className="border-l-4 border-brand-700 pl-5 my-6 py-2 bg-brand-50 rounded-r-lg">
            <div className="text-gray-700 italic text-lg leading-relaxed">{children}</div>
          </blockquote>
        ),

        code: ({ plainText }) => (
          <pre className="bg-gray-900 text-green-400 p-5 rounded-xl overflow-x-auto my-6 text-sm leading-relaxed">
            <code>{plainText}</code>
          </pre>
        ),

        list: ({ children, format }) => {
          const Tag = format === 'ordered' ? 'ol' : 'ul';
          const cls =
            format === 'ordered'
              ? 'list-decimal list-inside mb-5 space-y-1.5 text-gray-700'
              : 'list-disc list-inside mb-5 space-y-1.5 text-gray-700';
          return <Tag className={cls}>{children}</Tag>;
        },

        'list-item': ({ children }) => (
          <li className="text-[17px] leading-relaxed">{children}</li>
        ),

        link: ({ children, url }) => (
          <a
            href={url}
            className="text-brand-700 hover:text-brand-800 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
      }}
      modifiers={{
        bold:          ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
        italic:        ({ children }) => <em>{children}</em>,
        underline:     ({ children }) => <u>{children}</u>,
        strikethrough: ({ children }) => <s>{children}</s>,
        code: ({ children }) => (
          <code className="bg-gray-100 text-brand-700 px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        ),
      }}
    />
  );
}
