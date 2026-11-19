"use client";

import React, { useState, useEffect } from "react";
import {
  GenerationModal,
  ModalSegmentedControl,
  ModalTopicPrompt,
} from "@/components/studio/GenerationModalFramework";
import {
  Headphones,
  Presentation,
  FileText,
  GitFork,
  HelpCircle,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { SourceItem, ArtifactItem, apiClient } from "@/lib/api-client";

interface StudioGenerationModalProps {
  activeTool: string | null;
  onClose: () => void;
  notebookId: string;
  sources: SourceItem[];
  onArtifactCreated: (art: ArtifactItem) => void;
  showToast: (type: "success" | "error" | "info", title: string, msg: string, diag?: any) => void;
  onOpenGeminiKey?: () => void;
}

export function StudioGenerationModal({
  activeTool,
  onClose,
  notebookId,
  sources,
  onArtifactCreated,
  showToast,
  onOpenGeminiKey,
}: StudioGenerationModalProps) {
  const [topic, setTopic] = useState("");
  const [lengthMode, setLengthMode] = useState("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTool) {
      setTopic("");
      setLengthMode("standard");
      setIsSubmitting(false);
    }
  }, [activeTool]);

  if (!activeTool) return null;

  const getToolMetadata = (tool: string) => {
    switch (tool) {
      case "audio":
        return {
          title: "Generate Audio Overview",
          subtitle: "Two-host conversational podcast discussing core document takeaways.",
          icon: Headphones,
          endpoint: "audio",
          lengthLabel: "Episode Duration",
          lengthOptions: [
            { id: "concise", label: "Quick", desc: "3 minutes" },
            { id: "standard", label: "Standard", desc: "5-7 minutes" },
            { id: "comprehensive", label: "Deep Dive", desc: "10+ minutes" },
          ],
        };
      case "slides":
        return {
          title: "Generate Slide Deck",
          subtitle: "Executive presentation slides structured for clean briefings.",
          icon: Presentation,
          endpoint: "presentation",
          lengthLabel: "Deck Length",
          lengthOptions: [
            { id: "concise", label: "Brief", desc: "4-5 slides" },
            { id: "standard", label: "Standard", desc: "7-9 slides" },
            { id: "comprehensive", label: "Detailed", desc: "12+ slides" },
          ],
        };
      case "mindmap":
        return {
          title: "Generate Mind Map",
          subtitle: "Hierarchical concept tree and knowledge ontology.",
          icon: GitFork,
          endpoint: "mindmap",
          lengthLabel: "Graph Depth",
          lengthOptions: [
            { id: "concise", label: "Core", desc: "Main ideas" },
            { id: "standard", label: "Standard", desc: "2-3 tiers" },
            { id: "comprehensive", label: "Exhaustive", desc: "Full ontology" },
          ],
        };
      case "quiz":
        return {
          title: "Generate Interactive Quiz",
          subtitle: "Comprehension test with scored multiple choice questions.",
          icon: HelpCircle,
          endpoint: "quiz",
          lengthLabel: "Question Count",
          lengthOptions: [
            { id: "concise", label: "Quick", desc: "5 questions" },
            { id: "standard", label: "Standard", desc: "10 questions" },
            { id: "comprehensive", label: "Thorough", desc: "15 questions" },
          ],
        };
      case "flashcards":
        return {
          title: "Generate Flashcards",
          subtitle: "Active recall study deck with spaced repetition principles.",
          icon: Layers,
          endpoint: "flashcards",
          lengthLabel: "Deck Size",
          lengthOptions: [
            { id: "concise", label: "Core", desc: "10 cards" },
            { id: "standard", label: "Standard", desc: "20 cards" },
            { id: "comprehensive", label: "Thorough", desc: "30 cards" },
          ],
        };
      case "data_table":
        return {
          title: "Generate Data Table",
          subtitle: "Structured schema and entity extractions formatted into tables.",
          icon: FileSpreadsheet,
          endpoint: "datatable",
          lengthLabel: "Extraction Scope",
          lengthOptions: [
            { id: "concise", label: "Key Metrics", desc: "Core figures" },
            { id: "standard", label: "Standard", desc: "Primary tables" },
            { id: "comprehensive", label: "Exhaustive", desc: "All data points" },
          ],
        };
      case "report":
      default:
        return {
          title: "Generate Study Report",
          subtitle: "Exhaustive multi-section synthesis brief with verified citations.",
          icon: FileText,
          endpoint: "report",
          lengthLabel: "Report Length",
          lengthOptions: [
            { id: "concise", label: "Summary", desc: "1-2 pages" },
            { id: "standard", label: "Standard", desc: "3-5 pages" },
            { id: "comprehensive", label: "Deep Dive", desc: "Full dossier" },
          ],
        };
    }
  };

  const meta = getToolMetadata(activeTool);

  const handleGenerate = async () => {
    setIsSubmitting(true);
    try {
      const activeSourceIds = sources
        .filter((s) => s.is_active_for_queries)
        .map((s) => s.id);

      const options = {
        length: lengthMode,
        question_count: lengthMode === "concise" ? 5 : lengthMode === "comprehensive" ? 15 : 10,
        quiz_count: lengthMode === "concise" ? 5 : lengthMode === "comprehensive" ? 15 : 10,
        card_count: lengthMode === "concise" ? 10 : lengthMode === "comprehensive" ? 30 : 20,
        slide_count: lengthMode === "concise" ? 5 : lengthMode === "comprehensive" ? 12 : 8,
        archetype: lengthMode === "concise" ? "executive_summary" : "comprehensive_review",
      };

      const payload: any = {
        artifact_type: activeTool,
        source_ids: activeSourceIds.length > 0 ? activeSourceIds : undefined,
        topic: topic.trim() || undefined,
        topic_focus: topic.trim() || undefined,
        options,
        settings: options,
      };

      const result = await apiClient.generateStudioArtifact(notebookId, meta.endpoint, payload);
      const rawRes = result as any;
      const formattedArtifact: ArtifactItem = {
        ...result,
        id: rawRes.id || rawRes.artifact_id || `art-${Date.now()}`,
        artifact_type: rawRes.artifact_type || (activeTool === "mindmap" ? "mind_map" : activeTool),
        notebook_id: notebookId,
        title: rawRes.title || meta.title.replace("Generate ", ""),
        status: rawRes.status || "completed",
        data: rawRes.data || rawRes,
      };

      onArtifactCreated(formattedArtifact);
      showToast("success", "Synthesis Completed", `Generated "${formattedArtifact.title}".`);
      onClose();
    } catch (err: any) {
      console.error("Studio generation failed:", err);
      if (err.message && (err.message.includes("API key") || err.message.includes("401"))) {
        if (onOpenGeminiKey) onOpenGeminiKey();
      }
      showToast("error", "Generation Failed", err.message || "Could not synthesize output.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GenerationModal
      isOpen={!!activeTool}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      onGenerate={handleGenerate}
      isGenerating={isSubmitting}
      generateButtonText="Synthesize Output"
    >
      <ModalTopicPrompt
        topic={topic}
        setTopic={setTopic}
        placeholder="e.g., Key operational risks, financial figures, or executive summary"
      />

      <ModalSegmentedControl
        label={meta.lengthLabel}
        value={lengthMode}
        onChange={setLengthMode}
        options={meta.lengthOptions}
      />
    </GenerationModal>
  );
}
