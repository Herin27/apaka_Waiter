/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0B0B0C',
        'surface-1': '#141416',
        'surface-2': '#1C1C1F',
        'surface-3': '#242429',
        accent: {
          DEFAULT: '#E8591A',
          hover: '#F2682B',
          muted: 'rgba(232, 89, 26, 0.14)',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.16)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans Devanagari',
          'Noto Sans Gujarati',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'orange-glow': '0 0 28px -4px rgba(232, 89, 26, 0.45)',
        'orange-glow-lg': '0 0 48px -6px rgba(232, 89, 26, 0.55)',
        card: '0 8px 30px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
};
