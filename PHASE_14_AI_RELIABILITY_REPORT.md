# UDIP Phase 14 — AI Engine Reliability & Studio Hardening Report

**Project:** Universal Document Intelligence Platform (UDIP)  
**Date:** November 15, 2026  
**Primary AI Provider:** Google Gemini API (`v1beta`)  
**Active Production Model:** `gemini-3-flash-preview`  
**Fallback Chain:** `gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-preview`, `gemini-3.5-flash-lite`

---

## 1. Root Cause Analysis of Prior Failures

Prior to Phase 13.1 and Phase 14, Studio generation occasionally returned `"Generation error: Service error"` (HTTP 500). Detailed tracing revealed three distinct root causes:

1. **Short LLM Timeout (30.0s):** Comprehensive generations (e.g. 5+ question interactive quizzes with options, rationales, and source citations) require 35–45 seconds of generation time. The prior 30-second client timeout caused an unhandled `httpx.TimeoutException`.
2. **Markdown Wrapping vs Native JSON Mode:** Prompt-based JSON instructions frequently resulted in markdown formatting (````json ... ````) or conversational preamble text, causing standard `json.loads` to fail.
3. **Deprecated Fallback Model Names:** In Google Gemini's v1beta REST endpoints, fallback tiers `gemini-1.5-flash` or `gemini-2.0-flash` return HTTP 404 or quota exhaustion, whereas `gemini-3.1-flash-lite` succeeds with low latency.

---

## 2. Hardening Measures Implemented

### 2.1 90-Second Timeout Window
In `backend/app/core/config.py`:
```python
LLM_TIMEOUT_SECONDS: float = 90.0
```
Allows deep multi-section synthesis, complex slide decks, and comprehensive mind map graph generation to complete without network timeouts.

### 2.2 Native Gemini JSON Mode
In `backend/app/services/llm/gemini.py`:
```python
if response_mime_type == "application/json":
    payload["generationConfig"]["responseMimeType"] = "application/json"
```
Forces the model to decode schema-compliant JSON directly at the token decoding level.

### 2.3 Resilient Fallback Chain
```python
FALLBACK_FLASH_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.5-flash-lite",
]
```
If an HTTP 429 (rate limit) or transient failure occurs on `gemini-3-flash-preview`, requests automatically fall back to the next candidate model with exponential retry backoff.

### 2.4 Route & Schema Harmonization
- Supported route aliases: `@router.post("/slides")` and `@router.post("/data_table")`.
- Added `@model_validator(mode="before")` on `StudioGenerateRequest` to accept flexible aliases: `topic` -> `topic_focus`, `settings` -> `options`, and string quantities (`"fewer"`, `"standard"`, `"more"`) -> integers.

---

## 3. Real Live Generation Benchmarks

Live generations executed on notebook `48d44234-dfed-4022-8329-1739548f4a09` using real Google Gemini AI:

| Studio Engine | Output Artifact ID | Execution Time | Output Characteristics |
|---|---|---|---|
| **Interactive Quiz** | `73af48e3-0bab-47e7-a992-fba6be68b8c8` | 6.05s | 3 questions with options, rationales, citations |
| **Study Flashcards** | `586631a3-18ae-4f2d-99fd-b773804cf49a` | 6.24s | 5 cards with difficulty ratings & source references |
| **Slide Deck** | `73eaa099-ed2d-48b9-b597-31a3246f2724` | 8.23s | 6 presentation slides + `.pptx` PowerPoint file |
| **Mind Map** | `6126663b-16a6-4270-8dd7-411aac3e177e` | 8.93s | 14 nodes, 14 edges knowledge graph |
| **Data Table** | `f84e577e-2d05-4173-9abb-67d9c1cc4a3f` | 8.77s | 4 columns, 5 records + `.xlsx` Excel file |

All generated artifacts are persisted in the `studio_artifacts` database table and remain accessible across browser sessions.
