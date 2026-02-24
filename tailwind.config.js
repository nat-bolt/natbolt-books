/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:  '#1A237E',
          mid:   '#3949AB',
          light: '#E8EAF6',
        },
        accent: {
          DEFAULT: '#F57C00',
          light:   '#FFF3E0',
        },
      },
    },
  },
  plugins: [],
};

