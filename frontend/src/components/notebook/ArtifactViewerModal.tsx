"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Download,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  CheckCircle2,
  HelpCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Presentation,
  FileSpreadsheet,
  FileText,
  GitFork,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient, ArtifactItem } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";

interface ArtifactViewerModalProps {
  artifact: ArtifactItem | null;
  onClose: () => void;
}

export function ArtifactViewerModal({ artifact, onClose }: ArtifactViewerModalProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);

  // Slide deck state
  const [slideIndex, setSlideIndex] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Stop audio on unmount or artifact change
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [artifact]);

  // Keyboard accessibility: Escape to close, trap focus
  useEffect(() => {
    if (artifact) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      // Reset internal viewer states
      setCardIndex(0);
      setIsFlipped(false);
      setQuizAnswers({});
      setIsQuizSubmitted(false);
      setSlideIndex(0);
      setIsPlayingAudio(false);
    } else {
      if (previouslyFocusedRef.current?.focus) {
        previouslyFocusedRef.current.focus();
      }
    }
  }, [artifact]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!artifact) return;
      if (e.key === "Escape") {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        onClose();
      }
    },
    [artifact, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!artifact) return null;

  // Safe data extraction & parsing
  let data: any = artifact.data || {};
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
      if (typeof data === "string") {
        data = JSON.parse(data);
      }
    } catch {
      // String fallback
    }
  }
  if (
    data &&
    typeof data === "object" &&
    data.data &&
    typeof data.data === "object" &&
    !data.nodes &&
    !data.scenes &&
    !data.dialogue &&
    !data.cards &&
    !data.questions &&
    !data.slides &&
    !data.content_markdown
  ) {
    data = { ...data, ...data.data };
  }

  let rawType = (artifact.artifact_type || "").toLowerCase().replace(/[-_\s]/g, "");

  // Defensive type inference
  if (!rawType || rawType === "artifact") {
    if (data.nodes || data.edges || data.root_title) rawType = "mindmap";
    else if (data.dialogue || (Array.isArray(data.transcript) && data.transcript.length > 0)) rawType = "audiooverview";
    else if (data.questions || data.quiz_count) rawType = "quiz";
    else if (data.cards || data.card_count) rawType = "flashcards";
    else if (data.slides || data.slide_count) rawType = "presentation";
    else if (data.columns && data.rows) rawType = "datatable";
    else if (data.content_markdown || data.table_of_contents) rawType = "report";
  }

  const isAudio = rawType === "audio" || rawType === "audiooverview";
  const isQuiz = rawType === "quiz";
  const isFlashcards = rawType === "flashcards" || rawType === "flashcard";
  const isSlides = rawType === "slides" || rawType === "presentation";
  const isReport = rawType === "report";
  const isDataTable = rawType === "datatable" || rawType === "data_table";
  const isMindMap = rawType === "mindmap" || rawType === "mind_map";

  // Audio Playback
  const dialogueList: Array<{ speaker?: string; text?: string; dialogue?: string; source_refs?: string[] }> =
    data.dialogue || (Array.isArray(data.transcript) ? data.transcript : []);

  const downloadUrl = artifact.export_file_path
    ? apiClient.buildUrl(`/api/v1/notebooks/${artifact.notebook_id || ""}/studio/artifacts/${artifact.id}/download`)
    : null;

  const handleToggleAudio = () => {
    if (audioRef.current && audioRef.current.src && audioRef.current.src !== window.location.href) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current
          .play()
          .then(() => setIsPlayingAudio(true))
          .catch(() => playSpeechFallback());
      }
      return;
    }
    playSpeechFallback();
  };

  const playSpeechFallback = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!dialogueList || dialogueList.length === 0) return;

    window.speechSynthesis.cancel();
    setIsPlayingAudio(true);

    let currentIndex = 0;
    const playNextLine = () => {
      if (currentIndex >= dialogueList.length) {
        setIsPlayingAudio(false);
        return;
      }
      const line = dialogueList[currentIndex];
      const textToSpeak = line.text || line.dialogue || "";
      if (!textToSpeak.trim()) {
        currentIndex++;
        playNextLine();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = playbackSpeed;
      utterance.pitch = (line.speaker || "").toLowerCase().includes("sam") ? 0.9 : 1.1;

      utterance.onend = () => {
        currentIndex++;
        playNextLine();
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    playNextLine();
  };

  const handleSpeedChange = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  // Quiz helper
  const resolveQuestionDetails = (q: any) => {
    let options: string[] = [];
    if (Array.isArray(q.options) && q.options.length > 0) {
      options = q.options.map((o: any) => String(o));
    }

    const typeStr = (q.type || q.question_type || "").toLowerCase();
    const isTF =
      typeStr.includes("true") ||
      typeStr.includes("false") ||
      typeStr === "tf" ||
      (options.length === 2 &&
        options.some((o) => o.toLowerCase() === "true") &&
        options.some((o) => o.toLowerCase() === "false"));

    if (isTF) {
      options = ["True", "False"];
    } else if (options.length === 0) {
      options = ["Option A", "Option B", "Option C", "Option D"];
    }

    let correctIdx = -1;
    if (typeof q.correct_index === "number" && q.correct_index >= 0) {
      correctIdx = q.correct_index;
    } else if (typeof q.correct_answer === "number" && q.correct_answer >= 0 && q.correct_answer < options.length) {
      correctIdx = q.correct_answer;
    } else if (typeof q.correct_answer === "boolean") {
      correctIdx = q.correct_answer ? 0 : 1;
    } else if (typeof q.correct_answer === "string") {
      correctIdx = options.findIndex((o) => o.toLowerCase().trim() === q.correct_answer.toLowerCase().trim());
      if (correctIdx === -1 && /^[a-d]$/i.test(q.correct_answer.trim())) {
        correctIdx = q.correct_answer.trim().toLowerCase().charCodeAt(0) - 97;
      }
    }

    return { options, correctIdx, isTF };
  };

  const calculateScore = () => {
    if (!data.questions) return { correct: 0, total: 0, pct: 0 };
    let correct = 0;
    data.questions.forEach((q: any, idx: number) => {
      const { correctIdx } = resolveQuestionDetails(q);
      if (quizAnswers[idx] === correctIdx) correct++;
    });
    const total = data.questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, total, pct };
  };

  const handleDownloadJson = () => {
    try {
      const content =
        typeof artifact.data === "string" ? artifact.data : JSON.stringify(artifact.data, null, 2);
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${artifact.title || "artifact"}-${artifact.artifact_type}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download artifact:", err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="artifact-viewer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[90vh] rounded-xl border border-hairline bg-surface text-ink flex flex-col shadow-2xl overflow-hidden font-sans animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-hairline flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono text-micro uppercase px-2 py-0.5 rounded bg-surface-subtle text-ink-muted border border-hairline">
              {artifact.artifact_type.replace(/[-_]/g, " ")}
            </span>
            <h3 id="artifact-viewer-title" className="text-section font-semibold text-ink truncate leading-tight">
              {artifact.title || "Studio Output"}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadJson}
              className="h-8 px-2.5 text-ui text-ink-muted hover:text-ink flex items-center gap-1.5"
              title="Download JSON data"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
              className="h-8 w-8 p-0 text-ink-muted hover:text-ink"
              aria-label="Close viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Reading Room Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 min-h-0 text-ink bg-surface select-text">
          {/* 1. Study Report / Guide: Newsreader serif at 15/26 with 65ch measure */}
          {isReport && (
            <div className="w-full max-w-[65ch] mx-auto font-serif text-reading leading-relaxed text-ink space-y-4">
              {data.table_of_contents && Array.isArray(data.table_of_contents) && (
                <div className="p-4 rounded-lg bg-surface-subtle border border-hairline font-sans text-ui mb-6 select-none">
                  <h4 className="text-caption font-semibold uppercase tracking-wider text-ink-muted mb-2">
                    Table of Contents
                  </h4>
                  <ul className="space-y-1 text-ui text-ink">
                    {data.table_of_contents.map((item: any, idx: number) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="font-mono text-micro text-ink-muted">{idx + 1}.</span>
                        <span>{typeof item === "string" ? item : item.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.content_markdown ? (
                <div className="prose-reading">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.content_markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-reading font-serif text-ink leading-relaxed">
                  {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
                </p>
              )}
            </div>
          )}

          {/* 2. Interactive Quiz: Reading room styled card questions */}
          {isQuiz && (
            <div className="max-w-2xl mx-auto space-y-5 select-none">
              {data.questions && data.questions.length > 0 ? (
                <>
                  {isQuizSubmitted && (() => {
                    const score = calculateScore();
                    return (
                      <div className="p-4 rounded-lg bg-verdigris-subtle border border-verdigris flex items-center justify-between text-ink">
                        <div>
                          <p className="text-caption font-semibold text-verdigris uppercase tracking-wider">
                            Quiz Results
                          </p>
                          <p className="text-title font-semibold text-ink mt-0.5">
                            Score: {score.correct} / {score.total} ({score.pct}%)
                          </p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-verdigris" />
                      </div>
                    );
                  })()}

                  {data.questions.map((q: any, qIdx: number) => {
                    const { options, correctIdx, isTF } = resolveQuestionDetails(q);
                    const selectedIdx = quizAnswers[qIdx];

                    return (
                      <div
                        key={qIdx}
                        className="p-5 rounded-lg border border-hairline bg-surface-subtle space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-mono text-micro uppercase text-ink-muted block mb-1">
                              Question {qIdx + 1} • {isTF ? "True / False" : "Multiple Choice"}
                            </span>
                            <h4 className="text-ui font-medium text-ink leading-relaxed">
                              {q.question}
                            </h4>
                          </div>
                          {q.citation && (
                            <span className="font-mono text-micro text-verdigris bg-verdigris-subtle border border-verdigris rounded px-2 py-0.5 shrink-0">
                              {q.citation}
                            </span>
                          )}
                        </div>

                        <div className={`gap-2 ${isTF ? "grid grid-cols-2" : "space-y-1.5"}`}>
                          {options.map((opt: string, optIdx: number) => {
                            const isSelected = selectedIdx === optIdx;
                            const isCorrect = isQuizSubmitted && optIdx === correctIdx;
                            const isWrong = isQuizSubmitted && isSelected && optIdx !== correctIdx;

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={isQuizSubmitted}
                                onClick={() => setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx })}
                                className={`w-full text-left p-3 rounded-lg border text-ui font-sans transition-colors duration-150 cursor-pointer ${
                                  isCorrect
                                    ? "bg-verdigris-subtle border-verdigris text-ink font-semibold"
                                    : isWrong
                                    ? "bg-destructive-subtle border-destructive-border text-destructive font-medium"
                                    : isSelected
                                    ? "bg-surface border-border-strong text-ink font-semibold ring-1 ring-border-strong"
                                    : "bg-surface border-hairline text-ink hover:bg-surface-subtle"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{opt}</span>
                                  {isQuizSubmitted && isCorrect && (
                                    <span className="text-micro font-mono text-verdigris font-semibold">
                                      ✓ Correct
                                    </span>
                                  )}
                                  {isQuizSubmitted && isWrong && (
                                    <span className="text-micro font-mono text-destructive font-semibold">
                                      ✗ Incorrect
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {isQuizSubmitted && q.explanation && (
                          <div className="p-3 rounded bg-surface border border-hairline text-caption font-serif text-ink-secondary italic">
                            <span className="font-sans font-medium text-ink not-italic">Rationale: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2 flex justify-end">
                    {!isQuizSubmitted ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsQuizSubmitted(true)}
                        className="text-ui px-5"
                      >
                        Submit Answers
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setIsQuizSubmitted(false);
                          setQuizAnswers({});
                        }}
                        className="text-ui"
                      >
                        Retake Quiz
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-caption text-ink-muted">No quiz questions generated.</p>
              )}
            </div>
          )}

          {/* 3. Flashcards: Spaced repetition paper cards */}
          {isFlashcards && (
            <div className="max-w-xl mx-auto space-y-6 select-none">
              {data.cards && data.cards.length > 0 ? (
                <div className="flex flex-col items-center space-y-4">
                  {/* Active Card */}
                  <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="w-full min-h-[220px] rounded-xl border border-hairline bg-surface-subtle hover:border-border-strong cursor-pointer p-8 flex flex-col justify-between text-center transition-colors shadow-xs"
                  >
                    <div className="flex items-center justify-between text-micro font-mono uppercase tracking-wider text-ink-muted">
                      <span>{isFlipped ? "Answer / Definition" : "Prompt / Concept"}</span>
                      {data.cards[cardIndex]?.difficulty && (
                        <span className="px-1.5 py-0.5 rounded bg-surface border border-hairline">
                          {data.cards[cardIndex].difficulty}
                        </span>
                      )}
                    </div>

                    <p className="font-serif text-section text-ink leading-relaxed my-6">
                      {isFlipped
                        ? data.cards[cardIndex]?.back || data.cards[cardIndex]?.answer
                        : data.cards[cardIndex]?.front || data.cards[cardIndex]?.question}
                    </p>

                    <div className="flex items-center justify-between text-micro text-ink-muted">
                      <span className="font-mono text-verdigris">
                        {data.cards[cardIndex]?.source_ref || "Verified Source"}
                      </span>
                      <span>(Click card to flip)</span>
                    </div>
                  </div>

                  {/* Navigation Bar */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={cardIndex === 0}
                      onClick={() => {
                        setCardIndex((prev) => Math.max(0, prev - 1));
                        setIsFlipped(false);
                      }}
                      className="text-ui flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </Button>

                    <span className="font-mono text-caption text-ink-muted px-2">
                      Card {cardIndex + 1} of {data.cards.length}
                    </span>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={cardIndex === data.cards.length - 1}
                      onClick={() => {
                        setCardIndex((prev) => Math.min(data.cards.length - 1, prev + 1));
                        setIsFlipped(false);
                      }}
                      className="text-ui flex items-center gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-caption text-ink-muted">No flashcards generated.</p>
              )}
            </div>
          )}

          {/* 4. Mind Map: Hierarchical concept graph */}
          {isMindMap && (
            <div className="max-w-2xl mx-auto space-y-5">
              {data.root_title && (
                <div className="p-4 rounded-lg bg-surface-subtle border border-hairline text-center">
                  <span className="text-micro font-mono uppercase tracking-wider text-ink-muted">
                    Central Concept
                  </span>
                  <h4 className="text-section font-semibold text-ink mt-0.5">
                    {data.root_title}
                  </h4>
                </div>
              )}

              {data.nodes && data.nodes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.nodes.map((node: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-ui font-semibold text-ink">{node.label}</span>
                        {node.category && (
                          <span className="font-mono text-micro px-1.5 py-0.5 rounded bg-surface-subtle text-ink-muted border border-hairline">
                            {node.category}
                          </span>
                        )}
                      </div>
                      {node.description && (
                        <p className="text-caption font-serif text-ink-secondary leading-relaxed">
                          {node.description}
                        </p>
                      )}
                      {node.citation && (
                        <p className="font-mono text-micro text-verdigris">
                          Ref: {node.citation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="p-4 rounded-lg bg-surface-subtle border border-hairline text-caption font-mono overflow-x-auto text-ink">
                  {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* 5. Data Table: Paper styled tables */}
          {isDataTable && (
            <div className="space-y-4">
              {data.columns && data.rows ? (
                <div className="overflow-x-auto rounded-lg border border-hairline bg-surface">
                  <table className="w-full text-left text-ui border-collapse">
                    <thead className="bg-surface-subtle text-ink font-semibold border-b border-hairline">
                      <tr>
                        <th className="p-3 w-10 font-mono text-caption text-ink-muted">#</th>
                        {data.columns.map((col: any, cIdx: number) => (
                          <th key={cIdx} className="p-3 text-caption font-semibold uppercase tracking-wider text-ink">
                            {col.label || col.key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {data.rows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-surface-subtle/50 transition-colors">
                          <td className="p-3 font-mono text-caption text-ink-muted">{rIdx + 1}</td>
                          {data.columns.map((col: any, cIdx: number) => (
                            <td key={cIdx} className="p-3 text-ink-secondary">
                              {row[col.key] !== undefined ? String(row[col.key]) : "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-caption text-ink-muted">No tabular data found.</p>
              )}
            </div>
          )}

          {/* 6. Audio Overview: Dialogue & Player */}
          {isAudio && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-6 rounded-xl border border-hairline bg-surface-subtle flex flex-col items-center text-center space-y-3">
                <div className="p-3 rounded-full bg-surface border border-hairline text-ink">
                  <Volume2 className="w-6 h-6" />
                </div>
                <h4 className="text-section font-semibold text-ink">
                  {artifact.title || data.title || "Conversational Overview"}
                </h4>
                <p className="text-caption text-ink-muted max-w-md">
                  Two-host discussion summarizing core takeaways from your grounded sources.
                </p>

                {downloadUrl && (
                  <audio
                    ref={audioRef}
                    src={downloadUrl}
                    onEnded={() => setIsPlayingAudio(false)}
                    className="hidden"
                  />
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleToggleAudio}
                    className="flex items-center gap-2 px-5"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlayingAudio ? "Pause Podcast" : "Play Podcast"}</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSpeedChange}
                    className="font-mono text-caption"
                  >
                    {playbackSpeed}x
                  </Button>
                </div>
              </div>

              {/* Dialogue Transcript */}
              {dialogueList.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
                    Dialogue Transcript ({dialogueList.length} turns)
                  </h5>
                  <div className="space-y-3">
                    {dialogueList.map((line, idx) => {
                      const speaker = line.speaker || (idx % 2 === 0 ? "Alex" : "Sam");
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-lg border border-hairline bg-surface space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-micro font-semibold text-ink">
                              {speaker}
                            </span>
                            {line.source_refs && line.source_refs.length > 0 && (
                              <span className="font-mono text-micro text-verdigris">
                                Ref: {line.source_refs.join(", ")}
                              </span>
                            )}
                          </div>
                          <p className="text-ui font-serif text-ink-secondary leading-relaxed">
                            {line.text || line.dialogue}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Slide Deck: 16:9 Presentation frame */}
          {isSlides && (
            <div className="max-w-2xl mx-auto space-y-5 select-none">
              {data.slides && data.slides.length > 0 ? (
                <div className="space-y-4">
                  <div className="aspect-[16/9] w-full rounded-xl border border-hairline bg-surface-subtle p-8 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="font-mono text-micro uppercase text-ink-muted block mb-2">
                        Slide {slideIndex + 1} of {data.slides.length}
                      </span>
                      <h4 className="text-title font-semibold text-ink leading-tight">
                        {data.slides[slideIndex]?.title}
                      </h4>
                    </div>

                    <div className="space-y-2 my-auto">
                      {data.slides[slideIndex]?.bullets && Array.isArray(data.slides[slideIndex].bullets) ? (
                        <ul className="space-y-2 font-serif text-reading text-ink-secondary">
                          {data.slides[slideIndex].bullets.map((b: string, bIdx: number) => (
                            <li key={bIdx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-border-strong mt-2.5 shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-serif text-reading text-ink-secondary">
                          {data.slides[slideIndex]?.content || data.slides[slideIndex]?.speaker_notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-micro font-mono text-ink-muted border-t border-hairline pt-3">
                      <span>Docora Intelligence</span>
                      {data.slides[slideIndex]?.citation && (
                        <span className="text-verdigris">Ref: {data.slides[slideIndex].citation}</span>
                      )}
                    </div>
                  </div>

                  {/* Slide controls */}
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={slideIndex === 0}
                      onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      <span>Previous</span>
                    </Button>
                    <span className="font-mono text-caption text-ink-muted px-2">
                      {slideIndex + 1} / {data.slides.length}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={slideIndex === data.slides.length - 1}
                      onClick={() => setSlideIndex((prev) => Math.min(data.slides.length - 1, prev + 1))}
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-caption text-ink-muted">No presentation slides found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
