"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookMarked } from "lucide-react";
import { useNotebook } from "@/hooks/useNotebook";
import { WorkspaceHeader } from "@/components/notebook/WorkspaceHeader";
import { WorkspaceShell } from "@/components/notebook/WorkspaceShell";
import { SourcesPanel } from "@/components/notebook/SourcesPanel";
import { ChatPanel } from "@/components/notebook/ChatPanel";
import { StudioPanel } from "@/components/notebook/StudioPanel";
import { CommandPalette } from "@/components/notebook/CommandPalette";
import { AddSourceModal } from "@/components/notebook/AddSourceModal";
import { CreateNoteModal } from "@/components/notebook/CreateNoteModal";
import { DeleteConfirmModal } from "@/components/notebook/DeleteConfirmModal";
import { StudioGenerationModal } from "@/components/notebook/StudioGenerationModal";
import { ArtifactViewerModal } from "@/components/notebook/ArtifactViewerModal";
import { GeminiKeyModal } from "@/components/notebook/GeminiKeyModal";
import { ToastContainer } from "@/components/notebook/ToastContainer";
import { SourceItem, ArtifactItem } from "@/lib/api-client";

function NotebookWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notebookId = searchParams.get("id") || "";

  // Unconditional hook declarations in stable, fixed order
  const {
    notebook,
    sources,
    notes,
    artifacts,
    workspaceDocuments,
    loading,
    refreshNotebook,
    handleSaveTitle,
    handleToggleSource,
    handleDeleteSource,
    handleAddSource,
    handleCreateNote,
    handleDeleteNote,
    handleSaveAsNote,
    // Chat
    messages,
    inputQuery,
    setInputQuery,
    isGenerating,
    responseStyle,
    setResponseStyle,
    handleSendMessage,
    // Toasts
    toasts,
    showToast,
    removeToast,
  } = useNotebook(notebookId);

  // Panel Collapsed States
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Modal States
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<SourceItem | null>(null);
  const [activeStudioTool, setActiveStudioTool] = useState<string | null>(null);
  const [viewingArtifact, setViewingArtifact] = useState<ArtifactItem | null>(null);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);

  // Redirect to notebooks list if notebookId is missing (executed unconditionally)
  useEffect(() => {
    if (!notebookId) {
      router.replace("/notebooks");
    }
  }, [notebookId, router]);

  // Conditional renders strictly below all hook declarations
  if (!notebookId) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08090D] text-white p-6 space-y-4 font-sans select-none">
        <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-indigo-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <BookMarked className="h-7 w-7" />
        </div>
        <div className="text-center space-y-1.5 max-w-sm">
          <h2 className="text-lg font-semibold text-white tracking-tight">No Notebook Specified</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Please select a notebook from your workspace collection or create a new research session.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/notebooks"
            prefetch={false}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
          >
            Return to My Notebooks
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08090D] text-neutral-400 gap-3 font-sans select-none">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span className="text-xs font-medium tracking-wide text-neutral-300">Loading workspace...</span>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08090D] text-white p-6 space-y-4 font-sans select-none">
        <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-indigo-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <BookMarked className="h-7 w-7" />
        </div>
        <div className="text-center space-y-1.5 max-w-sm">
          <h2 className="text-lg font-semibold text-white tracking-tight">Notebook Not Found</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            This notebook does not exist or belongs to another workspace. Access is restricted under workspace isolation.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/notebooks"
            prefetch={false}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
          >
            Return to My Notebooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <WorkspaceShell
        header={
          <WorkspaceHeader
            title={notebook?.title || "Untitled Notebook"}
            modelLabel="Gemini 3 Flash"
            isLeftPanelOpen={isLeftPanelOpen}
            isRightPanelOpen={isRightPanelOpen}
            onToggleLeftPanel={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onSaveTitle={handleSaveTitle}
            onOpenAddSource={() => setIsAddSourceOpen(true)}
            onOpenGeminiKey={() => setIsGeminiModalOpen(true)}
          />
        }
        sourcesPanel={
          <SourcesPanel
            sources={sources}
            notes={notes}
            onToggleSource={handleToggleSource}
            onDeleteSource={(src) => setDeleteCandidate(src)}
            onOpenAddSource={() => setIsAddSourceOpen(true)}
            onOpenCreateNote={() => setIsCreateNoteOpen(true)}
            onDeleteNote={handleDeleteNote}
          />
        }
        chatPanel={
          <ChatPanel
            messages={messages}
            inputQuery={inputQuery}
            setInputQuery={setInputQuery}
            isGenerating={isGenerating}
            responseStyle={responseStyle}
            setResponseStyle={setResponseStyle}
            onSendMessage={handleSendMessage}
            onSaveAsNote={handleSaveAsNote}
            sourcesCount={sources.filter((s) => s.is_active_for_queries).length}
            notebookTitle={notebook?.title}
            onOpenGeminiKey={() => setIsGeminiModalOpen(true)}
          />
        }
        studioPanel={
          <StudioPanel
            artifacts={artifacts}
            onOpenTool={(toolId) => setActiveStudioTool(toolId)}
            onViewArtifact={(art) => setViewingArtifact(art)}
            sourcesCount={sources.length}
          />
        }
        isLeftPanelOpen={isLeftPanelOpen}
        isRightPanelOpen={isRightPanelOpen}
        setIsLeftPanelOpen={setIsLeftPanelOpen}
        setIsRightPanelOpen={setIsRightPanelOpen}
        sourcesCount={sources.length}
        artifactsCount={artifacts.length}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenAddSource={() => setIsAddSourceOpen(true)}
        onOpenCreateNote={() => setIsCreateNoteOpen(true)}
        onOpenTool={(tool) => setActiveStudioTool(tool)}
        onToggleLeftPanel={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
        onFocusChat={() => {
          const el = document.querySelector("textarea");
          el?.focus();
        }}
      />

      {/* Add Source Modal */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        workspaceDocuments={workspaceDocuments}
        onAddSource={handleAddSource}
      />

      {/* Create Note Modal */}
      <CreateNoteModal
        isOpen={isCreateNoteOpen}
        onClose={() => setIsCreateNoteOpen(false)}
        onCreateNote={handleCreateNote}
      />

      {/* Delete Source Confirmation Dialog */}
      <DeleteConfirmModal
        source={deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteSource}
      />

      {/* Gemini AI API Key Modal */}
      <GeminiKeyModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
      />

      {/* Studio Tool Generator Modal */}
      <StudioGenerationModal
        activeTool={activeStudioTool}
        onClose={() => setActiveStudioTool(null)}
        notebookId={notebookId}
        sources={sources}
        onArtifactCreated={(newArt) => {
          refreshNotebook();
          setViewingArtifact(newArt);
        }}
        showToast={showToast}
        onOpenGeminiKey={() => setIsGeminiModalOpen(true)}
      />

      {/* Full Artifact Viewer Modal */}
      <ArtifactViewerModal
        artifact={viewingArtifact}
        onClose={() => setViewingArtifact(null)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </>
  );
}

export default function NotebookWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08090D] text-neutral-400 gap-3 font-sans select-none">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-xs font-medium tracking-wide text-neutral-300">Loading workspace...</span>
        </div>
      }
    >
      <NotebookWorkspaceContent />
    </Suspense>
  );
}
