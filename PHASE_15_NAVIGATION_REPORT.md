# UDIP Phase 15 — Unified Navigation & Feature Responsibility Specification

**Project:** Universal Document Intelligence Platform (UDIP)  
**Date:** November 15, 2026  
**Architect:** Principal Product Architect & UX Specialist  
**Status:** Implemented in `Sidebar.tsx`, `AppShell.tsx`, `Header.tsx`, and route structures

---

## 1. Unified 5-Item Navigation Architecture

UDIP has been unified around five primary navigation items that represent the entire product lifecycle:

```
┌────────────────────────────────────────────────────────────────────────┐
│                               UDIP                                     │
├────────────────────────────────────────────────────────────────────────┤
│  [🏠]  Home            (/)            Universal overview & quick AI Q&A│
│  [🔖]  My Notebooks    (/notebooks)   Dedicated research workspaces    │
│  [📁]  My Documents    (/documents)   Central document library & Q&A   │
│  [✨]  AI Insights     (/insights)    Summaries, extract, diff, stats  │
│  [☑️]  Tasks           (/tasks)       Action items, deadlines, alerts  │
├────────────────────────────────────────────────────────────────────────┤
│  [⚙️]  Settings        (/settings)    Workspace & isolation policies   │
│  [👤]  Account Profile (useAuth)      Active user, avatar & sign-out   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Elimination of Navigation Redundancies

### A. Removal of Standalone "Ask UDIP" Sidebar Entry
- **Previous state:** `/chat` was displayed as a separate navigation item, creating confusion with notebook-level chat.
- **Unified solution:**
  1. Universal document questioning is embedded directly on **Home (`/`)** via a prominent prompt bar with instant streaming answers.
  2. Document-specific questioning is available in **My Documents (`/documents`)** through an in-library slide-over Q&A drawer.
  3. Deep contextual grounded chat is anchored inside **My Notebooks (`/notebooks/[id]`)** within the 3-panel workspace.
  4. The `/chat` route remains operational in the backend for backward compatibility without cluttering navigation.

### B. Consolidation of Action Items, Suggestions & Reminders
- **Previous state:** Three disparate pages existed (`/tasks`, `/actions`, `/reminders`).
- **Unified solution:** Unified into **Tasks (`/tasks`)** with three clean sub-tabs:
  1. *Action Items:* Approved obligations and manual task tracking.
  2. *Candidate Suggestions:* Human-in-the-loop review of AI-discovered commitments.
  3. *Reminders:* Scheduled deadlines and notifications.
  4. Legacy routes `/actions` and `/reminders` automatically redirect to `/tasks`.

---

## 3. Strict Feature Responsibilities

| Section | Core Responsibilities | Key Interactions |
|---|---|---|
| **Home (`/`)** | Universal entry point, workspace pulse, quick queries | Quick AI question entry, recent notebooks, recent documents, system grounding telemetry. |
| **My Notebooks (`/notebooks`)** | Project-based deep research studios | Notebook creation modal, search by topic/title, last-opened indicators, direct link to 3-panel workspace. |
| **My Documents (`/documents`)** | Central enterprise file repository | Drag-and-drop upload, status filters (Ready, Queued, Processing, Failed), folder management, in-library Q&A drawer. |
| **AI Insights (`/insights`)** | Analytical intelligence powerhouse | 4 focused sub-tools: Summaries (4 formats), Data Extraction (Invoices/Contracts), Document Comparison (side-by-side diff), Analytics. |
| **Tasks (`/tasks`)** | Actionable commitments & obligations | Task status toggle, priority ranking (Critical, High, Medium, Low), candidate approval, deadline scheduling. |
| **Settings & Account** | Security, isolation & session lifecycle | Cryptographic workspace ID status, retrieval algorithm preference, user avatar initials, authenticated email, and sign out. |
