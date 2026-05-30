/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        minecraft: {
          stone: '#5a5e65',      // Stone grey
          wood: '#d2a06c',       // Warm wood oak
          woodDark: '#a67b4c',   // Darker wood accents
          grass: '#5c8e32',      // Grass green
          grassDark: '#4c7528',  // Shadow green
          lapis: '#4A90D9',      // Blue redstone wires
          emerald: '#00AA00',    // Emerald green
          redstone: '#EF4444'    // Redstone red
        },
        theme: {
          lapis: '#4A90D9',      // Lapis blue
          redstone: '#EF4444',   // Redstone red
          emerald: '#00AA00',    // Emerald
          gold: '#F59E0B'        // Gold highlight
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
