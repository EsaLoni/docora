# UDIP — Phase 11 UI/UX Reconstruction Report: Google NotebookLM Experience

**Project Root:** `C:\Users\esalo\Desktop\universal-document-intelligence`  
**Platform:** Universal Document Intelligence Platform (UDIP)  
**Phase:** Phase 11 UI/UX Reconstruction  
**Date:** November 14, 2026  
**Auditor / Lead UI Architect:** UDIP Senior Product Engineering & Design Systems Team  

---

## 1. Executive Summary & Design Transformation

This reconstruction transforms UDIP from a traditional dashboard into an **immersive, sophisticated AI-powered Notebook workspace** directly matching the observable visual language, density, and interaction patterns of Google NotebookLM.

### Key Architectural Shifts
1. **Full-Bleed Immersive Experience:** By introducing `AppShell.tsx`, the workspace at `/notebooks/[id]` now claims the entire viewport (`100vw × 100vh`) with zero outer dashboard margins or sidebar clutter, while preserving standard dashboard layouts for `/`, `/documents`, and `/notebooks`.
2. **Refined Dark Palette Design Tokens:** Shifted from generic gray-scale cards to an ultra-clean, low-contrast dark palette (`#0B0B0B` canvas, `#171717` panels, `#1E1E1E` composer, `#202020` elevated modals, `#303030` subtle borders, `#3156D8` primary blue).
3. **Three-Column Productivity Workspace:**
   - **Left Panel (400px):** Source management with file type icons, token counts, active checkboxes, web/source search bar, and notes drawer.
   - **Center Panel (Flexible):** Document-reading environment with editable title, creation metadata, AI Notebook Overview synthesis banner, grounded streaming chat with green citation pills, and a floating bottom composer.
   - **Right Panel (420px):** Studio tool hub featuring top Audio Overview & suggestion cards, a compact **two-column action grid** (Audio Overview, Slide Deck, Video Overview, Mind Map, Reports, Flashcards, Quiz, Infographic, Data Table), and a scrollable Generated Artifacts drawer.
4. **Universal Generation Modal Framework:** Reusable, centered elevated dialog (`w-[82%] max-w-5xl`) with segmented controls, language selector, source checkboxes, topic focus with suggestion chips, and a **fixed bottom action footer** with an AI usage indicator and Generate later/now buttons.

---

## 2. Design Tokens & Color Palette

| Token | Value | Applied Element |
| :--- | :---: | :--- |
| **Main Background** | `#0B0B0B` | Center conversation canvas, slide deck backdrop |
| **Panel Background**| `#171717` | Left Sources panel, Right Studio panel, Top header |
| **Secondary Surface**| `#1E1E1E` | Floating composer, sub-panel headers, modal footer |
| **Elevated Modal** | `#202020` | Generation modals, artifact cards, source cards |
| **Hover Surface** | `#292929` | Button hovers, active segmented control tabs |
| **Subtle Border** | `#303030` | Panel boundaries, modal borders, card dividers |
| **Active Border** | `#494949` | Active input outlines, focused cards |
| **Primary Blue** | `#3156D8` | Primary CTA ("Generate now", send icon, active tabs) |
| **Purple Accent** | `#9B72CF` | Slide deck iconography, recommendation banner |
| **Cyan Accent** | `#55C6D9` | Reports iconography, web source badges |
| **Green Accent** | `#43C59E` | Grounded citations (`[Source 1]`, page numbers), mind maps |
| **Amber Accent** | `#F59E0B` | Flashcards iconography, note indicators |
| **Rose Accent** | `#F43F5E` | Quiz iconography, YouTube badges, "Missed It" feedback |

---

## 3. Workspace Component Breakdown

### A. Top Navigation Header (`h-[52px]`)
- **Left:** Back button to `/notebooks`, rounded squircle notebook icon in primary blue, inline editable title (click-to-rename with blur-save), and active source counter badge (`1 active source`).
- **Right:** Sources & Studio panel collapse toggle pills, `Gemini 2.5 Flash` status pill, `+ Add Source` primary button (`#3156D8`), Share button, and profile menu.

