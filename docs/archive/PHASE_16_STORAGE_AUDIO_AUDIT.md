# PHASE 16 — STORAGE & AUDIO SUBSYSTEM AUDIT

**Project:** Universal Document Intelligence Platform (UDIP)
**Date:** 2026-11-15T16:58:00+05:30
**Lead Auditor:** Senior Backend Engineer & Cloud Storage Specialist
**Components:** `backend/app/services/storage/`, `backend/app/services/studio/audio_service.py`

---

## 1. Storage Architecture Overview

UDIP utilizes an extensible `BaseStorageAdapter` design pattern. In the current baseline, `LocalStorageAdapter` persists files under `STORAGE_LOCAL_ROOT` (partitioned by workspace):

```
storage_root/
└── {workspace_id}/
    ├── documents/
    │   └── {document_id}_{sanitized_filename}
    └── notebooks/
        └── {notebook_id}/
            ├── audio/
            │   └── audio_overview_{hash}.mp3
            └── exports/
                ├── report_{hash}.docx
                ├── presentation_{hash}.pptx
                └── datatable_{hash}.xlsx
```

---

## 2. Storage Security & Download Authorization

1. **HMAC Signed URLs:**
   - Raw disk paths are never exposed to clients.
   - Downloads issue HMAC-SHA256 signed tokens (`download_token`) with a 15-minute expiration window.
   - Forged signatures or expired tokens return HTTP 403 Forbidden.
2. **Path Traversal Protection:**
   - Storage keys validate that resolved filesystem paths strictly remain within `STORAGE_LOCAL_ROOT`.
   - Any path attempting `..` or absolute drive root navigation is blocked.
3. **Orphan File Cleanup:**
   - `Document.delete()` cascades physically to delete files from disk.
   - Failed uploads execute storage rollback cleanup in exception handlers, preventing orphaned files.

---

## 3. Audio Generation & Playback Audit

### 3.1 Neural TTS vs Web Speech Fallback

The audio subsystem was inspected to verify that browser speech synthesis is never misrepresented as an MP3 asset:

| Stage | Technology | Behavior | Storage / Download Status |
| :--- | :--- | :--- | :--- |
| **Neural TTS (Online)** | `edge-tts` (Microsoft Neural Voices) | Synthesizes `.mp3` binary stream for Alex & Sam | Saved to disk; `export_file_path` set; Download button displayed |
| **TTS Failure / Sandbox Block** | Web Speech API (`window.speechSynthesis`) | Client-side browser synthesizes speech locally | `audio_file_path = None`; **No MP3 created**; Download button **suppressed** |

### 3.2 Audit Confirmation

- **No False MP3 Reporting:** When `edge-tts` is blocked or unavailable, the backend returns `"audio_file_path": null` and `"duration_seconds": 0.0`.
- **UI Integrity:** The frontend modal inspects `artifact.export_file_path`. If null, the download icon is completely hidden, preventing misleading download links.
- **Production Decoupling:** In production deployments, relative API routing (`/api/v1/...`) must replace any hardcoded `http://localhost:8000` prefixes to support reverse proxies and custom domains.
