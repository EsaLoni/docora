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
      fontSize: {
        display: ["28px", { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.02em" }],
        title: ["18px", { lineHeight: "24px", fontWeight: "600", letterSpacing: "-0.015em" }],
        section: ["14px", { lineHeight: "20px", fontWeight: "600", letterSpacing: "-0.01em" }],
        reading: ["15px", { lineHeight: "26px", fontWeight: "400" }],
        ui: ["13px", { lineHeight: "18px", fontWeight: "500" }],
        caption: ["11px", { lineHeight: "16px", fontWeight: "500" }],
        micro: ["11px", { lineHeight: "14px", fontWeight: "500", letterSpacing: "0.02em" }],
      },
      colors: {
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-subtle)",
        },
        "border-hairline": "var(--border-hairline)",
        "border-strong": "var(--border-strong)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "accent-gold": {
          DEFAULT: "var(--accent-gold)",
          hover: "var(--accent-gold-hover)",
          fg: "var(--accent-gold-fg)",
        },
        "citation-verdigris": {
          DEFAULT: "var(--citation-verdigris)",
          bg: "var(--citation-verdigris-bg)",
          border: "var(--citation-verdigris-border)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          bg: "var(--destructive-bg)",
          border: "var(--destructive-border)",
        },
        ring: "var(--accent-gold)",
        // Semantic shorthands
        hairline: "var(--border-hairline)",
        ink: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        gold: {
          DEFAULT: "var(--accent-gold)",
          hover: "var(--accent-gold-hover)",
          fg: "var(--accent-gold-fg)",
        },
        verdigris: {
          DEFAULT: "var(--citation-verdigris)",
          subtle: "var(--citation-verdigris-bg)",
          border: "var(--citation-verdigris-border)",
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