### B. Left Panel: Sources (`w-[400px]`, Collapsible to `w-12`)
- **Header:** "Sources" title with source counter badge and panel collapse chevron.
- **Action Buttons:** Compact side-by-side buttons `[+ Add Sources]` and `[+ Add Note]`.
- **Search Bar:** Integrated search with placeholder *"Search sources or web..."*.
- **Grounding Controls:** "Select All" / "Deselect All" quick toggle.
- **Source List:** File type icons (PDF, DOCX, TXT, CSV, URL, YouTube, Audio), checkbox for grounding toggle, title, token count, remove icon, and click-to-inspect.
- **Notes Tab:** In-notebook scratchpad displaying authored and chat-saved notes with timestamps.

### C. Center Panel: Notebook Document Content & Chat
- **Document Overview Header:** Large notebook title (`text-2xl font-bold`), metadata row (sources count, creation date, last edited), and an **AI Notebook Overview Banner** summarizing key findings across uploaded sources.
- **Grounded Message Bubbles:**
  - User messages: clean `#3156D8` bubbles.
  - Assistant responses: document-styled `#171717` cards with formatted markdown, clickable green citation tags (`[esa_cv (2).pdf p. 1]`), "Copy", "Save as Note", and thumbs feedback.
  - Follow-up prompt pills: suggested exploration queries below answers.
- **Floating Bottom Composer:** Centered pill container with sliders icon (response mode selector: Default, Guide, Analyst, Academic, Concise, Detailed), auto-expanding textarea, source count tag, and `#3156D8` send button.

### D. Right Panel: Studio (`w-[420px]`, Collapsible to `w-12`)
- **Header:** "Studio" title, 9 Engines badge, collapse chevron.
- **Top Card 1:** Audio Overview language selector card (`Audio Overview • English (US) ▾`).
- **Top Card 2:** Recommendation banner highlighting presentation and quiz synthesis.
- **Two-Column Compact Action Grid:**
  1. Audio Overview (Headphones, `#3156D8`)
  2. Slide Deck (Presentation, `#9B72CF`)
  3. Video Overview (Video, `#E66AB4`)
  4. Mind Map (GitFork, `#43C59E`)
  5. Reports (FileText, `#55C6D9`)
  6. Flashcards (Layers, `#F59E0B`)
  7. Quiz (HelpCircle, `#F43F5E`)
  8. Infographic (LayoutGrid, `#14B8A6`)
  9. Data Table (FileSpreadsheet, `#06B6D4`)
- **Generated Artifacts Drawer:** Scrollable list with title, source tag, timestamp, status badge, inline view button, and direct file download (`.pptx`, `.docx`, `.xlsx`, `.mp3`).

---

## 4. Reusable Generation Modal Framework (Section 6)

Built in `frontend/src/components/studio/GenerationModalFramework.tsx`:
- Elevated dark surface (`bg-[#202020] border-[#303030] rounded-2xl w-[82%] max-w-5xl max-h-[90vh]`).
- Fixed bottom action footer:
  - Left: AI Usage Indicator (*"AI usage: 4 / 50 used this month • ~1 credit estimated"*).
  - Right: "Generate later" (outline ghost) + "Generate now" (`#3156D8` primary blue).

### Specific Modal Implementations:
1. **Quiz Modal (Section 6.1):**
   - Number of questions: `[Fewer (3)] [Standard (5)] [More (8)]`
   - Difficulty: `[Easy] [Medium] [Hard]`
   - Include images: `[Include (default)] [Text only]`
   - Question types: `Multiple choice`, `Multiple select`, `Fill in the blank`, `Short answer`
   - Language selector dropdown.
   - Sources multi-selection dropdown with "Select all".
   - Large topic textarea with contextual placeholder.
2. **Flashcards Modal (Section 6.2):**
   - Number of cards: `[Fewer (4)] [Standard (6)] [More (10)]`
   - Difficulty: `[Easy] [Medium] [Hard]`
   - Include images: `[Include] [Text only]`
   - Language selector dropdown.
   - Sources multi-selection dropdown.
   - Topic textarea with suggestion chips:
     - `Analysis Cycle Steps`
     - `SQL Technical Concepts`
     - `Toolbox Roadmap Sequencing`
3. **Audio Overview, Slide Deck, Video, Mind Map, Reports, Infographic, and Data Table Modals:** Configured with their respective specialized parameter controls.
