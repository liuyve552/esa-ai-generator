import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "hsl(222 84% 4.9%)",
          light: "hsl(0 0% 100%)"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.55)"
      }
    }
  },
  plugins: []
} satisfies Config;

