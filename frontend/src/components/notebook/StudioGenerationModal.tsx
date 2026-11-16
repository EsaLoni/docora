"use client";

import React, { useState } from "react";
import {
  GenerationModal,
  ModalSegmentedControl,
  ModalMultiSelectTypes,
  ModalLanguageSelector,
  ModalSourceSelector,
  ModalTopicPrompt,
  SourceItemOption,
} from "@/components/studio/GenerationModalFramework";
import {
  Headphones,
  Video,
  HelpCircle,
  Layers,
  GitFork,
  Presentation,
  LayoutGrid,
  FileSpreadsheet,
  FileText,
  Sparkles,
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
  const [language, setLanguage] = useState("en");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    sources.filter((s) => s.is_active_for_queries).map((s) => s.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTool && sources.length > 0) {
      setSelectedSourceIds(sources.filter((s) => s.is_active_for_queries).map((s) => s.id));
    }
  }, [activeTool, sources]);

  // Tool Specific Controls
  const [quizQuestionCount, setQuizQuestionCount] = useState("standard");
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizQuestionTypes, setQuizQuestionTypes] = useState<string[]>(["multiple_choice"]);
  const [flashcardCount, setFlashcardCount] = useState("standard");
  const [audioFormat, setAudioFormat] = useState("two_host");
  const [slideTheme, setSlideTheme] = useState("modern_dark");
  const [reportArchetype, setReportArchetype] = useState("executive_summary");
  const [infographicStyle, setInfographicStyle] = useState("bento_grid");
  const [videoStyle, setVideoStyle] = useState("explainer");

  if (!activeTool) return null;

  const getToolMetadata = (tool: string) => {
    switch (tool) {
      case "audio":
        return {
          title: "Audio Overview",
          subtitle: "Generate conversational podcast dialogue",
          icon: Headphones,
          color: "text-amber-400 bg-amber-500/10",
        };
      case "video":
        return {
          title: "Video Summary",
          subtitle: "Synthesize visual explainer storyboard",
          icon: Video,
          color: "text-rose-400 bg-rose-500/10",
        };
      case "quiz":
        return {
          title: "Interactive Quiz",
          subtitle: "Test comprehension with scored questions",
          icon: HelpCircle,
          color: "text-blue-400 bg-blue-500/10",
        };
      case "flashcards":
        return {
          title: "Flashcards",
          subtitle: "Active recall study deck with spaced repetition",
          icon: Layers,
          color: "text-purple-400 bg-purple-500/10",
        };
      case "mindmap":
        return {
          title: "Mind Map",
          subtitle: "Structured hierarchy of concepts and connections",
          icon: GitFork,
          color: "text-emerald-400 bg-emerald-500/10",
        };
      case "slides":
        return {
          title: "Slide Deck",
          subtitle: "Executive slide presentation",
          icon: Presentation,
          color: "text-indigo-400 bg-indigo-500/10",
        };
      case "infographic":
        return {
          title: "Infographic",
          subtitle: "Data-dense bento grid statistics",
          icon: LayoutGrid,
          color: "text-teal-400 bg-teal-500/10",
        };
      case "data_table":
        return {
          title: "Data Tables",
          subtitle: "Structured entity and metric extraction",
          icon: FileSpreadsheet,
          color: "text-orange-400 bg-orange-500/10",
        };
      default:
        return {
          title: "Study Guide",
          subtitle: "Exhaustive multi-section study brief",
          icon: FileText,
          color: "text-cyan-400 bg-cyan-500/10",
        };
    }
  };

  const handleGenerate = async () => {
    if (!apiClient.getGeminiApiKey()) {
      showToast("error", "Gemini API Key Required", "Please connect your Google Gemini API key to generate this artifact.");
      if (onOpenGeminiKey) {
        onOpenGeminiKey();
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Map frontend tool names to primary backend endpoint routes
      let toolEndpoint = activeTool;
      if (activeTool === "slides") toolEndpoint = "presentation";
      if (activeTool === "data_table") toolEndpoint = "datatable";

      const commonOptions = {
        question_count: quizQuestionCount,
        quiz_count: quizQuestionCount,
        difficulty: quizDifficulty,
        question_types: quizQuestionTypes,
        card_count: flashcardCount,
        format: audioFormat,
        theme: slideTheme,
        archetype: reportArchetype,
        style: infographicStyle || videoStyle,
      };

      const payload: any = {
        artifact_type: activeTool,
        source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
        topic: topic.trim() || undefined,
        topic_focus: topic.trim() || undefined,
        language: language || "en",
        options: commonOptions,
        settings: commonOptions,
      };

      const result = await apiClient.generateStudioArtifact(notebookId, toolEndpoint, payload);
      const rawRes = result as any;
      const formattedArtifact: ArtifactItem = {
        ...result,
        id: rawRes.id || rawRes.artifact_id || `art-${Date.now()}`,
        artifact_type: rawRes.artifact_type || (activeTool === "mindmap" ? "mind_map" : activeTool || "mind_map"),
        notebook_id: notebookId,
        title: rawRes.title || "Studio Artifact",
        status: rawRes.status || "completed",
        data: rawRes.data || rawRes,
      };
      onArtifactCreated(formattedArtifact);
      showToast("success", "Generation Completed", `Created "${result.title}". Ready for review.`);
      onClose();
    } catch (err: any) {
      console.error("Studio generation failed:", err);
      if (err.message && (err.message.includes("API key") || err.message.includes("401"))) {
        if (onOpenGeminiKey) {
          onOpenGeminiKey();
        }
      }
      showToast("error", "Generation Failed", err.message || "Could not generate artifact.", {
        endpoint: `/notebooks/${notebookId}/studio/${activeTool}`,
        detail: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const meta = getToolMetadata(activeTool);

  const sourceOptions: SourceItemOption[] = sources.map((s) => ({
    id: s.id,
    title: s.title,
    source_type: s.source_type,
    is_active: s.is_active_for_queries,
  }));

  const handleToggleQuestionType = (typeId: string) => {
    setQuizQuestionTypes((prev) =>
      prev.includes(typeId)
        ? prev.length > 1
          ? prev.filter((t) => t !== typeId)
          : prev
        : [...prev, typeId]
    );
  };

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllSources = (all: boolean) => {
    setSelectedSourceIds(all ? sources.map((s) => s.id) : []);
  };

  return (
    <GenerationModal
      isOpen={Boolean(activeTool)}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      iconColor={meta.color}
      onGenerate={handleGenerate}
      isGenerating={isSubmitting}
      generateButtonText="Generate Now"
    >
      <div className="space-y-4">
        {/* Gemini Key Missing Notice */}
        {!apiClient.getGeminiApiKey() && (
          <div
            onClick={onOpenGeminiKey}
            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-500/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Google Gemini API key required to generate quizzes & studio tools.</span>
            </div>
            <span className="font-semibold underline shrink-0">Connect Key</span>
          </div>
        )}

        {/* Source Selector */}
        <ModalSourceSelector
          sources={sourceOptions}
          selectedIds={selectedSourceIds}
          onToggleSource={handleToggleSource}
          onSelectAll={handleSelectAllSources}
        />

        {/* Focus Topic */}
        <ModalTopicPrompt
          value={topic}
          onChange={setTopic}
          placeholder="E.g. Focus on financial risk factors, or technical architecture..."
        />

        {/* Language Selector */}
        <ModalLanguageSelector value={language} onChange={setLanguage} />

        {/* Tool-specific controls */}
        {activeTool === "quiz" && (
          <>
            <ModalSegmentedControl
              label="Question Count"
              value={quizQuestionCount}
              onChange={setQuizQuestionCount}
              options={[
                { id: "fewer", label: "Fewer (3)" },
                { id: "standard", label: "Standard (5)" },
                { id: "more", label: "More (8)" },
              ]}
            />
            <ModalSegmentedControl
              label="Difficulty Level"
              value={quizDifficulty}
              onChange={setQuizDifficulty}
              options={[
                { id: "easy", label: "Foundational" },
                { id: "medium", label: "Applied" },
                { id: "hard", label: "Advanced" },
              ]}
            />
            <ModalMultiSelectTypes
              label="Question Format"
              selectedValues={quizQuestionTypes}
              onToggle={handleToggleQuestionType}
              options={[
                { id: "multiple_choice", label: "Multiple Choice" },
                { id: "true_false", label: "True / False" },
              ]}
            />
          </>
        )}

        {activeTool === "flashcards" && (
          <ModalSegmentedControl
            label="Card Deck Size"
            value={flashcardCount}
            onChange={setFlashcardCount}
            options={[
              { id: "fewer", label: "Quick (4)" },
              { id: "standard", label: "Standard (6)" },
              { id: "more", label: "Comprehensive (10)" },
            ]}
          />
        )}

        {activeTool === "audio" && (
          <ModalSegmentedControl
            label="Podcast Dialogue Style"
            value={audioFormat}
            onChange={setAudioFormat}
            options={[
              { id: "two_host", label: "Two Hosts (Deep Dive)" },
              { id: "solo_host", label: "Solo Briefing" },
            ]}
          />
        )}

        {activeTool === "slides" && (
          <ModalSegmentedControl
            label="Presentation Theme"
            value={slideTheme}
            onChange={setSlideTheme}
            options={[
              { id: "modern_dark", label: "Modern Dark" },
              { id: "clean_light", label: "Minimalist Light" },
              { id: "bold_executive", label: "Bold Executive" },
            ]}
          />
        )}

        {activeTool === "report" && (
          <ModalSegmentedControl
            label="Report Structure"
            value={reportArchetype}
            onChange={setReportArchetype}
            options={[
              { id: "executive_summary", label: "Executive Summary" },
              { id: "study_guide", label: "Study Guide" },
              { id: "research_memo", label: "Research Memo" },
            ]}
          />
        )}
      </div>
    </GenerationModal>
  );
}
