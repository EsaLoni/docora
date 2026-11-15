# UDIP PHASE 13.1 — NOTEBOOKLM-GRADE UI/UX TRANSFORMATION REPORT
**Platform:** Universal Document Intelligence Platform (UDIP)  
**Date:** November 15, 2026  
**Lead Product Designer & Staff Frontend Engineer:** UDIP Design System Team  
**Design Reference:** Google NotebookLM Visual Interaction System  
**Live Workspace:** `http://localhost:3000/notebooks/48d44234-dfed-4022-8329-1739548f4a09`

---

## 1. Design Vision & Paradigm Shift

Prior iterations of the UDIP Notebook UI exhibited common enterprise dashboard tropes: sharp right-angle borders, crowded tables, harsh high-contrast white surfaces, full-width edge-to-edge inputs, and utilitarian form modals.

Phase 13.1 transforms the interface into an immersive, distraction-free **AI Research Studio** inspired by Google NotebookLM.

### Core Visual Principles:
1. **Calm, Dark-First Aesthetic:** Soft obsidian canvas background (`#0B0B0B`), muted slate panels (`#1B1B1B`), elevated interactive tiles (`#202020`), and subtle borders (`#303030`).
2. **Floating Rounded Cards:** Panels float with `rounded-3xl` radii, subtle borders, and soft depth shadows rather than sharp dividers touching the viewport edge.
3. **Ergonomic Reading Hierarchy:** The central workspace constrains conversation reading width to an optimal 740px measure for comfortable readability, preventing eye fatigue.
4. **Floating Pill Composer:** A multi-feature floating capsule input (`rounded-3xl`, `#252525`) anchored at the bottom of the central canvas with a 6-option response style selector (`Normal`, `Concise`, `Explanatory`, `Structured`, `Technical`, `Bullet Points`).
5. **Draggable & Collapsible Panels:** Draggable custom divider rails with double-click reset to default widths (360px left, 380px right) and 48px collapse icon rails.

---

## 2. Color Palette & Design Tokens Specification

The design tokens are centralized in `frontend/src/app/globals.css` and utilized across all 14 decomposed workspace components:

```css
:root {
  /* Canvas & Panel Surfaces */
  --bg-app: #0B0B0B;              /* Deep canvas background */
  --panel: #1B1B1B;               /* Primary floating panel background */
  --panel-raised: #202020;        /* Elevated card & header surface */
  --composer: #252525;            /* Floating pill composer background */
  --tile: #202020;                /* Studio tool & artifact tile surface */
  --tile-hover: #2A2A2A;          /* Interactive hover highlight */
  
  /* Borders & Dividers */
  --border-subtle: #303030;       /* Fine structural boundary */
  --border-divider: #383838;      /* Splitter rail border */
  
  /* Typography & Contrast */
  --text-primary: #F1F3F4;        /* High-clarity primary copy */
  --text-secondary: #BDC1C6;      /* Readable secondary body copy */
  --text-muted: #80868B;          /* Muted metadata, timestamps, tokens */
  
  /* Accent & Status */
  --accent-blue: #8AB4F8;         /* Google-inspired serene blue accent */
  --accent-blue-hover: #AECBFA;   /* Accent interactive hover */
  --accent-purple: #D7AEFB;       /* Secondary creative accent */
  --success: #34D399;             /* Grounded verification green */
  --warning: #FBBF24;             /* Notice amber */
  --danger: #F87171;              /* Destructive action red */
}
```

---

## 3. Detailed Component Architecture Breakdown

### 3.1 Workspace Header (`WorkspaceHeader.tsx`)
- **Back Navigation:** Minimalist arrow leading back to the notebook directory.
- **Inline Renaming:** Click-to-edit notebook title with autosave on blur and Enter key.
- **Model Badge:** Dynamic model preview indicator (`Gemini 3 Flash` / `gemini-3-flash-preview`) sourced directly from `/api/v1/config/public`.
- **Global Actions:** Quick-launch Share dialog, Command Palette trigger (`Ctrl+K`), and Theme toggle.

