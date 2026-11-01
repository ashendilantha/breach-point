/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0c0d10",
          900: "#121318",
          850: "#17181f",
          800: "#1d1f27",
          700: "#2a2d38",
          600: "#3a3e4d",
        },
        amber: {
          accent: "#e8a13c",
          dim: "#8a6428",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
