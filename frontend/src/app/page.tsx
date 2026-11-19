"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  ExternalLink,
  ArrowRight,
  BookOpen,
  Sparkles,
  Layers,
  HelpCircle,
  Presentation,
  GitFork,
  FileSpreadsheet,
  Headphones,
  Check,
  X,
  UploadCloud,
  ChevronRight,
} from "lucide-react";
import { CitationChip } from "@/components/ui/CitationChip";
import { Button } from "@/components/ui/Button";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

interface SampleCitation {
  id: string;
  sourceTitle: string;
  pageNumber: number;
  quote: string;
}

const SAMPLE_CITATIONS: Record<number, SampleCitation> = {
  1: {
    id: "cite-1",
    sourceTitle: "Indian Airlines Operational Performance Analysis.pdf",
    pageNumber: 4,
    quote:
      "Weather disruptions accounted for 34.2% of total delay minutes across domestic scheduled operations during the monitored period, with terminal airspace hold times at Delhi and Mumbai contributing over half of the recorded congestion duration.",
  },
  2: {
    id: "cite-2",
    sourceTitle: "Indian Airlines Operational Performance Analysis.pdf",
    pageNumber: 7,
    quote:
      "Quarterly network metrics indicated an average on-time arrival rate of 78.4%. Passenger load factors reached 86.1% during the fourth-quarter festive travel surge, representing the highest capacity utilization of the fiscal year.",
  },
  3: {
    id: "cite-3",
    sourceTitle: "Indian Airlines Operational Performance Analysis.pdf",
    pageNumber: 11,
    quote:
      "Aviation turbine fuel (ATF) expenditure represented 41.5% of total operating expenses across scheduled passenger carriers, creating substantial yield volatility and margin compression during periods of crude price escalation.",
  },
};

const STUDIO_OUTPUT_TYPES = [
  {
    icon: FileText,
    name: "Study Reports",
    desc: "Exhaustive multi-section synthesis dossiers with citations and structured table of contents.",
  },
  {
    icon: Headphones,
    name: "Audio Overviews",
    desc: "Two-host conversational podcast dialogues breaking down dense document findings.",
  },
  {
    icon: Presentation,
    name: "Slide Decks",
    desc: "Executive presentation decks structured for clean briefings and strategic reviews.",
  },
  {
    icon: GitFork,
    name: "Mind Maps",
    desc: "Hierarchical concept ontologies illustrating core relationships across multiple sources.",
  },
  {
    icon: HelpCircle,
    name: "Interactive Quizzes",
    desc: "Comprehension assessment tests with scored multiple-choice questions and rationales.",
  },
  {
    icon: Layers,
    name: "Flashcard Decks",
    desc: "Active recall study cards with spaced repetition principles for rapid concept retention.",
  },
  {
    icon: FileSpreadsheet,
    name: "Data Tables",
    desc: "Structured schema and entity extractions formatted into comparative numerical tables.",
  },
];

