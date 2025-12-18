/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#13a97b',
        },
      },
      fontFamily: {
        sans: ['Sofia Pro', 'Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.84375rem', { lineHeight: '1rem' }],      // 13.5px (was 12px) +1.5px
        'sm': ['0.96875rem', { lineHeight: '1.25rem' }],   // 15.5px (was 14px) +1.5px
        'base': ['1.09375rem', { lineHeight: '1.5rem' }],  // 17.5px (was 16px) +1.5px
        'lg': ['1.21875rem', { lineHeight: '1.75rem' }],   // 19.5px (was 18px) +1.5px
        'xl': ['1.34375rem', { lineHeight: '1.75rem' }],   // 21.5px (was 20px) +1.5px
        '2xl': ['1.59375rem', { lineHeight: '2rem' }],     // 25.5px (was 24px) +1.5px
      },
    },
  },
  plugins: [],
};
