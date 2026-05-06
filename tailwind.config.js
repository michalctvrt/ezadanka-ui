/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DC Flipper brand
        brand: {
          navy: {
            DEFAULT: "#0a3d4f", // hlavní hlavička, primární tlačítka
            900: "#082f3d",
            800: "#0a3d4f",
            700: "#114a5e",
          },
          teal: {
            DEFAULT: "#1e8a96", // akcent, sekundární tlačítka
            700: "#1a7a85",
            600: "#1e8a96",
            500: "#2ca3af",
            100: "#e0f2f4",
            50: "#f0f9fa",
          },
          surface: "#f4f7f8", // pozadí celé stránky
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
