/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: require('./src/theme/tokens').twColors,
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // Injeta as CSS vars do tema (fonte única: src/theme/tokens.ts) na base.
    ({ addBase }) => {
      const { darkVars, lightVars } = require('./src/theme/tokens');
      addBase({ ':root': darkVars });
      addBase({ '.light': lightVars });
    },
  ],
};
