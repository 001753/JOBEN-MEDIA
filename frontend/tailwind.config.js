/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff1f1',
          100: '#ffe1e1',
          200: '#ffc7c7',
          300: '#ffa0a0',
          400: '#ff6767',
          500: '#f83535',
          600: '#e51717',
          700: '#c10f0f',
          800: '#a01111',
          900: '#841515',
          950: '#480606',
        },
        dark: {
          DEFAULT: '#0f172a',
          header: '#0a0a0a',
          card: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#1f2937',
            a: {
              color: '#c10f0f',
              '&:hover': { color: '#a01111' },
            },
            h2: { fontWeight: '700', color: '#0f172a' },
            h3: { fontWeight: '600', color: '#0f172a' },
            img: { borderRadius: '0.5rem' },
          },
        },
      },
      animation: {
        ticker: 'ticker 40s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in',
      },
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
