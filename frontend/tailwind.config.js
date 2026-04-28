/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Extended slate colors
        slate: {
          950: '#0f172a',
          900: '#1e293b',
          800: '#334155',
          700: '#475569',
          600: '#64748b',
          500: '#94a3b8',
          400: '#cbd5e1',
          300: '#e2e8f0',
          200: '#e2e8f0',
          100: '#f1f5f9',
          50: '#f8fafc',
        },
        // Emerald variants
        emerald: {
          600: '#059669',
          500: '#10b981',
          400: '#34d399',
          300: '#6ee7b7',
        },
        // Amber variants
        amber: {
          600: '#d97706',
          500: '#f59e0b',
          400: '#fbbf24',
        },
        // Design C specific palette
        dark: {
          bg: '#0F172A',
          surface: '#1E293B',
          'surface-2': '#334155',
          border: 'rgba(255,255,255,0.08)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(52, 211, 153, 0.4)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 0 6px rgba(52, 211, 153, 0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'glow-emerald': '0 0 40px rgba(52, 211, 153, 0.5)',
        'card-glow': '0 0 20px rgba(52, 211, 153, 0.15)',
      },
    },
  },
  plugins: [],
}