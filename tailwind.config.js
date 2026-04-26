/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pokemon: {
          red: '#CC0000',
          blue: '#3B4CCA',
          yellow: '#FFDE00',
          gold: '#B3A125',
        },
      },
    },
  },
  plugins: [],
}

