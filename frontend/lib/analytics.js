'use client';

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export function pageview(url) {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  window.gtag?.('config', GA_MEASUREMENT_ID, { page_path: url });
}

export function event({ action, category, label, value }) {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  window.gtag?.('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}

export function trackArticleView(articleTitle, category) {
  event({ action: 'view_article', category: category ?? 'Umum', label: articleTitle });
}

export function trackSearch(keyword) {
  event({ action: 'search', category: 'Pencarian', label: keyword });
}
