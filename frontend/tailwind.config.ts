import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "'Fira Sans'",
          "'Droid Sans'",
          "'Helvetica Neue'",
          "sans-serif",
        ],
      },
      fontSize: {
        "page-title": ["30px", { lineHeight: "36px", fontWeight: "600" }],
        "section-title": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "card-title": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "body-reading": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-secondary": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        "meta": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "btn": ["14px", { lineHeight: "20px", fontWeight: "500" }],
      },
      colors: {
        canvas: "#F8F9FA",
        sidebar: "#F4F5F7",
        surface: {
          DEFAULT: "#FFFFFF",
          card: "#FFFFFF",
          elevated: "#FFFFFF",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "rgba(0, 0, 0, 0.08)",
          strong: "rgba(0, 0, 0, 0.16)",
        },
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          blue: "#6D8FFF",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        citation: {
          DEFAULT: "#34D399",
          soft: "rgba(52, 211, 153, 0.15)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
