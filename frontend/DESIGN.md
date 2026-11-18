---
name: "Docora Atelier"
description: "High-end document intelligence research studio with restrained, precision dark aesthetic"
colors:
  canvas: "#08090D"
  panel: "#0E1118"
  panel-raised: "#151823"
  surface-hover: "#1C202E"
  composer: "#12151F"
  border-hairline: "rgba(255, 255, 255, 0.08)"
  border-highlight: "rgba(255, 255, 255, 0.16)"
  primary: "#6366F1"
  primary-hover: "#818CF8"
  primary-glow: "rgba(99, 102, 241, 0.15)"
  verified: "#10B981"
  verified-glow: "rgba(16, 185, 129, 0.12)"
  text-primary: "#F3F4F6"
  text-secondary: "#9CA3AF"
  text-muted: "#6B7280"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  panel-container:
    backgroundColor: "{colors.panel}"
    borderColor: "{colors.border-hairline}"
    rounded: "{rounded.xl}"
  card-interactive:
    backgroundColor: "{colors.panel-raised}"
    borderColor: "{colors.border-hairline}"
    rounded: "{rounded.lg}"
    textColor: "{colors.text-primary}"
  composer-box:
    backgroundColor: "{colors.composer}"
    borderColor: "{colors.border-hairline}"
    rounded: "{rounded.xl}"
---

# Docora Atelier Design System

## Brand Identity & Direction
Docora is an intelligent research workspace built for scholars, analysts, executives, and knowledge workers. It rejects standard "AI slop" — meaning:
* **No generic rainbow tiles:** Studio tools share an editorial, unified visual language rather than a clown-car of mismatched neon badges.
* **No muddy gray borders:** Containers use crisp, ultra-fine white hairlines (`rgba(255, 255, 255, 0.08)`) with subtle inner bevels that evoke glass and machined obsidian.
* **No heavy nested cards:** Layouts breathe with deliberate rhythm, generous negative space, and content-first typography.
* **Tactile & Responsive:** Controls respond to user action with crisp state shifts (`active:scale-[0.98]`, subtle luminous border highlights on focus).

## Color System Application
* **Canvas (`#08090D`):** The foundational void. Deep, neutral, velvety black with no muddy blue casts.
* **Workspace Panels (`#0E1118`):** Rested surfaces for reading and drafting, framed by subtle hairline boundaries.
* **Raised Cards & Tiles (`#151823`):** Interactive items that elevate on hover with `rgba(255, 255, 255, 0.04)`.
* **Electric Indigo (`#6366F1`):** Precision accent for intentional actions (generate, submit, active selection).
* **Emerald Citation (`#10B981`):** Dedicated to verified source-grounded truth and factual citations.

## Typography Hierarchy
* **Headings:** Negative letter-spacing (`-0.02em` to `-0.03em`), clear weight separation, high contrast (`#F3F4F6`).
* **Reading Body:** 15px font size with 1.6 line-height for effortless reading of research documents and assistant responses.
* **Metadata & Badges:** 11px uppercase with `tracking-wider` and muted contrast for unobtrusive guidance.
* **Code & Citations:** Crisp monospace with subtle background encapsulation.

## Spatial System & Elevation
* Multi-panel floating canvas layout with 12px perimeter margins on desktop.
* Hairline borders (`border-white/[0.08]`) replace generic thick borders.
* Inset rim highlights (`shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]`) create authentic hardware-like depth.
