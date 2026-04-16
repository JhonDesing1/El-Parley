import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        // Display: Archivo for bold editorial feel (sports magazine vibe)
        display: ["var(--font-archivo)", "system-ui"],
        // Body: Manrope for modern, readable
        sans: ["var(--font-manrope)", "system-ui"],
        // Numeric tabular for odds
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // Semantic betting colors
        value: "hsl(var(--value))", // neon lime for value bets
        live: "hsl(var(--live))", // red pulsing
        win: "hsl(var(--win))",
        loss: "hsl(var(--loss))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "live-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "odds-flash": {
          "0%": { backgroundColor: "hsl(var(--value) / 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.5s ease-in-out infinite",
        "odds-flash": "odds-flash 1s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
