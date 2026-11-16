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

  // Redirect to notebooks list if notebookId is missing (executed unconditionally)
  useEffect(() => {
    if (!notebookId) {
      router.replace("/notebooks");
    }
  }, [notebookId, router]);

  // Conditional renders strictly below all hook declarations
  if (!notebookId) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0D12] text-[#F1F5FC] p-6 space-y-4 font-sans">
        <div className="h-16 w-16 rounded-2xl bg-[#151B27] border border-[#273247] flex items-center justify-center text-[#6D8FFF]">
          <BookMarked className="h-8 w-8" />
        </div>
        <div className="text-center space-y-1 max-w-sm">
          <h2 className="text-[20px] font-semibold text-[#F1F5FC]">No Notebook Specified</h2>
          <p className="text-[13px] text-[#A0AEC0]">
            Please select a notebook from your workspace collection or create a new one.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/notebooks"
            className="px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] transition shadow-sm"
          >
            Return to My Notebooks
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0D12] text-[#A0AEC0] gap-3 font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-[#6D8FFF] border-t-transparent animate-spin" />
        <span className="text-xs font-semibold tracking-wide">Loading workspace...</span>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0D12] text-[#F1F5FC] p-6 space-y-4 font-sans">
        <div className="h-16 w-16 rounded-2xl bg-[#151B27] border border-[#273247] flex items-center justify-center text-[#6D8FFF]">
          <BookMarked className="h-8 w-8" />
        </div>
        <div className="text-center space-y-1 max-w-sm">
          <h2 className="text-[20px] font-semibold text-[#F1F5FC]">Notebook Not Found</h2>
          <p className="text-[13px] text-[#A0AEC0]">
            This notebook does not exist or belongs to another workspace. Access is restricted under workspace isolation.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/notebooks"
            className="px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] transition shadow-sm"
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
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0D12] text-[#A0AEC0] gap-3 font-sans">
          <div className="w-8 h-8 rounded-full border-2 border-[#6D8FFF] border-t-transparent animate-spin" />
          <span className="text-xs font-semibold tracking-wide">Loading workspace...</span>
        </div>
      }
    >
      <NotebookWorkspaceContent />
    </Suspense>
  );
}
