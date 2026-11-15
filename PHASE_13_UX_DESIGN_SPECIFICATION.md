# UDIP PHASE 13 — UX DESIGN & DESIGN SYSTEM SPECIFICATION
**Project:** Universal Document Intelligence Platform (UDIP)  
**Spec Title:** NotebookLM-Grade Immersive Research Studio Design Specification  
**Version:** 1.0  
**Date:** November 15, 2026  

---

## 1. Design Philosophy & Visual Tenets

The design vision for UDIP Notebook is an **uncompromising, calm, high-density research studio**. When users open a notebook, the interface recedes, placing primary cognitive emphasis on **ground-truth knowledge, source-verified synthesis, and intelligent artifact creation**.

### Core Tenets:
1. **Canvas & Floating Surfaces:** The interface is not a rigid spreadsheet or dashboard. The viewport represents an infinite dark canvas (`#0B0B0B`), upon which three floating rounded panels (`#1B1B1B` with 24px corner radius) hover with subtle 12px spatial gaps.
2. **Restrained Contrast Hierarchy:** High-contrast white (`#F5F5F5` / `#F1F3F4`) is reserved strictly for primary reading text. Secondary information uses muted zinc (`#B7B7B7`), and metadata uses `#858585`.
3. **No Gratuitous Skeuomorphism:** Zero heavy drop shadows, garish neon glows, or distracting gradients. Surfaces communicate elevation through pure tonal shifts and 1px borders (`#303030`).
4. **Instant Grounding Feedback:** Modifying source checkboxes immediately updates the grounding pill and active source count without page reloads.

---

## 2. Design Tokens & Color Palette

### 2.1 Dark Mode Tokens (Default)
| Token Name | Hex Value | Purpose / Role |
| :--- | :--- | :--- |
| `--canvas` | `#0B0B0B` | Deep void background of the entire workspace viewport |
| `--panel` | `#1B1B1B` | Base surface for the three floating panels |
| `--panel-raised` | `#202020` | Elevated headers, toolbars, and search containers |
| `--tile` | `#202020` | Source items, note cards, and studio tool tiles |
| `--tile-hover` | `#262626` | Interactive hover state for tiles and list elements |
| `--border-subtle` | `#303030` | 1px boundary dividing panels, tiles, and headers |
| `--border-strong` | `#404040` | Divider drag handles, focused inputs, and active borders |
| `--text-primary` | `#F5F5F5` | Main document text, user prompts, and active titles |
| `--text-secondary` | `#B7B7B7` | Subheadings, summaries, and conversational responses |
| `--text-muted` | `#858585` | Timestamps, token counts, and helper instructions |
| `--accent-blue` | `#3156D8` / `#8AB4F8` | Primary brand accent, send buttons, active indicators |
| `--accent-soft` | `rgba(49, 86, 216, 0.15)` | Selected pill backgrounds and subtle focus halos |
| `--composer` | `#252525` | Floating bottom composer container |
| `--citation` | `#10B981` | Source citation pill badges and verified badges |

### 2.2 Light Mode Tokens (Toggleable)
| Token Name | Hex Value | Purpose / Role |
| :--- | :--- | :--- |
| `--canvas` | `#F8F9FA` | Clean off-white canvas |
| `--panel` | `#FFFFFF` | Pure white floating panel surface |
| `--panel-raised` | `#F1F3F4` | Light gray toolbars and secondary headers |
| `--tile` | `#F1F3F4` | Source items and note cards |
| `--tile-hover` | `#E8EAED` | Hover state for interactive tiles |
| `--border-subtle` | `#E0E2E5` | Clean boundary lines |
| `--border-strong` | `#D0D3D6` | Divider drag handles and active borders |
| `--text-primary` | `#1F1F1F` | High-contrast dark charcoal text |
| `--text-secondary` | `#444746` | Secondary body text |
| `--text-muted` | `#747775` | Captions and metadata |
| `--composer` | `#FFFFFF` | Floating white composer with elevation shadow |

---

## 3. Typography & Hierarchy

- **UI & Chat Body:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, sans-serif. Clean, crisp, legible at small sizes (11–13px).
- **Display & Notebook Titles:** `Plus Jakarta Sans` / `Inter`, weight 600/700, -0.02em tracking.
- **Code & Diagnostics:** `JetBrains Mono`, `monospace`.

---

## 4. Layout Architecture: Three Floating Panels

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Brand "UDIP" | [Editable Title] | [Gemini 3 Flash] | [Cmd K] [Share] [Theme] [Av]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐ ║ ┌───────────────────────────────────────┐ ║ ┌────────────────┐ │
│ │ LEFT: SOURCES     │ ║ │ CENTER: CHAT & SYNTHESIS              │ ║ │ RIGHT: STUDIO  │ │
│ │ [Sources] [Notes] │ ║ │                                       │ ║ │ 9-Engine Grid  │ │
│ │ [+ Add] Search    │ ║ │  [AI synthesis with inline citations] │ ║ │ ┌────┐ ┌─────┐ │ │
│ │ ☑ Source 1 (PDF)  │ ║ │  [Actions: Copy, Note, Feedback]      │ ║ │ │Audio│ │Video│ │ │
│ │ ☑ Source 2 (Web)  │ ║ │                                       │ ║ │ └────┘ └─────┘ │ │
│ │                   │ ║ │                                       │ ║ │ Recent Artifacts│ │
│ │                   │ ║ │ ┌───────────────────────────────────┐ │ ║ │ • Quiz (Ready) │ │
│ │                   │ ║ │ │ Floating Composer Pill            │ │ ║ │ • Flashcards   │ │
│ │                   │ ║ │ └───────────────────────────────────┘ │ ║ │                │ │
│ └───────────────────┘ ║ └───────────────────────────────────────┘ ║ └────────────────┘ │
│                     Handle 1                                  Handle 2                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Panel Behaviors
- **Default Widths:** Left: 360px (min 280px, max 550px). Right: 380px (min 300px, max 550px). Center: `flex-1` (min 320px).
- **Draggable Resizing:** Click and drag divider bars with interactive hover state. Double-click divider resets to default dimensions.
- **Collapse to 48px Icon Rails:** When left or right panel is collapsed, it contracts to a sleek 48px vertical rail with vertical title orientation and single-click expand button.
- **Persistence:** Panel widths and collapse states are persisted in `localStorage`.

---

## 5. Floating Composer Specification

The bottom composer floating inside the Center Panel is built as a **rounded pill** (`rounded-3xl` / `rounded-full`):
- Background: `var(--composer)`
- Border: `1px solid var(--border-subtle)`
- Elevation: `shadow-lg`
- Height: Auto-expanding textarea (40px base height, max-height 128px with smooth overflow scroll).
- Controls inside composer:
  - Left: Response style selector (`Balanced`, `Learning Guide`, `Executive Analyst`, `Academic Scholar`, `Ultra Concise`, `Deep Dive`).
  - Center: Prompt textarea with placeholder reflecting active source count.
  - Right: Floating circular send button (`w-8 h-8 rounded-full bg-[var(--accent-blue)] text-white`).

---

## 6. Responsive Breakpoint Rules

1. **Desktop (>= 1280px):** Full three-panel floating workspace with interactive divider resizing.
2. **Tablet (768px – 1279px):** Two-panel layout (Center Chat dominant + Sources or Studio).
3. **Mobile (< 768px):** Single active panel with sleek bottom navigation tabs (`Sources`, `Chat`, `Studio`).
