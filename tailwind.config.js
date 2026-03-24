/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // NatBolt brand palette — #0b0b0b black + #f06022 orange
        brand: {
          dark:  '#0b0b0b',   // header, primary surfaces  (was indigo #1A237E)
          mid:   '#f06022',   // CTAs, active states, links (was indigo #3949AB)
          light: '#FFF0E8',   // orange tint backgrounds    (was indigo tint #E8EAF6)
        },
        accent: {
          DEFAULT: '#f06022', // same as brand-mid — keeps btn-accent consistent
          light:   '#FFF0E8',
        },
        // Brand warm background surface
        surface: '#F5F0EB',
      },
      fontFamily: {
        // Dagger Square — official NatBolt brand font (self-hosted, see index.css)
        // Uncomment the @font-face blocks in index.css after dropping the font files in.
        display: ['"Dagger Square"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

