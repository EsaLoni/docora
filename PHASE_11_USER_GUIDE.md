# UDIP — Phase 11 User Guide: Gemini Notebook Experience

Welcome to the **Universal Document Intelligence Platform (UDIP)** Notebook & Studio interface, inspired by Google Gemini Notebook and NotebookLM. This guide walks you through every feature and workflow to maximize your research, study, and synthesis efficiency.

---

## 1. Accessing Your Notebooks

1. Navigate to the top navigation bar and click **Notebooks** (or visit `http://localhost:3000/notebooks`).
2. The **Notebooks Dashboard** displays all notebooks in your active workspace, showing source counts, notes counts, and color tags.
3. Click **+ New Notebook** to create a workspace. Enter a title, optional description, and select a color accent (Blue, Indigo, Emerald, Amber, Rose, or Purple).

---

## 2. Managing Knowledge Sources

Every notebook is grounded exclusively in the sources you provide:

### Adding Sources
1. In the **Left Panel**, click **+ Add Source**.
2. Select your source type:
   - **Upload Document:** Choose any PDF, Word document (`.docx`), presentation (`.pptx`), or Excel spreadsheet (`.xlsx`).
   - **Web Page (URL):** Enter any public website URL to crawl and ingest its text content.
   - **YouTube Video:** Paste a YouTube video link to extract its transcript and captions.
   - **Copied Text Note:** Paste raw notes, meeting transcripts, or code snippets.

### Selective Source Grounding
- Each source in the left panel features a **checkbox**.
- When checked (default), the source is included in AI Chat queries and Studio tools.
- Uncheck any source to temporarily exclude it from the AI's factual knowledge base without deleting it.

---

## 3. Grounded AI Chat & Persona Modes

The center panel provides real-time streaming conversational intelligence powered by Google Gemini:

### Asking Questions
- Type your question in the chat input (e.g., *"What are the core technical projects listed in my CV?"*).
- Responses stream in real-time with **exact citations** (e.g., `[Source 1]`, `[esa_cv.pdf p. 1]`).
- Clicking any citation pill opens the document viewer directly to that page.

### Response Modes
Switch modes using the dropdown above the chat input to tailor responses to your workflow:
- **Default:** Balanced, conversational synthesis with clear citations.
- **Learning Guide:** Step-by-step educational breakdown with concept analogies.
- **Analyst:** Data-driven, metrics-focused analysis with risk factors.
- **Academic:** Formal scholarly critique with methodological rigor.
- **Concise:** Bulleted, high-density executive summary.
- **Detailed:** Comprehensive, multi-section deep dive.

### Message Actions
- **Save as Note:** Click the bookmark icon below any answer to instantly copy it into your notebook's **Notes** drawer.
- **Copy:** Copy response markdown to your clipboard with one click.
- **Suggested Follow-Ups:** Click any of the prompt pills below an answer to continue exploring related concepts.

---

## 4. The Studio: 9 AI Synthesis Engines

The **Right Panel** features 9 specialized Studio tools that transform your sources into professional deliverables:

### 1. Audio Overview ("The Deep Dive" Podcast)
- Click **Audio Overview** $\to$ Choose Duration (Short, Standard, Extended) $\to$ Click **Generate Podcast**.
- Gemini generates a natural dialogue between co-hosts **Alex** and **Sam**, synthesized into an `.mp3` using Microsoft neural voices.
- Use the built-in audio player to Play, Pause, Seek, and change playback speed ($1\times$, $1.25\times$, $1.5\times$, $2\times$), or click **Download Audio** to save the file.

### 2. Slide Deck Generator
- Click **Slide Deck** $\to$ Select slide count (4, 6, 8, or 10 slides) and presentation style $\to$ Click **Generate Presentation**.
- Builds an editable PowerPoint presentation with slide titles, bullet points, and presenter speaker notes.
- Click **Download PPTX** to open and edit the presentation directly in Microsoft PowerPoint or Google Slides.

### 3. Interactive Mind Map
- Click **Mind Map** $\to$ Click **Generate Knowledge Graph**.
- Automatically extracts the central theme and clusters related concepts into an interactive node-and-edge diagram.
- Pan, zoom, and click nodes to view source evidence.

### 4. Report Generator
- Click **Report Generator** $\to$ Choose from 12 report archetypes (Executive Summary, Research Report, Study Guide, Technical Briefing, etc.) $\to$ Click **Generate Report**.
- Creates a structured, formatted document with headings, citations, and executive takeaways.
- Click **Download DOCX** to export a clean Microsoft Word document.

### 5. Interactive Flashcards
- Click **Flashcards** $\to$ Choose card count and difficulty $\to$ Click **Generate Flashcards**.
- Study using 3D flipping cards: click any card to reveal the answer and source citation.
- Track your mastery using **Got It** and **Missed It** buttons, or filter by Easy, Medium, and Hard.

### 6. Quiz Engine
- Click **Quiz Engine** $\to$ Select question count and difficulty $\to$ Click **Start Quiz**.
- Test your knowledge with interactive multiple-choice questions.
- Select your answer to receive instant scoring, correct answer highlights, and grounded source explanations.

### 7. Infographic Generator
- Click **Infographics** $\to$ Choose layout style (Bento Grid, Process Diagram, Timeline, Comparison) $\to$ Click **Generate Infographic**.
- Renders a visual executive summary with key statistics, callouts, and badge categories.

### 8. Data Table Generator
- Click **Data Tables** $\to$ Enter an extraction prompt (e.g., *"Extract all dates, milestones, and deliverables"*) $\to$ Click **Extract Table**.
- Gemini automatically infers table columns, extracts matching rows from all active sources, and populates the table.
- Click **Download XLSX** to export a formatted Microsoft Excel spreadsheet.

### 9. Video Overview Storyboard
- Click **Video Storyboard** $\to$ Select video style and target duration $\to$ Click **Generate Storyboard**.
- Produces a director-grade storyboard with scene-by-scene camera directions, visual AI prompts, and voiceover narration scripts.

---

## 5. Artifacts History Drawer

Every generated presentation, report, audio podcast, spreadsheet, or study deck is automatically preserved in your notebook:
- In the right panel, click **Artifacts** to open the version history drawer.
- Search past generated assets, inspect metadata (generation duration, token count), and re-download any `.pptx`, `.docx`, `.xlsx`, or `.mp3` file at any time.