export default function HomePage() {
  const [activeCitationIndex, setActiveCitationIndex] = useState<number | null>(1);

  const activeCitation = activeCitationIndex ? SAMPLE_CITATIONS[activeCitationIndex] : null;

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans selection:bg-gold/20 select-none">
      {/* Top Header */}
      <header className="border-b border-hairline bg-surface/80 backdrop-blur-xs sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-title font-semibold text-ink tracking-tight">
              Docora
            </span>
            <span className="font-mono text-micro text-ink-muted border-l border-hairline pl-2">
              Document Intelligence
            </span>
          </div>

          <nav className="flex items-center gap-3">
            <a
              href="https://github.com/EsaLoni/docora"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors"
              title="GitHub Repository"
            >
              <GithubIcon className="w-4 h-4" />
            </a>
            <Link
              href="/notebooks"
              className="text-ui font-medium px-3 py-1.5 rounded-lg bg-surface border border-hairline hover:bg-surface-subtle text-ink transition-colors"
            >
              Live App
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16 sm:space-y-24">
        {/* Section 1: Hero */}
        <section className="space-y-6 text-left">
          <h1 className="font-serif text-display text-ink tracking-tight leading-tight max-w-2xl">
            Read, synthesize, and verify complex documents with grounded intelligence.
          </h1>

          <p className="font-sans text-reading text-ink-secondary max-w-xl leading-relaxed">
            Docora turns dense research papers, technical reports, and filings into clear answers backed by exact page-level citations.
          </p>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            {/* Exactly ONE Gold Primary Action */}
            <Link
              href="/notebooks"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gold text-gold-fg hover:bg-gold-hover font-sans text-ui font-medium transition-colors shadow-xs active:scale-[0.98]"
            >
              Open Workspace
            </Link>

            {/* Secondary Action */}
            <a
              href="https://github.com/EsaLoni/docora"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-surface border border-hairline hover:bg-surface-subtle text-ink font-sans text-ui font-medium transition-colors"
            >
              <GithubIcon className="w-4 h-4 mr-1.5" />
              <span>View Source</span>
            </a>
          </div>
        </section>

        {/* Section 2: Real Recorded Docora Answer (Labeled "Sample") */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-micro uppercase tracking-wider px-2 py-0.5 rounded bg-surface-subtle border border-hairline text-ink-muted">
              Sample Inquiry • Real Evidence
            </span>
            <span className="font-mono text-micro text-ink-muted">
              Source: Indian Airlines Operational Performance Analysis
            </span>
          </div>

          <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-7 space-y-5 shadow-xs">
            {/* User Question */}
            <div className="space-y-1">
              <span className="text-micro font-mono text-ink-muted uppercase">Question</span>
              <p className="font-sans text-ui font-medium text-ink leading-snug">
                What are the primary factors driving flight delays and operating cost variance across domestic routes?
              </p>
            </div>

            {/* Assistant Answer in Serif at 15/26 with 65ch measure */}
            <div className="space-y-2 border-t border-hairline pt-4">
              <span className="text-micro font-mono text-ink-muted uppercase block">
                Docora Synthesis
              </span>

              <div className="max-w-[65ch] font-serif text-reading leading-relaxed text-ink select-text">
                <p>
                  Across domestic scheduled sectors, weather disruptions accounted for 34.2% of total delay minutes, followed by airspace congestion and turnaround taxi delays at primary metropolitan hubs{" "}
                  <CitationChip
                    index={1}
                    sourceTitle="Indian Airlines Operational Performance Analysis.pdf"
                    pageNumber={4}
                    onClick={() => setActiveCitationIndex(1)}
                  />
                  . On-time performance averaged 78.4%, while passenger load factors peaked at 86.1% during fourth-quarter peak festive travel{" "}
                  <CitationChip
                    index={2}
                    sourceTitle="Indian Airlines Operational Performance Analysis.pdf"
                    pageNumber={7}
                    onClick={() => setActiveCitationIndex(2)}
                  />
                  . Route profitability remained heavily constrained by aviation turbine fuel prices, which represented 41.5% of total airline operating expenditure across all monitored carriers{" "}
                  <CitationChip
                    index={3}
                    sourceTitle="Indian Airlines Operational Performance Analysis.pdf"
                    pageNumber={11}
                    onClick={() => setActiveCitationIndex(3)}
                  />
                  .
                </p>
              </div>
            </div>

            {/* Interactive Source Passage Box */}
            {activeCitation && (
              <div className="rounded-lg bg-surface-subtle border border-hairline border-l-2 border-l-verdigris p-4 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-micro text-ink-muted">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-verdigris font-medium">
                      [{activeCitationIndex}]
                    </span>
                    <span className="font-sans font-medium text-ink">
                      {activeCitation.sourceTitle}
                    </span>
                    <span className="font-mono text-verdigris bg-verdigris-subtle border border-verdigris rounded px-1.5 py-0.2">
                      Page {activeCitation.pageNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCitationIndex(null)}
                    className="p-1 rounded text-ink-muted hover:text-ink"
                    title="Dismiss citation preview"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="font-serif text-reading leading-relaxed text-ink italic select-text">
                  "{activeCitation.quote}"
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Section 3: How it Works (3 Numbered Steps) */}
        <section className="space-y-6">
          <div className="space-y-1">
            <span className="text-micro font-mono uppercase tracking-wider text-ink-muted">
              Workflow
            </span>
            <h2 className="font-serif text-title text-ink font-semibold">
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="p-5 rounded-xl border border-hairline bg-surface space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="font-mono text-caption text-ink-muted font-medium">
                  01
                </span>
                <h3 className="font-sans text-section font-semibold text-ink">
                  Attach Documents
                </h3>
                <p className="font-sans text-ui text-ink-secondary leading-relaxed">
                  Upload PDFs, paste web links, or attach YouTube video transcripts. Docora extracts structure, chunks text, and builds lexical and vector indexes.
                </p>
              </div>
              <div className="pt-3 border-t border-hairline">
                <span className="text-micro font-mono text-verdigris">
                  PDF • Web • Video
                </span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-xl border border-hairline bg-surface space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="font-mono text-caption text-ink-muted font-medium">
                  02
                </span>
                <h3 className="font-sans text-section font-semibold text-ink">
                  Inquire & Verify
                </h3>
                <p className="font-sans text-ui text-ink-secondary leading-relaxed">
                  Query across all attached files. Every claim is tagged with exact page-level citations that open the original text excerpt on click.
                </p>
              </div>
              <div className="pt-3 border-t border-hairline">
                <span className="text-micro font-mono text-verdigris">
                  Page-level citations
                </span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-xl border border-hairline bg-surface space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="font-mono text-caption text-ink-muted font-medium">
                  03
                </span>
                <h3 className="font-sans text-section font-semibold text-ink">
                  Distill in the Studio
                </h3>
                <p className="font-sans text-ui text-ink-secondary leading-relaxed">
                  Generate structured executive briefs, two-host audio overviews, presentation slides, quizzes, flashcard decks, and concept mind maps.
                </p>
              </div>
              <div className="pt-3 border-t border-hairline">
                <span className="text-micro font-mono text-verdigris">
                  7 synthesis formats
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Compact List of What You Can Generate */}
        <section className="space-y-4">
          <div className="space-y-1">
            <span className="text-micro font-mono uppercase tracking-wider text-ink-muted">
              Studio Workshop
            </span>
            <h2 className="font-serif text-title text-ink font-semibold">
              What you can generate from sources
            </h2>
          </div>

          <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface overflow-hidden">
            {STUDIO_OUTPUT_TYPES.map((output, idx) => {
              const Icon = output.icon;
              return (
                <div
                  key={idx}
                  className="p-4 sm:p-4.5 flex items-start sm:items-center gap-3.5 hover:bg-surface-subtle transition-colors duration-150"
                >
                  <div className="p-2 rounded bg-surface-subtle border border-hairline text-ink shrink-0 mt-0.5 sm:mt-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-sans text-ui font-medium text-ink">
                      {output.name}
                    </h3>
                    <p className="font-sans text-caption text-ink-secondary mt-0.5 leading-relaxed">
                      {output.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer: Links to live app and GitHub ONLY */}
      <footer className="border-t border-hairline bg-surface py-8 text-caption text-ink-muted">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif text-ui font-semibold text-ink">Docora</span>
            <span>•</span>
            <span>Document Intelligence Platform</span>
          </div>

          <div className="flex items-center gap-5 font-sans text-ui">
            <Link
              href="/notebooks"
              className="text-ink-secondary hover:text-ink transition-colors"
            >
              Live App
            </Link>
            <a
              href="https://github.com/EsaLoni/docora"
              target="_blank"
              rel="noreferrer"
              className="text-ink-secondary hover:text-ink transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
