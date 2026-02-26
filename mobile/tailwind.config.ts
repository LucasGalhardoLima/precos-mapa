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
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
} satisfies Config;
