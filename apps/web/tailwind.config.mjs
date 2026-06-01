/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral slate scale — text, borders, and surfaces.
        zephyr: {
          50: "#f8fafc",
          100: "#eef2f6",
          200: "#dde3ea",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          900: "#0f172a",
        },
        // Brand accent — links, buttons, highlights.
        brand: {
          50: "#eff4ff",
          100: "#dbe4ff",
          500: "#3b6df6",
          600: "#2456d8",
          700: "#1d44b0",
        },
        grade: {
          a: "#059669",
          b: "#16a34a",
          c: "#ca8a04",
          d: "#ea580c",
          f: "#dc2626",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
    },
  },
};
