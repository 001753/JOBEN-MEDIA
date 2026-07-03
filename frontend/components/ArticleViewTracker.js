'use client';

import { useEffect } from 'react';
import { trackArticleView } from '@/lib/analytics';

export default function ArticleViewTracker({ title, category }) {
  useEffect(() => {
    if (title) {
      trackArticleView(title, category);
    }
  }, [title, category]);

  return null;
}
