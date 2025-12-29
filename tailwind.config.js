/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        press: ['"Press Start 2P"'],
        doto: ['"Doto"', "sans-serif"],
        jetbrains: ['"JetBrains Mono"', "monospace"],
        space: ['"Space Mono"', "monospace"],
        sixcaps: ['"Six Caps"', 'sans-serif'],
        oranienbaum: ['"Oranienbaum"', 'serif'],

      },
    },
  },
  plugins: [],
};
