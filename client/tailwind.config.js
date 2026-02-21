/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body:    ['"Manrope"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        navy:  { DEFAULT: '#0a1628', light: '#0f2040', mid: '#1a3560' },
        blue:  { DEFAULT: '#1565ff', light: '#4d8aff' },
        amber: { DEFAULT: '#ffb800', light: '#fff3cc' },
        slate: { DEFAULT: '#8899bb', light: '#c5cfe8', dark: '#3d5080' },
        green: { DEFAULT: '#00d68f', light: '#e0fff5' },
        red:   { DEFAULT: '#ff4757', light: '#ffe8ea' },
      },
    },
  },
  plugins: [],
}
