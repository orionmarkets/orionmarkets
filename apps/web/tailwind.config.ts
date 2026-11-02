import type { Config } from 'tailwindcss';

/**
 * Every colour is a CSS variable (see apps/web/src/app/globals.css, the single token source), so one class
 * works in both themes: `data-theme="dark"` (default) and `data-theme="light"`.
 * `c('go')` builds a colour that also accepts Tailwind's opacity modifier, e.g. `bg-go/15`.
 */
const c = (name: string) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces, from the page down to hover fills.
        page: c('bg'),
        background: c('bg'),
        raised: c('bg-raised'),
        panel: c('panel'),
        'panel-subtle': c('panel-subtle'),
        'panel-hover': c('panel-hover'),
        // Legacy surface names, still referenced across the app.
        surface: {
          DEFAULT: c('panel'),
          subtle: c('panel-subtle'),
          hover: c('panel-hover'),
          border: c('line'),
          'border-light': c('line-strong'),
          line: c('line'),
        },
        // Hairlines.
        'line-soft': c('line-soft'),
        line: c('line'),
        'line-strong': c('line-strong'),
        // Text, strongest to faintest.
        ink: c('ink'),
        fg: c('text'),
        'fg-2': c('text-2'),
        'fg-3': c('text-3'),
        muted: {
          DEFAULT: c('muted'),
          dark: c('dim'),
        },
        dim: c('dim'),
        // Accent (links, selected states) and the primary action (the reference's black button).
        accent: c('accent'),
        'accent-soft': c('accent-soft'),
        'on-accent': c('on-accent'),
        emerald: {
          DEFAULT: c('accent'),
          bright: c('accent-soft'),
          dark: c('text-3'),
          deep: c('dim'),
          muted: c('accent-muted'),
        },
        brand: {
          DEFAULT: c('accent'),
          hover: c('accent-soft'),
          dark: c('text-3'),
          muted: c('accent-muted'),
        },
        action: c('action'),
        'action-hover': c('action-hover'),
        'on-action': c('on-action'),
        // Semantic colours. Green means good or "go", red loss or short, amber caution.
        go: {
          DEFAULT: c('go'),
          hover: c('go-soft'),
          dark: c('go-deep'),
          muted: c('go-bg'),
        },
        'on-go': c('on-go'),
        'go-bg': c('go-bg'),
        neg: c('neg'),
        'neg-strong': c('neg-strong'),
        'neg-bg': c('neg-bg'),
        'on-neg': c('on-neg'),
        warn: c('warn'),
        'warn-strong': c('warn-strong'),
        'warn-bg': c('warn-bg'),
        danger: {
          DEFAULT: c('danger'),
          muted: c('neg-bg'),
        },
        silver: {
          DEFAULT: c('silver'),
          light: c('silver-light'),
        },
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
        display: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
        heroDisplay: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        heading: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
        ui: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
        hand: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '9999px',
      },
      letterSpacing: {
        tightest: '-0.06em',
        tighter: '-0.04em',
        widest: '0.15em',
      },
    },
  },
  plugins: [],
};

export default config;
