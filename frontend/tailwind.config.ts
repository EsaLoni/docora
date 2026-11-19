import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          "Charter",
          "Newsreader",
          "Georgia",
          "'Times New Roman'",
          "serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          subtle: "var(--surface-subtle)",
          "subtle-hover": "var(--surface-subtle-hover)",
        },
        hairline: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        ink: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        gold: {
          DEFAULT: "var(--primary-gold)",
          hover: "var(--primary-gold-hover)",
          active: "var(--primary-gold-active)",
          fg: "var(--primary-gold-fg)",
        },
        verdigris: {
          DEFAULT: "var(--verdigris)",
          subtle: "var(--verdigris-bg)",
          border: "var(--verdigris-border)",
          fg: "var(--verdigris-fg)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          subtle: "var(--destructive-bg)",
          border: "var(--destructive-border)",
        },
        ring: "var(--ring)",
        // Aliases for compatibility
        background: "var(--canvas)",
        foreground: "var(--text-primary)",
        border: "var(--border)",
        input: "var(--border)",
        primary: {
          DEFAULT: "var(--primary-gold)",
          foreground: "var(--primary-gold-fg)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
        fast: "100ms",
      },
    },
  },
  plugins: [],
};

export default config;
