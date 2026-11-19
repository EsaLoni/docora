# Docora Design System: Paper & Instruments

## 1. Product & Design Philosophy
Docora is an AI document intelligence application built for scholars, researchers, and serious readers.
It rejects "AI slop" — no purple/indigo gradients, no glowing neon blobs, no cards-inside-cards syndrome, and no marketing fluff.

- **Calm, Focused, Document-First**: The source material and the cited answer are the hero on every screen.
- **Editorial Reading-Room Aesthetic**: Tactile paper canvas, elevated pure white/charcoal sheets, hairline ink rules (`border-black/[0.08]` / `border-white/[0.08]`), and deep charcoal typography.
- **Jewelry Accent**: Warm Kinpaku Gold (`#E5A93B` / `#D97706`) reserved strictly for primary actions.
- **Truth Accent**: Patina Verdigris (`#0D9488` / `#059669`) dedicated to verified, source-grounded citations and status indicators.

---

## 2. Design Tokens

### Light Mode (Default)
- **Canvas Base**: `#F8F9FA` (Warm tactile paper)
- **Surface / Sheets**: `#FFFFFF` (Elevated card/panel)
- **Subtle Surface**: `#F4F5F7` (Inputs, secondary tiles, code blocks)
- **Hairline Border**: `rgba(0, 0, 0, 0.08)` (Ink rule)
- **Border Strong**: `rgba(0, 0, 0, 0.16)`
- **Text Primary**: `#18181B` (Deep charcoal ink)
- **Text Secondary**: `#3F3F46` (Muted ink)
- **Text Muted**: `#71717A` (Pencil graphite)
- **Primary Accent**: `#E5A93B` (Kinpaku Gold) / hover: `#D97706`
- **Citation / Verified**: `#0D9488` (Patina Verdigris) / bg: `rgba(13, 148, 136, 0.08)`

### Dark Mode (Unified Semantic Mapping)
- **Canvas Base**: `#121316` (Warm charcoal desk)
- **Surface / Sheets**: `#1A1B1F` (Elevated slate sheet)
- **Subtle Surface**: `#22242A` (Secondary inputs, tiles)
- **Hairline Border**: `rgba(255, 255, 255, 0.08)` (Chalk rule)
- **Border Strong**: `rgba(255, 255, 255, 0.16)`
- **Text Primary**: `#F4F4F5` (Crisp bone ink)
- **Text Secondary**: `#A1A1AA` (Graphite)
- **Text Muted**: `#71717A` (Muted)
- **Primary Accent**: `#F59E0B` (Amber Gold)
- **Citation / Verified**: `#14B8A6` (Verdigris)

---

## 3. Typography Pairing
- **Reading Body (Answers, Prose, Documents)**:
  - Font: `Charter`, `Georgia`, `Newsreader`, `Source Serif 4`, serif
  - Optical Measure: 60 to 75 characters (`max-w-prose` / `max-w-2xl`)
  - Line Height: `1.65` to `1.75`
- **UI & Controls (Buttons, Tabs, Navigation, Headers)**:
  - Font: System Sans (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Inter`, sans-serif)
  - Letter Spacing: `-0.01em` to `-0.02em` on titles; `0.02em` uppercase on micro-labels
- **Technical & Citations**:
  - Font: `JetBrains Mono`, `ui-monospace`, `Menlo`, monospace

---

## 4. Spacing, Elevation & Rhythm
- Spacing rhythm based on 4px grid (4, 8, 12, 16, 24, 32, 48px).
- Flat elevations with hairline borders and soft ambient drops:
  - Sheet shadow: `shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.03)]`
  - Popover shadow: `shadow-[0_12px_32px_-4px_rgba(0,0,0,0.12)]`
- Functional micro-transitions: `<= 150ms ease-out`. Zero decorative delays.
