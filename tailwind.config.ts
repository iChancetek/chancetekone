import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08080c",
        surface: {
          DEFAULT: "#111118",
          muted: "#181824",
          card: "rgba(22, 22, 32, 0.7)",
          hover: "#222234",
        },
        border: "rgba(255, 255, 255, 0.08)",
        brand: {
          gold: "#f5c344",
          amber: "#ff9f1c",
          purple: "#9d4edd",
          violet: "#7b2cbf",
          neon: "#c77dff",
          dark: "#3c096c",
        },
        accent: {
          pink: "#ff007f",
          cyan: "#00f0ff",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-outfit)", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 12s linear infinite",
        "glow": "glow 3s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 15px rgba(157, 78, 221, 0.3)" },
          "100%": { boxShadow: "0 0 35px rgba(245, 195, 68, 0.5), 0 0 20px rgba(157, 78, 221, 0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
