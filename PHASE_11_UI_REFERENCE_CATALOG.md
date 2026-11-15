# UDIP — Phase 11 UI Reference Catalog & Design System

**Platform:** Universal Document Intelligence Platform (UDIP)  
**System:** Gemini Notebook & Studio Design System  
**Date:** November 14, 2026  
**Document Version:** 1.0  

---

## 1. Design Philosophy & Foundations

The UDIP Notebook interface delivers a premium, cognitive-first research workbench. It borrows the elegance, understated dark theme, and information density of Google NotebookLM while maintaining UDIP's proprietary brand identity.

### Core Visual Principles
1. **Low Visual Noise:** Near-black and deep slate surfaces reduce eye strain during extended reading and synthesis.
2. **Subtle Surface Elevation:** Panels, cards, and modal dialogs use subtle border highlights (`border-slate-800` / `border-white/10`) rather than aggressive drop shadows.
3. **Accent Signaling:** Purposeful, restrained color accents (Emerald for grounded verification, Blue/Indigo for AI intelligence, Amber for warnings/notes, Rose for deletions/missed items).
4. **Readable Typography:** Clean geometric sans-serif (Inter / System UI) with distinct typographic hierarchy and line spacing.

---

## 2. Design Tokens & Color Palette

### Surface & Background Tokens
| Token Name | Hex Code | Tailwind Equivalent | Purpose |
| :--- | :---: | :--- | :--- |
| `bg-canvas` | `#0B0D11` | `bg-slate-950` / `#0B0D11` | Application backdrop |
| `bg-surface-base` | `#12151C` | `bg-slate-900/90` | Panel background (Left, Center, Right) |
| `bg-surface-raised`| `#1A1E27` | `bg-slate-900` | Cards, active tabs, input containers |
| `bg-surface-elevated`| `#222733` | `bg-slate-800/80` | Modals, tooltips, dropdown menus |
| `border-subtle` | `#232936` | `border-slate-800` | Panel boundaries and dividers |
| `border-highlight` | `#333C4D` | `border-slate-700` | Card borders, hover states |

### Brand & Semantic Accent Tokens
| Accent Token | Hex Code | Tailwind Equivalent | Usage |
| :--- | :---: | :--- | :--- |
| `accent-primary` | `#3B82F6` | `blue-500` | Active buttons, primary focus outlines |
| `accent-indigo` | `#6366F1` | `indigo-500` | AI generation actions, Studio branding |
| `accent-emerald` | `#10B981` | `emerald-500` | Grounded citations, "Got It" flashcard mastery |
| `accent-amber` | `#F59E0B` | `amber-500` | Saved notes, caution badges, rate warnings |
| `accent-rose` | `#F43F5E` | `rose-500` | "Missed It" flashcard status, error states |

### Typography Scale
| Level | Font Size | Line Height | Weight | Tracking | Usage |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Display** | 24px (1.5rem) | 32px | Bold (700) | -0.02em | Notebook title, dashboard header |
| **Heading 1** | 18px (1.125rem)| 26px | SemiBold (600) | -0.01em | Studio modal titles, section headers |
| **Heading 2** | 15px (0.9375rem)| 22px | Medium (500) | normal | Panel headers, card titles |
| **Body Large** | 14px (0.875rem)| 22px | Regular (400) | normal | Chat responses, note content |
| **Body Small** | 13px (0.8125rem)| 18px | Regular (400) | normal | Source lists, options descriptions |
| **Caption** | 11px (0.6875rem)| 14px | Medium (500) | +0.02em | Citation pills, status badges, timestamps |

---

## 3. Component Hierarchy & State Specifications

### A. Three-Panel Workspace Shell
```
+------------------------------------------------------------------------------------+
| Top Navigation Bar (h-14, border-b, px-4)                                           |
+----------------------+-------------------------------------+-----------------------+
| Panel 1: Sources     | Panel 2: Grounded Chat              | Panel 3: Studio       |
| (w-72 to w-80)       | (flex-1, min-w-[500px])             | (w-80 to w-96)        |
| - Header & Add Source| - Mode Switcher Bar                 | - Header & Artifacts  |
| - Source Cards       | - Scrollable Message History        | - 9 Studio Tiles      |
| - Notes Tab Drawer   | - Suggested Prompt Pills            | - Interactive Viewers |
|                      | - Floating Pill Input Bar           | - History Drawer      |
+----------------------+-------------------------------------+-----------------------+
```

### B. Source Card Component
- **Default State:** `bg-slate-900/60 border border-slate-800/80 rounded-xl p-3`
- **Active / Checked:** Subtle highlight `border-blue-500/40 bg-blue-950/20`
- **Hover State:** `border-slate-700 bg-slate-900`
- **Processing State:** Animated pulse on document icon with status text `Extracting...`
- **Error State:** Red badge with retry button

### C. Grounded Chat Message Component
- **User Bubble:** Right-aligned, `bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]`
- **AI Bubble:** Left-aligned, `bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-sm p-5 max-w-[92%]`
  - Markdown text with styled bullet points, tables, and bold highlights.
  - Inline Citation Tag: `[1]`, `[Source 1]` rendered as clickable emerald pill (`bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-xs px-1.5 py-0.5 rounded-full hover:bg-emerald-900/80 cursor-pointer`).
  - Action Footer: Thumbs up, Thumbs down, Copy to Clipboard, Save as Note.
  - Follow-up Prompt Pills: Horizontally scrollable row of suggested queries (`bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs rounded-full px-3 py-1.5 border border-slate-700/60 transition`).

### D. Chat Input Bar
- Floating or anchored pill container: `bg-slate-900 border border-slate-700/80 rounded-2xl p-2 shadow-2xl focus-within:border-blue-500`
- Integrated controls:
  - Persona mode dropdown pill (`Default`, `Learning Guide`, `Analyst`, `Academic`, `Concise`, `Detailed`)
  - Auto-expanding text area
  - Send / Stop generation action button

### E. Studio Action Tiles (9-Tool Grid)
- **Container:** `grid grid-cols-1 gap-2.5`
- **Card Specs:** `bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition group cursor-pointer flex items-center justify-between`
- **Visuals:** Icon in colored squircle + Tool Title + One-line description + Chevron right.

### F. Interactive Flashcard Component
- **3D Flip Perspective:** `perspective: 1000px`
- **Card Container:** `transform-style: preserve-3d`, transition `transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)`
- **Front Side:** Question prompt, topic category, difficulty indicator, "Click to reveal answer" hint.
- **Back Side:** Detailed answer, source citations, "Got It" (green) and "Missed It" (rose) feedback buttons.

---

## 4. Modal Dialogs & Drawers

1. **Add Sources Modal:** Centered dialog (`max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6`). Tab navigation for File Upload, Web URL, YouTube, Text Note.
2. **Artifacts History Drawer:** Slide-over drawer listing all generated assets with timestamp, status, and direct binary download.
3. **Studio Configuration Dialogs:** Lightweight modal overlay for configuring parameters (e.g. Presentation slide count and theme, Report archetype selection, Quiz question count).

---

## 5. Responsive Breakpoints

- **Desktop Large ($\ge$ 1280px):** Full 3-panel view. All panels visible simultaneously.
- **Desktop / Laptop (1024px – 1279px):** 3-panel layout with compact left/right widths (260px / 300px).
- **Tablet (768px – 1023px):** 2-panel layout. Left sources panel collapsible; Right studio panel toggles as a slide-over drawer.
- **Mobile (< 768px):** Single-panel view with tab-based switcher at the top: `[Sources] [Chat] [Studio]`.
