# UDIP Phase 14 — UI/UX Design System & NotebookLM-Grade Workspace Report

**Project:** Universal Document Intelligence Platform (UDIP)  
**Date:** November 15, 2026  
**Design Reference:** Google NotebookLM Dark Workspace Architecture  
**Design Tokens:** Charcoal Palette (#0B0B0B / #1F1F1F / #252525 / #303030 / #8AB4F8)

---

## 1. Visual Design Philosophy

The primary objective of Phase 14 UI/UX engineering was to transform UDIP from an enterprise dashboard into a distraction-free, calm, intelligent research studio inspired by Google NotebookLM.

### Non-Negotiable Aesthetics
- **No SaaS Clutter:** No chunky admin sidebars, heavy borders, generic table grids, or distracting vibrant badges.
- **Dark-First Immersion:** Seamless `#0B0B0B` backdrop canvas with floating `#1F1F1F` rounded panels (`rounded-3xl`).
- **Balanced Proportions:** 
  - Left Sources Panel: ~365px–390px (default 360px)
  - Center Workspace: Flexible, dominant reading and conversation area
  - Right Studio Panel: ~380px–405px (default 380px)
- **Fluid Resizing:** Draggable dividers with visual hover feedback, double-click to reset, and 48px collapsed state rails.

---

## 2. Typography Hierarchy

Using modern sans-serif typography with calibrated line heights and weights:

| Hierarchy Level | Font Size | Weight | Line Height | Color Token | Application |
|---|---|---|---|---|---|
| **Notebook Title** | 30–34px | SemiBold (600) | 1.25 | `#F1F3F4` | Header editable title & Notebook Overview banner |
| **Page Title** | 26–30px | SemiBold (600) | 1.30 | `#F1F3F4` | Auth headings (`Welcome to UDIP`, `Create Account`) |
| **Section Headings** | 18–20px | Medium (500) | 1.40 | `#F1F3F4` | Sources / Studio panel headers, modal titles |
| **Body Reading Text** | 16–17px | Regular (400) | 1.65 | `#F1F3F4` | Central AI grounded answers & research notes |
| **Source Names** | 14–15px | Medium (500) | 1.40 | `#B8BDC7` | Document cards & active citation labels |
| **Secondary Metadata** | 12–13px | Regular (400) | 1.35 | `#9299A4` | Page counts, timestamps, token counts |
| **Interactive Buttons** | 14–15px | Medium (500) | 1.00 | `#FFFFFF` | Primary actions (`Sign In`, `Generate Now`) |
| **Composer Textarea** | 16px | Regular (400) | 1.50 | `#F1F3F4` | Floating pill input (prevents iOS/mobile zoom) |
| **Code & Monospace** | 14px | Regular (400) | 1.50 | `#8AB4F8` | Syntax blocks, token previews, file hashes |

---

## 3. Workspace Component Breakdown

### 3.1 Header (`WorkspaceHeader.tsx`)
- **Left:** Return to notebooks arrow, UDIP brand logo badge, inline editable notebook title with click-to-rename and escape-cancel, and active model badge (`Gemini 3 Flash`).
- **Center:** Uncluttered negative space preserving reading focus.
- **Right:** Quick Command Palette trigger (`Cmd K` / `Ctrl+K`), Share button with clipboard copy confirmation, Theme toggle (Dark/Light), Left/Right panel toggle buttons, and an interactive Account Avatar menu showing user details and sign-out.

### 3.2 Left Panel — Sources (`SourcesPanel.tsx`)
- Add sources trigger (+ Add Sources), New Note trigger, Select All / Deselect toggle.
- File-type icons (PDF, Word, Markdown, Spreadsheets, Presentations, Audio).
- Source active toggles (`is_active_for_queries`) allowing users to dynamically restrict RAG grounding context.
- Sources search filter and clean metadata badges (`Page 1 • Ready`).

### 3.3 Center Panel — Grounded Conversation (`ChatPanel.tsx`)
- Reading-first presentation: No card-wrapped responses; clean markdown rendering with comfortable content max-width (820px).
- Clickable citation pills (`[Source 1]`) displaying document name and extracted quote on hover.
- Follow-up suggestion chips (`"Summarize certifications"`, `"Extract employment timeline"`, `"Identify key achievements"`).
- Copy response, Save as Note, and feedback triggers on every assistant message.
- Floating Pill Composer: Centered near bottom with attachment trigger, 6 response style presets (Default, Concise, Detailed, Technical, Socratic, Executive), selected sources counter, and send/stop button.

### 3.4 Right Panel — Studio (`StudioPanel.tsx`)
- All 9 Studio Engines:
  1. **Audio Overview:** Deep Dive podcast discussion with multi-language selector.
  2. **Slide Deck:** Presentation slides with structured bullet points and downloadable PowerPoint (`.pptx`).
  3. **Video Overview:** Video script storyboard with scene directions.
  4. **Mind Map:** Interactive knowledge graph with hierarchical nodes and edges.
  5. **Reports:** Executive briefing documents and comprehensive analytical reports.
  6. **Flashcards:** Interactive study cards with question/answer flips and difficulty ratings.
  7. **Quiz:** Multiple-choice assessment with real interactive scoring and explanations.
  8. **Infographic:** Visual structured insights breakdown with stat highlights.
  9. **Data Table:** Extracted tabular data with column definitions and downloadable Excel (`.xlsx`).
- Generated Artifact History list with quick preview, full-screen interactive modal, and delete controls.

---

## 4. Modal Design System

All 9 tools share a unified, premium modal architecture (`StudioGenerationModal.tsx` & `ArtifactViewerModal.tsx`):
- Background: `#1F1F1F` elevated charcoal surface with `#303030` subtle borders and `rounded-3xl` corners.
- Segmented controls for generation style, length, and language options.
- Source selection checkboxes allowing granular document inclusion.
- Sticky footer with "Cancel" and "Generate Now" buttons with animated loading spinner.
- ESC key dismiss and focus trapping.
