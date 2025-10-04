import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
        mono: ['var(--font-mono)', ...fontFamily.mono],
      },
      colors: {
        brand: {
          primary: 'hsl(var(--color-brand-primary))',
          secondary: 'hsl(var(--color-brand-secondary))',
          accent: 'hsl(var(--color-brand-accent))',
        },
        surface: {
          base: 'hsl(var(--color-surface-base))',
          raised: 'hsl(var(--color-surface-raised))',
          sunken: 'hsl(var(--color-surface-sunken))',
        },
        text: {
          primary: 'hsl(var(--color-text-primary))',
          secondary: 'hsl(var(--color-text-secondary))',
          muted: 'hsl(var(--color-text-muted))',
          inverted: 'hsl(var(--color-text-inverted))',
        },
        semantic: {
          success: 'hsl(var(--color-semantic-success))',
          warning: 'hsl(var(--color-semantic-warning))',
          danger: 'hsl(var(--color-semantic-danger))',
          info: 'hsl(var(--color-semantic-info))',
        },
        border: {
          subtle: 'hsl(var(--color-border-subtle))',
          strong: 'hsl(var(--color-border-strong))',
        },
      },
      spacing: {
        gutter: 'var(--space-gutter)',
        section: 'var(--space-section)',
      },
      borderRadius: {
        none: '0px',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: '9999px',
      },
      boxShadow: {
        focus: '0 0 0 3px hsl(var(--color-focus-ring) / 0.4)',
        raised: '0 8px 24px -12px hsl(var(--color-shadow) / 0.45)',
      },
      transitionTimingFunction: {
        entrance: 'cubic-bezier(0.22, 1, 0.36, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
