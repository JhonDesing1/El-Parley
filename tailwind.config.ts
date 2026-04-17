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
        // Display: Barlow Condensed for bold sports/energy feel
        display: ["var(--font-display)", "system-ui"],
        // Body: DM Sans for modern, clean readability
        sans: ["var(--font-sans)", "system-ui"],
        // Numeric tabular for odds
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        // Paleta fija — azul marino oscuro + naranja Betplay-style
        border:     "#162030",
        input:      "#162030",
        ring:       "#e85a0e",
        background: "#040c18",
        foreground: "#f0f2f5",
        primary: {
          DEFAULT:    "#e85a0e",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT:    "#121d30",
          foreground: "#d0d8e8",
        },
        accent: {
          DEFAULT:    "#121d30",
          foreground: "#f0f2f5",
        },
        destructive: {
          DEFAULT:    "#dc2626",
          foreground: "#f0f2f5",
        },
        muted: {
          DEFAULT:    "#0f1a28",
          foreground: "#7a8fa8",
        },
        card: {
          DEFAULT:    "#080f1c",
          foreground: "#f0f2f5",
        },
        popover: {
          DEFAULT:    "#080f1c",
          foreground: "#f0f2f5",
        },
        // Colores semánticos de apuestas
        value: "#1fc46a",  // verde esmeralda — profit
        live:  "#dc2626",  // rojo — en vivo
        win:   "#1fc46a",
        loss:  "#dc2626",
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
