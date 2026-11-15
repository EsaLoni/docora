# UDIP Phase 15 — Premium Design System & Typography Specification

**Project:** Universal Document Intelligence Platform (UDIP)  
**Date:** November 15, 2026  
**Auditor / Designer:** Principal Product Designer & Frontend Architect  
**Status:** Implemented in `globals.css` and `tailwind.config.ts`

---

## 1. Visual Design Token Architecture

Phase 15 introduces a unified, calm, dark-first aesthetic tailored for deep analytical work, research syntheses, and distraction-free document comprehension.

| Token Name | Hex Code | HSL Value | Semantic Role |
|---|---|---|---|
| **Canvas** | `#0B0D12` | `223 24% 6%` | Deep midnight root background across all pages |
| **Sidebar** | `#10141D` | `222 29% 9%` | Primary navigation spine and persistent context anchor |
| **Cards / Surfaces** | `#151B27` | `220 30% 12%` | Content containers, documents, notebooks, and message cards |
| **Elevated Surfaces** | `#1B2332` | `219 30% 15%` | Popovers, dropdown menus, modals, active tabs |
| **Subtle Borders** | `#273247` | `219 29% 22%` | Hairline separators, table borders, card perimeters |
| **Strong Borders** | `#3A4A68` | `220 28% 32%` | Interactive hover borders, active focus indicators |
| **Primary Accent** | `#6D8FFF` | `226 100% 71%` | Primary buttons, active nav pills, link highlights |
| **Primary Text** | `#F1F5FC` | `218 61% 97%` | High-contrast readable typography for titles and body |
| **Secondary Text** | `#A0AEC0` | `214 20% 69%` | Subtitles, helper text, timestamps, and metadata |
| **Verified Citations** | `#34D399` | `158 64% 52%` | Emerald indicators for cryptographically grounded RAG quotes |

---

## 2. Typography System & Hierarchy

The typography system is anchored on **Inter** (with system font fallbacks) configured with precise vertical rhythm and comfortable reading density:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Main Page Heading: 30px / 600 weight / line-height: 36px (-0.02em)     │
├────────────────────────────────────────────────────────────────────────┤
│ Section Heading:   22px / 600 weight / line-height: 28px (-0.01em)     │
├────────────────────────────────────────────────────────────────────────┤
│ Card Heading:      16px / 600 weight / line-height: 24px               │
├────────────────────────────────────────────────────────────────────────┤
│ Body Reading Text: 15px / 400 weight / line-height: 1.6 (24px)         │
├────────────────────────────────────────────────────────────────────────┤
│ Secondary Text:    13px / 400 weight / line-height: 1.5 (20px)         │
├────────────────────────────────────────────────────────────────────────┤
│ Metadata & Labels: 12px / 500 weight / line-height: 16px               │
├────────────────────────────────────────────────────────────────────────┤
│ Buttons & Badges:  14px / 500 weight / line-height: 20px               │
└────────────────────────────────────────────────────────────────────────┘
```

### Reading Content & Markdown Prose Rules
- **Line Height:** Enforced at `1.6` for optimal long-form reading ease.
- **Headings in Prose:** Clean hierarchy (`h1: 22px / 600`, `h2: 18px / 600`, `h3: 16px / 600`).
- **Code Spans:** Styled with dark navy background `#1B2332`, border `#273247`, and accent text `#6D8FFF`.
- **Code Blocks:** `#10141D` background with smooth horizontal scrolling.
- **Tables:** Full-width responsive tables with alternating surface density and `#273247` cell borders.
- **Citations:** Inline badges `[1]` rendered with `#34D399` verified citation tokens.

---

## 3. Component Design Rules & Spacing Rhythm

1. **Card Radius:** Consistent `rounded-2xl` (`16px`) for primary cards; `rounded-xl` (`12px`) for interactive items.
2. **Elevation & Shadows:** Minimalist shadows (`shadow-sm`, `shadow-2xs`), prioritizing border delineation `#273247` over heavy drop shadows.
3. **Contrast Compliance:** All text-to-background combinations meet or exceed WCAG AA standards (4.5:1 for body text, 3:1 for large headings).
4. **Interactive States:** Hover effects transition smoothly (`transition-colors duration-150`) to `#1B2332` or `#84A2FF`.
