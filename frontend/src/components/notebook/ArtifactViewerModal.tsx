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
    // If native audio file exists and can play
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

    // Speech synthesis fallback
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
    } else if (q.options && typeof q.options === "object") {
      options = Object.values(q.options).map((o: any) => String(o));
    }

    const isTF =
      q.type === "true_false" ||
      q.type === "boolean" ||
      options.length === 2 ||
      (options.length === 0 && (q.question?.toLowerCase().includes("true or false") || q.answer !== undefined));

    if (isTF && (options.length === 0 || options.length !== 2)) {
      options = ["True", "False"];
    } else if (options.length === 0) {
      options = ["Option A", "Option B", "Option C", "Option D"];
    }

    let correctIdx: number | undefined = undefined;
    const raw =
      q.correct_index !== undefined
        ? q.correct_index
        : q.correct_option !== undefined
        ? q.correct_option
        : q.correct_indices?.[0] !== undefined
        ? q.correct_indices[0]
        : q.correct_answer !== undefined
        ? q.correct_answer
        : q.answer;

    if (typeof raw === "number") {
      correctIdx = raw;
    } else if (typeof raw === "boolean") {
      correctIdx = raw ? 0 : 1;
    } else if (typeof raw === "string") {
      const s = raw.trim();
      if (/^\d+$/.test(s)) {
        correctIdx = parseInt(s, 10);
      } else if (s.toLowerCase() === "true" || s.toLowerCase() === "t") {
        correctIdx = 0;
      } else if (s.toLowerCase() === "false" || s.toLowerCase() === "f") {
        correctIdx = 1;
      } else if (["A", "B", "C", "D"].includes(s.toUpperCase())) {
        correctIdx = { A: 0, B: 1, C: 2, D: 3 }[s.toUpperCase() as "A" | "B" | "C" | "D"];
      } else {
        const found = options.findIndex((opt) => opt.toLowerCase().trim() === s.toLowerCase());
        if (found !== -1) correctIdx = found;
      }
    }

    if (correctIdx === undefined || correctIdx < 0 || correctIdx >= options.length) {
      correctIdx = 0;
    }

    return { options, correctIdx, isTF };
  };

  // Quiz score calculation
  const calculateScore = () => {
    if (!data.questions || !Array.isArray(data.questions)) return { correct: 0, total: 0, pct: 0 };
    let correct = 0;
    data.questions.forEach((q: any, idx: number) => {
      const { correctIdx } = resolveQuestionDetails(q);
      if (quizAnswers[idx] === correctIdx) correct++;
    });
    const total = data.questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, total, pct };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl min-h-[420px] max-h-[88vh] rounded-3xl border border-[#273247] bg-[#151B27] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#273247] bg-[#10141D]">
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-bold text-[#F1F5FC] truncate">
              {artifact.title || data.title || data.deck_title || data.report_title || data.video_title || "Studio Artifact"}
            </h3>
            <p className="text-[11px] text-[#A0AEC0] capitalize flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#6D8FFF]" />
              {(rawType || artifact.artifact_type || "artifact").replace("_", " ")} • Generated with Gemini
            </p>
          </div>

          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="p-2 rounded-xl border border-[#273247] text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332] transition-colors"
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
              className="p-2 rounded-xl text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 text-[#F1F5FC]">
          {/* 1. Audio Overview Viewer */}
          {isAudio && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-[#10141D] border border-[#273247] flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#6D8FFF] text-[#0B0D12] flex items-center justify-center mb-4 shadow-lg shadow-[#6D8FFF]/20">
                  <Volume2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-[#F1F5FC]">{artifact.title || data.title}</h4>
                <p className="text-xs text-[#A0AEC0] mt-1">
                  Format: Two-host conversational podcast (Alex & Sam)
                </p>

                {data.summary && (
                  <p className="text-xs text-[#A0AEC0] max-w-xl mt-3 leading-relaxed">
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
                    className="px-6 py-2.5 rounded-full bg-[#6D8FFF] text-[#0B0D12] font-semibold text-xs flex items-center gap-2 shadow-sm hover:bg-[#84A2FF] transition-all"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlayingAudio ? "Pause Podcast" : "Play Podcast"}</span>
                  </button>

                  <button
                    onClick={handleSpeedChange}
                    className="px-3 py-1.5 rounded-full border border-[#273247] text-xs font-mono font-medium hover:bg-[#1B2332] transition-colors text-[#A0AEC0]"
                  >
                    {playbackSpeed}x
                  </button>
                </div>
              </div>

              {/* Dialogue Transcript */}
              {dialogueList.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#A0AEC0]">
                    Dialogue Transcript ({dialogueList.length} turns)
                  </h5>
                  <div className="p-5 rounded-2xl bg-[#10141D] border border-[#273247] text-xs leading-relaxed space-y-3.5 font-sans">
                    {dialogueList.map((line, idx) => {
                      const speakerName = line.speaker || (idx % 2 === 0 ? "Alex" : "Sam");
                      const isAlex = speakerName.toLowerCase().includes("alex");
                      return (
                        <div key={idx} className="flex gap-3 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              isAlex
                                ? "bg-[#6D8FFF]/15 text-[#6D8FFF] border border-[#6D8FFF]/30"
                                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {speakerName}
                          </span>
                          <div className="space-y-1">
                            <span className="text-[#F1F5FC] leading-relaxed">{line.text || line.dialogue}</span>
                            {line.source_refs && line.source_refs.length > 0 && (
                              <div className="flex gap-1 pt-1">
                                {line.source_refs.map((ref, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="text-[10px] text-[#34D399] font-mono px-1.5 py-0.5 rounded-sm bg-[#151B27] border border-[#273247]"
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
                          <p className="text-lg font-black text-[#F1F5FC]">
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
                        className="p-5 rounded-2xl border border-[#273247] bg-[#10141D] space-y-3.5 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#151B27] text-[#6D8FFF] border border-[#273247] uppercase tracking-wider">
                              {isTF ? "True / False" : "Multiple Choice"}
                            </span>
                            <p className="text-xs font-bold text-[#F1F5FC] leading-relaxed">
                              {qIdx + 1}. {q.question}
                            </p>
                          </div>
                          {q.citation && (
                            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[#151B27] text-[#34D399] border border-[#273247] font-mono">
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
                                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold shadow-sm"
                                    : isWrong
                                    ? "bg-rose-500/20 border-rose-500 text-rose-300"
                                    : isSelected
                                    ? "bg-[#6D8FFF] text-[#0B0D12] font-semibold border-transparent shadow-sm"
                                    : "bg-[#151B27] border-[#273247] text-[#F1F5FC] hover:bg-[#1B2332]"
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
                          <div className="p-3.5 rounded-xl bg-[#151B27] text-[11px] text-[#A0AEC0] leading-relaxed border border-[#273247]">
                            <span className="font-bold text-[#6D8FFF]">Rationale: </span>
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
                        className="px-6 py-2.5 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] shadow-sm transition-all"
                      >
                        Submit Answers
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsQuizSubmitted(false);
                          setQuizAnswers({});
                        }}
                        className="px-5 py-2.5 rounded-xl border border-[#273247] text-xs font-semibold hover:bg-[#1B2332] text-[#F1F5FC] transition-colors"
                      >
                        Retake Quiz
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#A0AEC0]">No quiz questions generated.</p>
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
                    className="w-full max-w-lg min-h-[220px] rounded-3xl border border-[#273247] bg-[#10141D] hover:border-[#6D8FFF]/50 cursor-pointer p-8 flex flex-col items-center justify-between text-center shadow-lg transition-all"
                  >
                    <div className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#A0AEC0]">
                      <span>{isFlipped ? "Answer / Definition" : "Prompt / Concept"}</span>
                      {data.cards[cardIndex]?.difficulty && (
                        <span className="px-2 py-0.5 rounded-full bg-[#151B27] text-[#6D8FFF] border border-[#273247]">
                          {data.cards[cardIndex].difficulty}
                        </span>
                      )}
                    </div>

                    <p className="text-base font-semibold text-[#F1F5FC] leading-relaxed my-4">
                      {isFlipped
                        ? data.cards[cardIndex]?.back || data.cards[cardIndex]?.answer
                        : data.cards[cardIndex]?.front || data.cards[cardIndex]?.question}
                    </p>

                    <div className="w-full flex items-center justify-between text-[10px] text-[#A0AEC0]">
                      <span className="text-[#34D399] font-mono">{data.cards[cardIndex]?.source_ref || "Grounding Ref"}</span>
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
                      className="p-2.5 rounded-xl border border-[#273247] hover:bg-[#1B2332] disabled:opacity-40 transition-colors text-[#F1F5FC]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-medium text-[#A0AEC0]">
                      {cardIndex + 1} / {data.cards.length}
                    </span>
                    <button
                      disabled={cardIndex === data.cards.length - 1}
                      onClick={() => {
                        setCardIndex(cardIndex + 1);
                        setIsFlipped(false);
                      }}
                      className="p-2.5 rounded-xl border border-[#273247] hover:bg-[#1B2332] disabled:opacity-40 transition-colors text-[#F1F5FC]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#A0AEC0]">No flashcards available.</p>
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
                      <div className="w-full max-w-2xl min-h-[320px] rounded-3xl border border-[#273247] bg-[#10141D] p-8 flex flex-col justify-between shadow-xl">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-mono text-[#A0AEC0] uppercase tracking-wider">
                              Slide {slideIndex + 1} of {data.slides.length}
                            </span>
                            {slide.layout && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#151B27] text-[#6D8FFF] border border-[#273247]">
                                {slide.layout}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xl font-bold text-[#F1F5FC] mb-2">{slide.title}</h4>
                          {slide.subtitle && (
                            <p className="text-xs text-[#6D8FFF] mb-4 font-medium">{slide.subtitle}</p>
                          )}

                          {slide.bullets && slide.bullets.length > 0 && (
                            <ul className="space-y-2.5 mt-4 text-xs text-[#F1F5FC] list-disc list-inside">
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
                          <div className="mt-6 pt-4 border-t border-[#273247] text-[11px] text-[#A0AEC0] italic">
                            <span className="font-semibold not-italic text-[#F1F5FC]">Speaker Notes: </span>
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
                      className="p-2.5 rounded-xl border border-[#273247] hover:bg-[#1B2332] disabled:opacity-40 transition-colors text-[#F1F5FC]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-medium text-[#A0AEC0]">
                      {slideIndex + 1} / {data.slides.length}
                    </span>
                    <button
                      disabled={slideIndex === data.slides.length - 1}
                      onClick={() => setSlideIndex(slideIndex + 1)}
                      className="p-2.5 rounded-xl border border-[#273247] hover:bg-[#1B2332] disabled:opacity-40 transition-colors text-[#F1F5FC]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#A0AEC0]">No slides available.</p>
              )}
            </div>
          )}

          {/* 5. Report Viewer with Rich Formatted Markdown */}
          {isReport && (
            <div className="space-y-6">
              {data.table_of_contents && data.table_of_contents.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#10141D] border border-[#273247]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0AEC0] mb-2">
                    Table of Contents
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.table_of_contents.map((item: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[#151B27] text-[#F1F5FC] border border-[#273247]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-8 rounded-2xl bg-[#10141D] border border-[#273247] text-xs text-[#F1F5FC] leading-relaxed font-sans prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-xl font-bold text-[#F1F5FC] mb-4 pb-2 border-b border-[#273247]">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold text-[#6D8FFF] mt-6 mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-[#F1F5FC] mt-4 mb-2">{children}</h3>,
                    p: ({ children }) => <p className="text-xs text-[#A0AEC0] leading-relaxed mb-4">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 mb-4 text-[#A0AEC0]">{children}</ul>,
                    li: ({ children }) => <li className="text-xs leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-bold text-[#F1F5FC]">{children}</strong>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-[#6D8FFF] pl-4 italic text-[#A0AEC0] my-3">{children}</blockquote>,
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
                <p className="text-xs text-[#A0AEC0]">{data.description}</p>
              )}
              {data.columns && data.rows ? (
                <div className="overflow-x-auto rounded-2xl border border-[#273247]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#10141D] text-[#F1F5FC] font-semibold border-b border-[#273247]">
                      <tr>
                        <th className="p-3 w-10 text-[#A0AEC0]">#</th>
                        {data.columns.map((col: any, cIdx: number) => (
                          <th key={cIdx} className="p-3">
                            {col.label || col.key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#273247]">
                      {data.rows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-[#1B2332] transition-colors">
                          <td className="p-3 font-mono text-[10px] text-[#A0AEC0]">{rIdx + 1}</td>
                          {data.columns.map((col: any, cIdx: number) => (
                            <td key={cIdx} className="p-3 text-[#F1F5FC]">
                              {row[col.key] !== undefined ? String(row[col.key]) : "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#A0AEC0]">No tabular rows found.</p>
              )}
            </div>
          )}

          {/* 7. Mind Map Viewer */}
          {isMindMap && (
            <div className="space-y-6">
              {data.root_title && (
                <div className="p-5 rounded-2xl bg-[#6D8FFF]/10 border border-[#6D8FFF]/30 text-center shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6D8FFF]">
                    Central Theme
                  </span>
                  <h4 className="text-lg font-bold text-[#F1F5FC] mt-1">{data.root_title}</h4>
                </div>
              )}

              {data.nodes && data.nodes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {data.nodes.map((node: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-[#273247] bg-[#10141D] space-y-2 hover:border-[#6D8FFF]/40 transition-colors shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F1F5FC]">{node.label}</span>
                        {node.category && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#151B27] text-[#6D8FFF] border border-[#273247]">
                            {node.category}
                          </span>
                        )}
                      </div>
                      {node.description && (
                        <p className="text-[12px] text-[#A0AEC0] leading-relaxed">
                          {node.description}
                        </p>
                      )}
                      {node.citation && (
                        <p className="text-[10px] text-[#34D399] flex items-center gap-1 font-mono">
                          <span>Ref:</span> {node.citation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#10141D] border border-[#273247] space-y-3">
                  <p className="text-xs text-[#A0AEC0]">Central concept structure & summary:</p>
                  <pre className="overflow-x-auto p-4 rounded-xl bg-[#151B27] border border-[#273247] text-xs font-mono text-[#F1F5FC] whitespace-pre-wrap">
                    {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              )}

              {data.edges && data.edges.length > 0 && (
                <div className="mt-4 p-4 rounded-2xl border border-[#273247] bg-[#10141D]">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#A0AEC0] mb-2.5">
                    Concept Relationships & Graph Edges
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {data.edges.map((edge: any, eIdx: number) => {
                      const sourceNode = data.nodes?.find((n: any) => n.id === edge.source);
                      const targetNode = data.nodes?.find((n: any) => n.id === edge.target);
                      return (
                        <div
                          key={eIdx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151B27] border border-[#273247] text-[11px]"
                        >
                          <span className="font-semibold text-[#F1F5FC]">{sourceNode?.label || edge.source}</span>
                          <span className="text-[#6D8FFF] font-mono text-[10px]">→ {edge.label || "relates to"} →</span>
                          <span className="font-semibold text-[#F1F5FC]">{targetNode?.label || edge.target}</span>
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
                <div className="p-6 rounded-3xl bg-[#6D8FFF]/10 border border-[#6D8FFF]/30 text-center">
                  <p className="text-3xl font-black text-[#6D8FFF]">{data.hero_metric.value}</p>
                  <p className="text-xs font-semibold text-[#F1F5FC] mt-1">
                    {data.hero_metric.label}
                  </p>
                  {data.hero_metric.citation && (
                    <p className="text-[10px] text-[#34D399] font-mono mt-1">
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
                      className="p-5 rounded-2xl border border-[#273247] bg-[#10141D] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-[#F1F5FC]">{sec.title}</h5>
                        {sec.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#151B27] text-[#6D8FFF] border border-[#273247]">
                            {sec.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#A0AEC0] leading-relaxed">{sec.content}</p>
                      {sec.metric && (
                        <p className="text-sm font-bold text-[#6D8FFF]">{sec.metric}</p>
                      )}
                      {sec.citation && (
                        <p className="text-[10px] text-[#34D399] font-mono">{sec.citation}</p>
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
              <div className="p-4 rounded-2xl bg-[#10141D] border border-[#273247] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#6D8FFF]/15 text-[#6D8FFF] flex items-center justify-center border border-[#6D8FFF]/30">
                    <Clapperboard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#F1F5FC]">{data.title || data.video_title || artifact.title}</p>
                    <p className="text-[11px] text-[#A0AEC0] mt-0.5">
                      Scene-by-scene production storyboard and voiceover script
                    </p>
                  </div>
                </div>
                {data.target_duration_seconds && (
                  <span className="text-xs px-3 py-1 rounded-full bg-[#151B27] text-[#6D8FFF] font-mono font-semibold border border-[#273247]">
                    {data.target_duration_seconds}s Total Runtime
                  </span>
                )}
              </div>

              {data.scenes && data.scenes.length > 0 ? (
                <div className="space-y-4">
                  {data.scenes.map((scene: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-[#273247] bg-[#10141D] space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-[#273247] pb-2.5">
                        <span className="text-xs font-bold text-[#F1F5FC]">
                          Scene {scene.scene_number || idx + 1}: {scene.title}
                        </span>
                        <div className="flex items-center gap-2">
                          {scene.citation && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#151B27] text-[#34D399] border border-[#273247] font-mono">
                              {scene.citation}
                            </span>
                          )}
                          {scene.duration_seconds && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#151B27] text-[#A0AEC0] border border-[#273247] font-mono">
                              {scene.duration_seconds}s
                            </span>
                          )}
                        </div>
                      </div>

                      {scene.visual_description && (
                        <div className="text-[12px] text-[#A0AEC0] leading-relaxed">
                          <span className="font-semibold text-[#F1F5FC]">Visual Direction: </span>
                          {scene.visual_description}
                        </div>
                      )}

                      {scene.on_screen_text && (
                        <div className="text-[11px] text-[#6D8FFF] px-3 py-1.5 rounded-xl bg-[#151B27] border border-[#273247] inline-block font-mono">
                          <span className="text-[#A0AEC0] font-sans">On-Screen Text: </span>
                          "{scene.on_screen_text}"
                        </div>
                      )}

                      {scene.narration_script && (
                        <div className="p-3.5 rounded-xl bg-[#151B27] text-xs text-[#F1F5FC] leading-relaxed border border-[#273247]">
                          <span className="font-bold text-[#6D8FFF]">Voiceover Script: </span>
                          "{scene.narration_script}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#A0AEC0]">No storyboard scenes generated.</p>
              )}
            </div>
          )}

          {/* 10. Fallback Viewer for Unknown Artifact Types */}
          {!isAudio && !isQuiz && !isFlashcards && !isSlides && !isReport && !isDataTable && !isMindMap && !isInfographic && !isVideo && (
            <div className="p-6 rounded-2xl bg-[#10141D] border border-[#273247] space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Studio Artifact Output</span>
              </div>
              <pre className="overflow-x-auto p-4 rounded-xl bg-[#151B27] border border-[#273247] text-xs font-mono text-[#F1F5FC] whitespace-pre-wrap">
                {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
