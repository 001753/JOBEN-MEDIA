---
name: Dark/light mode CSS architecture
description: How the dark/light toggle is implemented in the Next.js App Router frontend
---

## The approach
CSS custom properties in `:root` define light defaults; `html.dark {}` overrides each variable. All components reference `var(--token)` — never hardcode colors.

## Key tokens (globals.css)
- `--bg-page`, `--bg-card`, `--bg-header`, `--bg-sub-nav`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-faint`
- `--accent`, `--accent-glow`, `--border`, `--border-hover`
- `--shadow-card`

## ANTI_FOUC script
In `layout.js`, an inline script runs before hydration to apply `html.dark` from localStorage (or system preference). ThemeToggle reads from `document.documentElement.classList` and writes to localStorage.

## TechGrid — no `style jsx` in App Router
`<style jsx>` is a Pages Router feature (styled-jsx). In App Router, dark-only glow divs must use plain CSS classes in `globals.css` with `html.dark .classname { }` selectors.

## AnimatedBackground
Reads `document.documentElement.classList.contains('dark')` on every animation frame — automatically adapts as user toggles. No event listener needed.

## news-shimmer in light mode
`-webkit-text-fill-color: transparent` (used for shimmer gradient) makes text invisible on light backgrounds. Light mode = plain `color: #334155`, dark mode = gradient + animation.

**Why:** CSS gradient text (`background-clip: text` + `text-fill: transparent`) needs a visible gradient — a white-to-white gradient on white background is invisible.

## hero-article-card background
Keep `background: #1e293b` hardcoded — it's the fallback when the hero image fails to load; looks fine in both modes since the image fully covers it.
