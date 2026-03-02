import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../packages/shared/src/components/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        /* ── existing tokens (backward-compat) ─────────────── */
        brand: {
          green: "#22C55E",
          "green-dark": "#16A34A",
          orange: "#F97316",
          "orange-dark": "#EA580C",
        },
        surface: {
          primary: "#FFFFFF",
          secondary: "#F8FAFC",
          tertiary: "#F1F5F9",
        },
        text: {
          primary: "#0F172A",
          secondary: "#475569",
          tertiary: "#94A3B8",
          inverse: "#FFFFFF",
        },
        semantic: {
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6",
        },
        border: {
          DEFAULT: "#E2E8F0",
          light: "#F1F5F9",
        },

        /* ── Palette A: Encarte (supermarket flyer) ────────── */
        encarte: {
          paper: "#FAF7F0",
          chalk: "#1E2820",
          green: "#2A6041",
          red: "#C8392B",
          mustard: "#E8A020",
        },

        /* ── Palette B: Fintech (clean financial app) ──────── */
        fintech: {
          box: "#FAFBFC",
          surface: "#F2F4F7",
          line: "#DDE2EA",
          graphite: "#0D1520",
          lead: "#4A5568",
          silver: "#8A97A8",
          deepGreen: "#0B5E3A",
          mediumGreen: "#167A4D",
          vividGreen: "#22A06B",
          softGreen: "#E2F5EC",
          offerRed: "#C8192B",
          activeRed: "#E41E32",
          softRed: "#FDEAEC",
          gold: "#9A6108",
          brightGold: "#CF8B12",
          lightGold: "#F9EFD8",
          night: "#0C1829",
          dawn: "#162438",
          mist: "#E8EDF5",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
} satisfies Config;
