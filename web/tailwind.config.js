/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        card: "var(--card)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        grid: "var(--grid)",
        accent: "var(--accent)",
        ember: {
          1: "var(--ramp-1)",
          2: "var(--ramp-2)",
          3: "var(--ramp-3)",
          4: "var(--ramp-4)",
          5: "var(--ramp-5)",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Bengali", "system-ui", "sans-serif"],
        bn: ["Noto Sans Bengali", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
