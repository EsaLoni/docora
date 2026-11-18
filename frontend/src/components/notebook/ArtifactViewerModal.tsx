"use client";

import React, { useState, useRef, useEffect } from "react";
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
  ExternalLink,
  Presentation,
  FileSpreadsheet,
  FileText,
  Video,
  GitFork,
  LayoutGrid,
  Sparkles,
  Clapperboard,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient, ArtifactItem } from "@/lib/api-client";

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

  // Stop audio on unmount or artifact change
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [artifact]);

  if (!artifact) return null;

  // Safe data extraction & parsing (handles JSON string, double-serialized JSON, or wrapped objects)
  let data: any = artifact.data || {};
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
      if (typeof data === "string") {
        data = JSON.parse(data);
      }
    } catch {
      // Keep as string fallback
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

  // Defensive type inference if artifact_type is missing or generic "artifact"
  if (!rawType || rawType === "artifact") {
    if (data.nodes || data.edges || data.root_title) rawType = "mindmap";
    else if (data.scenes || data.video_title || data.target_duration_seconds) rawType = "videooverview";
    else if (data.dialogue || (Array.isArray(data.transcript) && data.transcript.length > 0)) rawType = "audiooverview";
    else if (data.questions || data.quiz_count) rawType = "quiz";
    else if (data.cards || data.card_count) rawType = "flashcards";
    else if (data.slides || data.slide_count) rawType = "presentation";
    else if (data.columns && data.rows) rawType = "datatable";
    else if (data.hero_metric || (data.sections && Array.isArray(data.sections))) rawType = "infographic";
    else if (data.content_markdown || data.table_of_contents) rawType = "report";
  }

  const isAudio = rawType === "audio" || rawType === "audiooverview";
  const isQuiz = rawType === "quiz";
  const isFlashcards = rawType === "flashcards" || rawType === "flashcard";
  const isSlides = rawType === "slides" || rawType === "presentation";
  const isReport = rawType === "report";
  const isDataTable = rawType === "datatable" || rawType === "data_table";
  const isMindMap = rawType === "mindmap" || rawType === "mind_map";
  const isInfographic = rawType === "infographic";
  const isVideo = rawType === "video" || rawType === "videooverview";

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

  // Robust Quiz helper resolving options, correct index, and true/false format
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
      const ca = q.correct_answer.trim().toLowerCase();
      if (isTF) {
        if (ca === "true" || ca === "t" || ca === "1") correctIdx = 0;
        else if (ca === "false" || ca === "f" || ca === "0") correctIdx = 1;
      }
      if (correctIdx === -1) {
        const found = options.findIndex((o) => o.trim().toLowerCase() === ca);
        if (found !== -1) correctIdx = found;
      }
      if (correctIdx === -1) {
        const letterMatch = ca.match(/^[a-d]/);
        if (letterMatch) {
          correctIdx = letterMatch[0].charCodeAt(0) - 97;
        }
      }
    }

    if (correctIdx < 0 || correctIdx >= options.length) {
      correctIdx = 0;
    }

    return { options, correctIdx, isTF };
  };

  // Score Calculator for submitted quiz
  const calculateScore = () => {
    if (!data.questions || !Array.isArray(data.questions)) return { correct: 0, total: 0, pct: 0 };
    let correct = 0;
    data.questions.forEach((q: any, idx: number) => {
      const { correctIdx } = resolveQuestionDetails(q);
      if (quizAnswers[idx] === correctIdx) {
        correct++;
      }
    });
    const total = data.questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, total, pct };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl min-h-[420px] max-h-[88vh] rounded-2xl border border-white/[0.08] bg-[#0E1118] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0A0C12]">
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-semibold text-white truncate tracking-tight">
              {artifact.title || data.title || data.deck_title || data.report_title || data.video_title || "Studio Artifact"}
            </h3>
            <p className="text-[11px] text-neutral-400 capitalize flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              {(rawType || artifact.artifact_type || "artifact").replace("_", " ")} • Generated with Gemini
            </p>
          </div>

          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="p-2 rounded-xl border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Download Artifact File"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => {
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 text-neutral-100">
          {/* 1. Audio Overview Viewer */}
          {isAudio && (
            <div className="space-y-6">
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/20">
                  <Volume2 className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-semibold text-white tracking-tight">{artifact.title || data.title}</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Format: Two-host conversational podcast (Alex & Sam)
                </p>

                {data.summary && (
                  <p className="text-xs text-neutral-300 max-w-xl mt-3 leading-relaxed">
                    {data.summary}
                  </p>
                )}

                {downloadUrl && (
                  <audio
                    ref={audioRef}
                    src={downloadUrl}
                    onEnded={() => setIsPlayingAudio(false)}
                    className="hidden"
                  />
                )}

                <div className="flex items-center gap-4 mt-6">
                  <button
                    onClick={handleToggleAudio}
                    className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] active:scale-[0.98] transition-all"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlayingAudio ? "Pause Podcast" : "Play Podcast"}</span>
                  </button>

                  <button
                    onClick={handleSpeedChange}
                    className="px-3 py-1.5 rounded-full border border-white/[0.08] text-xs font-mono font-medium hover:bg-white/[0.06] transition-colors text-neutral-400"
                  >
                    {playbackSpeed}x
                  </button>
                </div>
              </div>

              {/* Dialogue Transcript */}
              {dialogueList.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Dialogue Transcript ({dialogueList.length} turns)
                  </h5>
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-xs leading-relaxed space-y-3.5 font-sans">
                    {dialogueList.map((line, idx) => {
                      const speakerName = line.speaker || (idx % 2 === 0 ? "Alex" : "Sam");
                      const isAlex = speakerName.toLowerCase().includes("alex");
                      return (
                        <div key={idx} className="flex gap-3 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              isAlex
                                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {speakerName}
                          </span>
                          <div className="space-y-1">
                            <span className="text-neutral-200 leading-relaxed">{line.text || line.dialogue}</span>
                            {line.source_refs && line.source_refs.length > 0 && (
                              <div className="flex gap-1 pt-1">
                                {line.source_refs.map((ref, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="text-[10px] text-emerald-400 font-mono px-1.5 py-0.5 rounded-sm bg-white/[0.04] border border-white/[0.06]"
                                  >
                                    {ref}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Interactive Quiz Viewer */}
          {isQuiz && (
            <div className="space-y-6">
              {data.questions && data.questions.length > 0 ? (
                <div className="space-y-5">
                  {/* Score Banner when submitted */}
                  {isQuizSubmitted && (() => {
                    const score = calculateScore();
                    return (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-emerald-400">Quiz Completed</p>
                          <p className="text-lg font-bold text-white">
                            Score: {score.correct} / {score.total} ({score.pct}%)
                          </p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                    );
                  })()}

                  {data.questions.map((q: any, qIdx: number) => {
                    const { options, correctIdx, isTF } = resolveQuestionDetails(q);
                    const selectedIdx = quizAnswers[qIdx];

                    return (
                      <div
                        key={qIdx}
                        className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3.5 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-indigo-400 border border-white/[0.08] uppercase tracking-wider">
                              {isTF ? "True / False" : "Multiple Choice"}
                            </span>
                            <p className="text-xs font-semibold text-white leading-relaxed">
                              {qIdx + 1}. {q.question}
                            </p>
                          </div>
                          {q.citation && (
                            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-emerald-400 border border-white/[0.08] font-mono">
                              {q.citation}
                            </span>
                          )}
                        </div>

                        <div className={`gap-2.5 ${isTF ? "grid grid-cols-2" : "space-y-2"}`}>
                          {options.map((opt: string, optIdx: number) => {
                            const isSelected = selectedIdx === optIdx;
                            const isCorrect = isQuizSubmitted && optIdx === correctIdx;
                            const isWrong = isQuizSubmitted && isSelected && optIdx !== correctIdx;

                            return (
                              <button
                                key={optIdx}
                                disabled={isQuizSubmitted}
                                onClick={() => setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx })}
                                className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all ${
                                  isCorrect
                                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold shadow-xs"
                                    : isWrong
                                    ? "bg-rose-500/20 border-rose-500 text-rose-300"
                                    : isSelected
                                    ? "bg-indigo-600 text-white font-semibold border-transparent shadow-xs"
                                    : "bg-white/[0.02] border-white/[0.06] text-neutral-200 hover:bg-white/[0.05]"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{opt}</span>
                                  {isQuizSubmitted && isCorrect && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold">
                                      ✓ Correct
                                    </span>
                                  )}
                                  {isQuizSubmitted && isWrong && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-bold">
                                      ✗ Incorrect
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {isQuizSubmitted && q.explanation && (
                          <div className="p-3.5 rounded-xl bg-white/[0.03] text-[11px] text-neutral-400 leading-relaxed border border-white/[0.06]">
                            <span className="font-bold text-indigo-400">Rationale: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2 flex justify-end">
                    {!isQuizSubmitted ? (
                      <button
                        onClick={() => setIsQuizSubmitted(true)}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] active:scale-[0.98] transition-all"
                      >
                        Submit Answers
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsQuizSubmitted(false);
                          setQuizAnswers({});
                        }}
                        className="px-5 py-2.5 rounded-xl border border-white/[0.08] text-xs font-semibold hover:bg-white/[0.06] text-white transition-colors"
                      >
                        Retake Quiz
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">No quiz questions generated.</p>
              )}
            </div>
          )}

          {/* 3. Flashcards Viewer */}
          {isFlashcards && (
            <div className="space-y-6">
              {data.cards && data.cards.length > 0 ? (
                <div className="flex flex-col items-center space-y-5">
                  {/* Active Card */}
                  <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="w-full max-w-lg min-h-[220px] rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-indigo-500/40 cursor-pointer p-8 flex flex-col items-center justify-between text-center shadow-lg transition-all"
                  >
                    <div className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      <span>{isFlipped ? "Answer / Definition" : "Prompt / Concept"}</span>
                      {data.cards[cardIndex]?.difficulty && (
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-indigo-400 border border-white/[0.08]">
                          {data.cards[cardIndex].difficulty}
                        </span>
                      )}
                    </div>

                    <p className="text-base font-semibold text-white leading-relaxed my-4">
                      {isFlipped
                        ? data.cards[cardIndex]?.back || data.cards[cardIndex]?.answer
                        : data.cards[cardIndex]?.front || data.cards[cardIndex]?.question}
                    </p>

                    <div className="w-full flex items-center justify-between text-[10px] text-neutral-400">
                      <span className="text-emerald-400 font-mono">{data.cards[cardIndex]?.source_ref || "Grounding Ref"}</span>
                      <span className="opacity-70">(Click card to flip)</span>
                    </div>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center gap-4">
                    <button
                      disabled={cardIndex === 0}
                      onClick={() => {
                        setCardIndex(cardIndex - 1);
                        setIsFlipped(false);
                      }}
                      className="p-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-40 transition-colors text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-medium text-neutral-400">
                      {cardIndex + 1} / {data.cards.length}
                    </span>
                    <button
                      disabled={cardIndex === data.cards.length - 1}
                      onClick={() => {
                        setCardIndex(cardIndex + 1);
                        setIsFlipped(false);
                      }}
                      className="p-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-40 transition-colors text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">No flashcards available.</p>
              )}
            </div>
          )}

          {/* 4. Slide Deck (Presentation) Viewer */}
          {isSlides && (
            <div className="space-y-6">
              {data.slides && data.slides.length > 0 ? (
                <div className="flex flex-col items-center space-y-4">
                  {/* Slide Canvas */}
                  {(() => {
                    const slide = data.slides[slideIndex] || {};
                    return (
                      <div className="w-full max-w-2xl min-h-[320px] rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col justify-between shadow-xl">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                              Slide {slideIndex + 1} of {data.slides.length}
                            </span>
                            {slide.layout && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-indigo-400 border border-white/[0.08]">
                                {slide.layout}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xl font-semibold text-white tracking-tight mb-2">{slide.title}</h4>
                          {slide.subtitle && (
                            <p className="text-xs text-indigo-400 mb-4 font-medium">{slide.subtitle}</p>
                          )}

                          {slide.bullets && slide.bullets.length > 0 && (
                            <ul className="space-y-2.5 mt-4 text-xs text-neutral-200 list-disc list-inside">
                              {slide.bullets.map((b: string, bIdx: number) => (
                                <li key={bIdx} className="leading-relaxed">
                                  {b}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Speaker Notes */}
                        {slide.speaker_notes && (
                          <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] text-neutral-400 italic">
                            <span className="font-semibold not-italic text-white">Speaker Notes: </span>
                            {slide.speaker_notes}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Slide Controls */}
                  <div className="flex items-center gap-4">
                    <button
                      disabled={slideIndex === 0}
                      onClick={() => setSlideIndex(slideIndex - 1)}
                      className="p-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-40 transition-colors text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-medium text-neutral-400">
                      {slideIndex + 1} / {data.slides.length}
                    </span>
                    <button
                      disabled={slideIndex === data.slides.length - 1}
                      onClick={() => setSlideIndex(slideIndex + 1)}
                      className="p-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-40 transition-colors text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">No slides available.</p>
              )}
            </div>
          )}

          {/* 5. Report Viewer with Rich Formatted Markdown */}
          {isReport && (
            <div className="space-y-6">
              {data.table_of_contents && data.table_of_contents.length > 0 && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Table of Contents
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.table_of_contents.map((item: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] text-neutral-200 border border-white/[0.06]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-xs text-neutral-200 leading-relaxed font-sans prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-xl font-semibold text-white mb-4 pb-2 border-b border-white/[0.08] tracking-tight">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-semibold text-indigo-400 mt-6 mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-white mt-4 mb-2">{children}</h3>,
                    p: ({ children }) => <p className="text-xs text-neutral-300 leading-relaxed mb-4">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 mb-4 text-neutral-300">{children}</ul>,
                    li: ({ children }) => <li className="text-xs leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-500 pl-4 italic text-neutral-400 my-3">{children}</blockquote>,
                  }}
                >
                  {data.content_markdown || data.content || (typeof data === "string" ? data : JSON.stringify(data, null, 2))}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* 6. Data Table Viewer */}
          {isDataTable && (
            <div className="space-y-4">
              {data.description && (
                <p className="text-xs text-neutral-400">{data.description}</p>
              )}
              {data.columns && data.rows ? (
                <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0A0C12] text-white font-semibold border-b border-white/[0.08]">
                      <tr>
                        <th className="p-3 w-10 text-neutral-500">#</th>
                        {data.columns.map((col: any, cIdx: number) => (
                          <th key={cIdx} className="p-3">
                            {col.label || col.key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {data.rows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-white/[0.04] transition-colors">
                          <td className="p-3 font-mono text-[10px] text-neutral-500">{rIdx + 1}</td>
                          {data.columns.map((col: any, cIdx: number) => (
                            <td key={cIdx} className="p-3 text-neutral-200">
                              {row[col.key] !== undefined ? String(row[col.key]) : "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">No tabular rows found.</p>
              )}
            </div>
          )}

          {/* 7. Mind Map Viewer */}
          {isMindMap && (
            <div className="space-y-6">
              {data.root_title && (
                <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Central Theme
                  </span>
                  <h4 className="text-lg font-semibold text-white mt-1 tracking-tight">{data.root_title}</h4>
                </div>
              )}

              {data.nodes && data.nodes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {data.nodes.map((node: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-2 hover:border-indigo-500/40 transition-colors shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{node.label}</span>
                        {node.category && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/[0.04] text-indigo-400 border border-white/[0.08]">
                            {node.category}
                          </span>
                        )}
                      </div>
                      {node.description && (
                        <p className="text-[12px] text-neutral-400 leading-relaxed">
                          {node.description}
                        </p>
                      )}
                      {node.citation && (
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                          <span>Ref:</span> {node.citation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                  <p className="text-xs text-neutral-400">Central concept structure & summary:</p>
                  <pre className="overflow-x-auto p-4 rounded-xl bg-black/40 border border-white/[0.06] text-xs font-mono text-neutral-200 whitespace-pre-wrap">
                    {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              )}

              {data.edges && data.edges.length > 0 && (
                <div className="mt-4 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2.5">
                    Concept Relationships & Graph Edges
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {data.edges.map((edge: any, eIdx: number) => {
                      const sourceNode = data.nodes?.find((n: any) => n.id === edge.source);
                      const targetNode = data.nodes?.find((n: any) => n.id === edge.target);
                      return (
                        <div
                          key={eIdx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px]"
                        >
                          <span className="font-semibold text-white">{sourceNode?.label || edge.source}</span>
                          <span className="text-indigo-400 font-mono text-[10px]">→ {edge.label || "relates to"} →</span>
                          <span className="font-semibold text-white">{targetNode?.label || edge.target}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 8. Infographic Viewer */}
          {isInfographic && (
            <div className="space-y-6">
              {data.hero_metric && (
                <div className="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                  <p className="text-3xl font-extrabold text-indigo-400">{data.hero_metric.value}</p>
                  <p className="text-xs font-semibold text-white mt-1">
                    {data.hero_metric.label}
                  </p>
                  {data.hero_metric.citation && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">
                      {data.hero_metric.citation}
                    </p>
                  )}
                </div>
              )}

              {data.sections && data.sections.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.sections.map((sec: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold text-white">{sec.title}</h5>
                        {sec.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-indigo-400 border border-white/[0.08]">
                            {sec.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{sec.content}</p>
                      {sec.metric && (
                        <p className="text-sm font-bold text-indigo-400">{sec.metric}</p>
                      )}
                      {sec.citation && (
                        <p className="text-[10px] text-emerald-400 font-mono">{sec.citation}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 9. Video Storyboard Viewer */}
          {isVideo && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Clapperboard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{data.title || data.video_title || artifact.title}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Scene-by-scene production storyboard and voiceover script
                    </p>
                  </div>
                </div>
                {data.target_duration_seconds && (
                  <span className="text-xs px-3 py-1 rounded-full bg-white/[0.04] text-indigo-400 font-mono font-semibold border border-white/[0.08]">
                    {data.target_duration_seconds}s Total Runtime
                  </span>
                )}
              </div>

              {data.scenes && data.scenes.length > 0 ? (
                <div className="space-y-4">
                  {data.scenes.map((scene: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                        <span className="text-xs font-semibold text-white">
                          Scene {scene.scene_number || idx + 1}: {scene.title}
                        </span>
                        <div className="flex items-center gap-2">
                          {scene.citation && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-emerald-400 border border-white/[0.08] font-mono">
                              {scene.citation}
                            </span>
                          )}
                          {scene.duration_seconds && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-neutral-400 border border-white/[0.08] font-mono">
                              {scene.duration_seconds}s
                            </span>
                          )}
                        </div>
                      </div>

                      {scene.visual_description && (
                        <div className="text-[12px] text-neutral-400 leading-relaxed">
                          <span className="font-semibold text-white">Visual Direction: </span>
                          {scene.visual_description}
                        </div>
                      )}

                      {scene.on_screen_text && (
                        <div className="text-[11px] text-indigo-400 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] inline-block font-mono">
                          <span className="text-neutral-400 font-sans">On-Screen Text: </span>
                          "{scene.on_screen_text}"
                        </div>
                      )}

                      {scene.narration_script && (
                        <div className="p-3.5 rounded-xl bg-white/[0.03] text-xs text-neutral-200 leading-relaxed border border-white/[0.06]">
                          <span className="font-bold text-indigo-400">Voiceover Script: </span>
                          "{scene.narration_script}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400">No storyboard scenes generated.</p>
              )}
            </div>
          )}

          {/* 10. Fallback Viewer for Unknown Artifact Types */}
          {!isAudio && !isQuiz && !isFlashcards && !isSlides && !isReport && !isDataTable && !isMindMap && !isInfographic && !isVideo && (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Studio Artifact Output</span>
              </div>
              <pre className="overflow-x-auto p-4 rounded-xl bg-black/40 border border-white/[0.06] text-xs font-mono text-neutral-200 whitespace-pre-wrap">
                {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
