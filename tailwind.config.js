import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(0 0% 89%)',
        input: 'hsl(0 0% 89%)',
        ring: 'hsl(0 0% 16%)',
        background: 'hsl(0 0% 99%)',
        foreground: 'hsl(0 0% 6%)',
        primary: {
          DEFAULT: 'hsl(0 0% 7%)',
          foreground: 'hsl(0 0% 98%)',
        },
        secondary: {
          DEFAULT: 'hsl(0 0% 96%)',
          foreground: 'hsl(0 0% 10%)',
        },
        muted: {
          DEFAULT: 'hsl(0 0% 96%)',
          foreground: 'hsl(0 0% 42%)',
        },
        accent: {
          DEFAULT: 'hsl(0 0% 94%)',
          foreground: 'hsl(0 0% 12%)',
        },
        popover: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(0 0% 6%)',
        },
        card: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(0 0% 8%)',
        },
      },
      borderRadius: {
        lg: '0.85rem',
        md: '0.65rem',
        sm: '0.45rem',
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,0.04), 0 10px 24px rgba(0,0,0,0.03)',
      },
      keyframes: {
        'node-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(1.06)', opacity: '0' },
        },
      },
      animation: {
        'node-pulse': 'node-pulse 1s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
