/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FDFBF7',
          100: '#F9F3E8',
          200: '#F0E4CC',
          300: '#E2CFA3',
          400: '#D4B87A',
          DEFAULT: '#C8A96E',
          600: '#B5935A',
          700: '#96784A',
          800: '#6E5837',
          900: '#4A3B25',
        },
        cream: {
          50: '#FEFDFB',
          100: '#FBF9F5',
          200: '#F5F0EA',
          300: '#EDE5DA',
          DEFAULT: '#FAF7F2',
        },
        charcoal: {
          50: '#F7F7F6',
          100: '#E8E7E5',
          200: '#D4D2CF',
          300: '#A8A5A0',
          400: '#7A766F',
          500: '#5C584F',
          600: '#44413A',
          700: '#353229',
          800: '#292620',
          900: '#1C1A16',
        },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'display': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'subheading': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(200, 169, 110, 0.12), 0 4px 16px -4px rgba(0, 0, 0, 0.06)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03)',
        'elevated': '0 8px 24px -4px rgba(200, 169, 110, 0.15), 0 2px 8px -2px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