### 3.2 Left Sources Panel (`SourcesPanel.tsx`)
- **Knowledge Drawer:** Lists all grounded sources attached to the notebook.
- **Multi-Source Selection:** Master checkbox to toggle all sources active/inactive for RAG queries.
- **Individual Checkbox Toggles:** Instant PATCH to toggle inclusion of specific documents.
- **Add Source Button:** Prominent floating rounded pill opening the multi-tab `AddSourceModal` (Document file upload, Web URL scrape, YouTube video transcript, Plain text note).
- **Source Badges:** Distinct icons and color-coded tags for PDF, Word (.docx), Excel (.xlsx), Web URLs, and Notes.

### 3.3 Center Workspace & Chat (`ChatPanel.tsx`)
- **Optimized Content Width:** 740px maximum reading container with generous breathing room.
- **Message Cards:** Assistant messages render clean Markdown, bold lead-ins, and clickable inline citation badges (e.g. `[1]`, `[2]`).
- **Citation Inspection:** Clicking any citation badge opens a popup modal with the exact excerpt, source document name, and page number.
- **Floating Pill Composer:**
  - Multi-line autosizing textarea with `Enter` to submit and `Shift+Enter` for newline.
  - Quick-prompt suggestions (e.g. "Summarize key findings", "What are the risks?", "Extract action items").
  - Response style selector pill (Normal, Concise, Explanatory, Structured, Technical, Bullet Points).

### 3.4 Right Studio Panel (`StudioPanel.tsx`)
- **Studio Header:** Clean category header with count of generated artifacts.
- **9 Distinct Studio Tool Tiles:**
  1. 🎧 **Audio Overview:** Deep conversational dialogue podcast generator.
  2. ❓ **Interactive Quiz:** Comprehension assessment with multiple-choice, multi-select, and rationales.
  3. 🗂️ **Flashcards:** Spaced-repetition active recall deck with difficulty tags.
  4. 📊 **Slide Deck:** Executive PowerPoint presentation generator with downloadable `.pptx`.
  5. 📑 **Reports:** Structured multi-section briefing with downloadable `.docx`.
  6. 📋 **Data Tables:** Tabular metric and entity extraction with downloadable `.xlsx`.
  7. 🧠 **Mind Map:** Hierarchical concept tree and relationship knowledge graph.
  8. 📰 **Infographic:** Modern Bento-grid visual statistics summary.
  9. 🎬 **Video Summary:** Scene-by-scene explainer storyboard with voiceover scripts.
- **Artifacts Timeline:** Chronological list of previously generated artifacts with instant preview click and download export button.

### 3.5 Dedicated Artifact Viewers (`ArtifactViewerModal.tsx`)
Rather than dumping raw JSON, each artifact type has a custom interactive viewer:
- **Audio:** Audio waveform player with Play/Pause, speed adjustment (1x, 1.25x, 1.5x, 2x), and two-host dialogue transcript.
- **Quiz:** Scored quiz engine with interactive option selection, submit button, automated percentage grading, rationale explanations, and exact citations.
- **Flashcards:** Interactive 3D flip card with question front, answer back, difficulty badge, and citation reference.
- **Presentation:** Slide carousel with slide navigation (`Slide X of Y`), title, subtitle, bullet points, and speaker notes drawer.
- **Data Table:** Responsive data grid with column headers, formatted metric cells, and page citations.
- **Mind Map:** Concept tree visualization with root theme, primary branches, sub-topics, and edge relationship labels.
- **Infographic:** Bento grid layout with hero statistic card and multi-column takeaway modules.
- **Video:** Storyboard scene sequence with durations, visual directions, voiceover scripts, and on-screen text.

### 3.6 Command Palette (`CommandPalette.tsx`)
- Triggered by `Ctrl+K` or `Cmd+K` anywhere in the app.
- Fuzzy search over tools, sources, notes, and actions.
- Full keyboard accessibility with arrow key navigation and Enter selection.

---

## 4. Usability & Accessibility Compliance

- **Contrast Ratios:** Primary text `#F1F3F4` against `#1B1B1B` panel yields a contrast ratio of **13.8:1**, exceeding WCAG AAA standards (7:1).
- **Keyboard Navigation:** Tab orders flow logically through Header → Sources → Chat Composer → Studio Tiles. Modals trap focus and close on `Escape`.
- **Screen Reader Support:** Semantic HTML headings (`h1` through `h4`), ARIA labels on icon buttons, and `role="dialog"` on modals.
