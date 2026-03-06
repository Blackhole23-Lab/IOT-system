/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          DEFAULT: '#f8faff',
          raised:  '#ffffff',
          overlay: '#f0f5ff',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'card':    '0 1px 3px 0 rgba(0,0,0,.07), 0 1px 2px -1px rgba(0,0,0,.05)',
        'card-lg': '0 4px 24px -2px rgba(30,64,175,.12), 0 2px 8px -2px rgba(30,64,175,.08)',
        'glow':    '0 0 0 3px rgba(59,130,246,.35)',
      },
      animation: {
        'fade-up':    'fadeUp 0.45s cubic-bezier(.25,.1,.25,1) both',
        'slide-in':   'slideIn 0.35s cubic-bezier(.25,.1,.25,1) both',
        'pulse-ring': 'pulseRing 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp:    { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn:   { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseRing: { '0%,100%': { opacity: '.6', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.05)' } },
      },
    },
  },
  plugins: [],
}
