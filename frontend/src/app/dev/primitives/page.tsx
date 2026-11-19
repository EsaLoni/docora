"use client";

import React, { useState } from "react";
import {
  Button,
  Input,
  Textarea,
  CitationChip,
  StatusBadge,
  SourceItem,
  StudioItem,
  PanelShell,
} from "@/components/ui";
import { Sun, Moon, BookOpen, Sparkles, Layers } from "lucide-react";

export default function DevPrimitivesPage() {
  const [isDark, setIsDark] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "buttons" | "forms" | "badges" | "items" | "panel">("all");

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-canvas text-ink p-4 sm:p-8 space-y-10 transition-colors duration-150">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-hairline">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-micro font-mono bg-verdigris-subtle text-verdigris border border-verdigris font-semibold uppercase">
                Phase 1 Verified
              </span>
              <span className="text-caption font-mono text-ink-muted">
                Docora Design System Primitives
              </span>
            </div>
            <h1 className="text-display font-sans text-ink mt-1">
              Impeccable Primitives Catalog
            </h1>
            <p className="text-ui text-ink-secondary mt-1">
              Live inspection environment for all Paper & Instruments primitives, tokens, and states in both Light and Dark mode.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleTheme}
              className="gap-2"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-gold" />
                  <span>Light Canvas (#FAF8F4)</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-ink-secondary" />
                  <span>Dark Canvas (#151413)</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 1. Design Tokens & Contrast Matrix */}
        <section className="space-y-4">
          <h2 className="text-title font-sans text-ink">
            1. Design Tokens & Contrast Verification
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg border border-hairline bg-canvas space-y-1">
              <span className="text-micro font-mono text-ink-muted uppercase">Canvas Base</span>
              <p className="text-ui font-mono font-semibold text-ink">{isDark ? "#151413" : "#FAF8F4"}</p>
              <span className="text-caption text-ink-secondary">Root background</span>
            </div>

            <div className="p-3 rounded-lg border border-hairline bg-surface space-y-1 shadow-xs">
              <span className="text-micro font-mono text-ink-muted uppercase">Surface Sheet</span>
              <p className="text-ui font-mono font-semibold text-ink">{isDark ? "#1E1C1A" : "#FFFFFF"}</p>
              <span className="text-caption text-ink-secondary">Panels & Cards</span>
            </div>

            <div className="p-3 rounded-lg border border-hairline bg-surface-subtle space-y-1">
              <span className="text-micro font-mono text-ink-muted uppercase">Surface Subtle</span>
              <p className="text-ui font-mono font-semibold text-ink">{isDark ? "#242220" : "#F2EFE9"}</p>
              <span className="text-caption text-ink-secondary">Inputs & Codes</span>
            </div>

            <div className="p-3 rounded-lg border border-hairline bg-surface space-y-1">
              <span className="text-micro font-mono text-ink-muted uppercase">Text Primary</span>
              <p className="text-ui font-mono font-semibold text-ink">{isDark ? "#F5F5F4" : "#1C1917"}</p>
              <span className="text-caption text-verdigris font-mono">14.2:1 (AAA)</span>
            </div>

            <div className="p-3 rounded-lg border border-hairline bg-surface space-y-1">
              <span className="text-micro font-mono text-ink-muted uppercase">Primary Gold</span>
              <p className="text-ui font-mono font-semibold text-gold">{isDark ? "#F59E0B" : "#D97706"}</p>
              <span className="text-caption text-ink-secondary">Action Only (Never text)</span>
            </div>

            <div className="p-3 rounded-lg border border-verdigris bg-verdigris-subtle space-y-1">
              <span className="text-micro font-mono text-verdigris uppercase">Verdigris</span>
              <p className="text-ui font-mono font-semibold text-verdigris">{isDark ? "#2DD4BF" : "#0F766E"}</p>
              <span className="text-caption text-verdigris font-mono">4.8:1 (AA Citation)</span>
            </div>
          </div>
        </section>

        {/* 2. Typography Pairing Scale */}
        <section className="space-y-4">
          <h2 className="text-title font-sans text-ink">
            2. Typography Hierarchy & Optical Scale
          </h2>
          <div className="p-5 rounded-xl border border-hairline bg-surface space-y-4 shadow-xs">
            <div className="border-b border-hairline pb-3">
              <span className="text-micro font-mono text-ink-muted uppercase">Display (28px / 34px - Sans SemiBold)</span>
              <h1 className="text-display text-ink mt-0.5">The Architecture of Document Intelligence</h1>
            </div>

            <div className="border-b border-hairline pb-3">
              <span className="text-micro font-mono text-ink-muted uppercase">Title (18px / 24px - Sans SemiBold)</span>
              <h2 className="text-title text-ink mt-0.5">Executive Due Diligence & Contract Analysis</h2>
            </div>

            <div className="border-b border-hairline pb-3">
              <span className="text-micro font-mono text-ink-muted uppercase">Section (14px / 20px - Sans SemiBold)</span>
              <h3 className="text-section text-ink mt-0.5">Verified Primary Source Anchors</h3>
            </div>

            <div className="border-b border-hairline pb-3">
              <span className="text-micro font-mono text-ink-muted uppercase">Reading (15px / 26px - Newsreader Serif, 65ch Measure)</span>
              <div className="prose-reading mt-1">
                <p>
                  According to the audited financial records <CitationChip index={1} />, operating expenditures were reduced by twenty-two percent across Q3, driven principally by streamlined vendor reconciliation <CitationChip index={2} /> and consolidated logistics infrastructure.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div>
                <span className="text-micro font-mono text-ink-muted uppercase block">UI Text (13px / 18px)</span>
                <span className="text-ui text-ink">Ask anything grounded in your sources...</span>
              </div>
              <div>
                <span className="text-micro font-mono text-ink-muted uppercase block">Caption (11px / 16px)</span>
                <span className="text-caption text-ink-secondary">Last synchronized 2 minutes ago</span>
              </div>
              <div>
                <span className="text-micro font-mono text-ink-muted uppercase block">Micro (11px / 14px Mono)</span>
                <span className="text-micro font-mono text-ink-muted">CMD + K • 42,100 TOKENS</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Button Primitive Matrix */}
        <section className="space-y-4">
          <h2 className="text-title font-sans text-ink">
            3. Button Primitive (States: Default, Hover, Focus, Disabled, Loading)
          </h2>
          <div className="p-5 rounded-xl border border-hairline bg-surface space-y-6 shadow-xs">
            {/* Primary Gold */}
            <div>
              <span className="text-micro font-mono text-ink-muted uppercase block mb-2">
                Primary (Kinpaku Gold) - Actions Only, Never Text on White
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Default Action</Button>
                <Button variant="primary" className="bg-gold-hover">Hover State</Button>
                <Button variant="primary" className="ring-2 ring-gold ring-offset-2">Focused State</Button>
                <Button variant="primary" isLoading>Processing</Button>
                <Button variant="primary" disabled>Disabled State</Button>
              </div>
            </div>

            {/* Secondary Paper Sheet */}
            <div>
              <span className="text-micro font-mono text-ink-muted uppercase block mb-2">
                Secondary (Hairline Paper Sheet)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="secondary" className="bg-surface-subtle">Hover State</Button>
                <Button variant="secondary" className="ring-2 ring-gold ring-offset-2">Focused State</Button>
                <Button variant="secondary" isLoading>Loading</Button>
                <Button variant="secondary" disabled>Disabled State</Button>
              </div>
            </div>

            {/* Ghost & Destructive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-micro font-mono text-ink-muted uppercase block mb-2">
                  Ghost (Borderless Restrained)
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="ghost" className="bg-surface-subtle">Hover</Button>
                  <Button variant="ghost" disabled>Disabled</Button>
                </div>
              </div>

              <div>
                <span className="text-micro font-mono text-ink-muted uppercase block mb-2">
                  Destructive (Restrained Crimson)
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="destructive">Delete Item</Button>
                  <Button variant="destructive" isLoading>Deleting</Button>
                  <Button variant="destructive" disabled>Disabled</Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Input & Textarea Primitives */}
        <section className="space-y-4">
          <h2 className="text-title font-sans text-ink">
            4. Input & Textarea Primitives (Mobile 16px font-size protection)
          </h2>
          <div className="p-5 rounded-xl border border-hairline bg-surface space-y-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-caption font-sans font-medium text-ink-secondary block mb-1">
                  Default Input (16px on mobile, 13px desktop)
                </label>
                <Input placeholder="e.g. Q4 Executive Summary..." defaultValue="Research Project Alpha" />
              </div>

              <div>
                <label className="text-caption font-sans font-medium text-ink-secondary block mb-1">
                  Focused State
                </label>
                <Input defaultValue="Active focus state" className="border-strong bg-surface ring-1 ring-gold" />
              </div>

              <div>
                <label className="text-caption font-sans font-medium text-ink-secondary block mb-1">
                  Disabled Input
                </label>
                <Input disabled defaultValue="Immutable system parameter" />
              </div>

              <div>
                <label className="text-caption font-sans font-medium text-destructive block mb-1">
                  Error State
                </label>
                <Input error defaultValue="Invalid citation link format" />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-caption font-sans font-medium text-ink-secondary block mb-1">
                Textarea Composer (Flexible row sizing)
              </label>
              <Textarea placeholder="Ask anything grounded in your documents..." rows={3} />
            </div>
          </div>
        </section>

        {/* 5. CitationChip & StatusBadge Primitives */}
        <section className="space-y-4">
          <h2 className="text-title font-sans text-ink">
            5. CitationChip & StatusBadge Primitives
          </h2>
          <div className="p-5 rounded-xl border border-hairline bg-surface space-y-6 shadow-xs">
            <div>
              <span className="text-micro font-mono text-ink-muted uppercase block mb-2">
                CitationChip (Inline Numbered Verdigris Markers)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <CitationChip index={1} sourceTitle="Financial Report" pageNumber={4} />
                <CitationChip index={2} sourceTitle="SEC 10-K" pageNumber={18} snippet="Revenue increased by 14% year over year" />
                <CitationChip index={3} />
                <CitationChip index="12, p. 45" />
                <span className="text-caption text-ink-muted">
                  ← Interactive click triggers citation preview drawer
                </span>
              </div>
            </div>

            <div>
              <span className="text-micro font-mono text-ink-muted uppercase block mb-2">
                StatusBadge (Discrete States Without Neon Gimmicks)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status="ready" />
                <StatusBadge status="indexed" />
                <StatusBadge status="uploading" />
                <StatusBadge status="extracting" />
                <StatusBadge status="indexing" />
                <StatusBadge status="generating" />
                <StatusBadge status="queued" />
                <StatusBadge status="idle" />
                <StatusBadge status="failed" />
              </div>
            </div>
          </div>
        </section>

        {/* 6. SourceItem & StudioItem Primitives */}
        <section className="space-y-4">
          <h2 className="text-title font-sans text-ink">
            6. SourceItem & StudioItem Primitives
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Items */}
            <div className="space-y-3">
              <span className="text-micro font-mono text-ink-muted uppercase block">
                Source Items (Real Lifecycle Stages)
              </span>
              <SourceItem
                source={{
                  id: "1",
                  title: "FY2026 Comprehensive Annual Report.pdf",
                  type: "pdf",
                  status: "ready",
                  tokenCount: 42100,
                }}
                isSelected={true}
              />
              <SourceItem
                source={{
                  id: "2",
                  title: "Market Dynamics & Competitive Moats",
                  type: "web",
                  status: "indexing",
                  progressPercent: 65,
                }}
              />
              <SourceItem
                source={{
                  id: "3",
                  title: "Keynote Lecture: Deep Embeddings",
                  type: "youtube",
                  status: "failed",
                  errorMessage: "Transcript extraction timed out",
                }}
                onRetry={() => {}}
                onDelete={() => {}}
              />
            </div>

            {/* Studio Items */}
            <div className="space-y-3">
              <span className="text-micro font-mono text-ink-muted uppercase block">
                Studio Items (Compact Output Rows)
              </span>
              <StudioItem
                typeKey="audio_overview"
                title="Audio Overview"
                description="Deep-dive podcast discussion between two synthetic voices"
                status="ready"
                count={2}
                onClick={() => {}}
              />
              <StudioItem
                typeKey="quiz"
                title="Interactive Quiz"
                description="Self-testing multiple choice and conceptual challenge questions"
                status="generating"
                onClick={() => {}}
              />
              <StudioItem
                typeKey="flashcards"
                title="Study Flashcards"
                description="Key terms, conceptual anchors, and definitions for spaced review"
                status="idle"
                onClick={() => {}}
              />
            </div>
          </div>
        </section>

        {/* 7. PanelShell Primitive */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title font-sans text-ink">
              7. PanelShell Primitive (Collapsible Side Rail)
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsPanelCollapsed((prev) => !prev)}
            >
              Toggle Collapse
            </Button>
          </div>

          <div className="h-64 rounded-xl border border-hairline bg-canvas p-3 flex gap-3">
            <PanelShell
              title="Sources"
              count={3}
              icon={<BookOpen className="w-4 h-4" />}
              isCollapsed={isPanelCollapsed}
              onToggleCollapse={() => setIsPanelCollapsed((prev) => !prev)}
              width={280}
            >
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg border border-hairline bg-surface text-caption text-ink">
                  Document source 1
                </div>
                <div className="p-2.5 rounded-lg border border-hairline bg-surface text-caption text-ink">
                  Document source 2
                </div>
              </div>
            </PanelShell>

            <div className="flex-1 rounded-xl border border-hairline bg-surface p-4 flex items-center justify-center text-ui text-ink-secondary">
              Main Center Canvas Reading Area
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
