'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }) {
  let pathname;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- guards against a Next.js edge case where the router context is unavailable during static prerendering of built-in error pages; hooks are still called unconditionally on every render.
    pathname = usePathname();
  } catch {
    pathname = '/';
  }

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
