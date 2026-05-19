"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { SpeechSegment } from "@/hooks/useSpeechToText";
import { aiService } from "@/service/ai.service";
import {
  MicrophoneIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  LanguageIcon,
} from "@heroicons/react/24/outline";

// Languages for speech recognition
export const STT_LANGUAGES = [
  { code: "vi-VN", label: "🇻🇳 Tiếng Việt", apiCode: "vi" },
  { code: "en-US", label: "🇺🇸 English (US)", apiCode: "en" },
  { code: "en-GB", label: "🇬🇧 English (UK)", apiCode: "en" },
  { code: "zh-CN", label: "🇨🇳 中文 (简)", apiCode: "zh" },
  { code: "zh-TW", label: "🇹🇼 中文 (繁)", apiCode: "zh-TW" },
  { code: "ja-JP", label: "🇯🇵 日本語", apiCode: "ja" },
  { code: "ko-KR", label: "🇰🇷 한국어", apiCode: "ko" },
  { code: "fr-FR", label: "🇫🇷 Français", apiCode: "fr" },
  { code: "de-DE", label: "🇩🇪 Deutsch", apiCode: "de" },
  { code: "es-ES", label: "🇪🇸 Español", apiCode: "es" },
  { code: "th-TH", label: "🇹🇭 ภาษาไทย", apiCode: "th" },
];

export interface TranslatedSegment {
  originalId: string;
  translated: string;
  isLoading: boolean;
}

interface SpeechToTextPanelProps {
  isListening: boolean;
  isSupported: boolean;
  segments: SpeechSegment[];
  onToggle: () => void;
  onClear: () => void;
  onCopy: () => void;
  onClose: () => void;
  /** Current speech recognition language code e.g. "vi-VN" */
  lang: string;
  onLangChange: (lang: string) => void;
  sttEngine: "browser" | "google";
  onSttEngineChange: (engine: "browser" | "google") => void;
}

export function SpeechToTextPanel({
  isListening,
  isSupported,
  segments,
  onToggle,
  onClear,
  onCopy,
  onClose,
  lang,
  onLangChange,
  sttEngine,
  onSttEngineChange,
}: SpeechToTextPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  // translations: map of segment id → translated text
  const [translations, setTranslations] = useState<Map<string, TranslatedSegment>>(new Map());
  const translatingRef = useRef<Set<string>>(new Set());

  const isVietnamese = lang.startsWith("vi");
  const currentLangInfo = STT_LANGUAGES.find((l) => l.code === lang) ?? STT_LANGUAGES[0];

  // Auto-translate newly finalized segments when lang ≠ vi-VN
  useEffect(() => {
    if (isVietnamese) return; // no translation needed
    const finalSegments = segments.filter((s) => s.isFinal);
    for (const seg of finalSegments) {
      if (translations.has(seg.id)) continue;
      if (translatingRef.current.has(seg.id)) continue;
      translatingRef.current.add(seg.id);

      // Set loading state
      setTranslations((prev) => {
        const next = new Map(prev);
        next.set(seg.id, { originalId: seg.id, translated: "", isLoading: true });
        return next;
      });

      // Call translation API with model=null (free/model-0)
      const srcApiCode = currentLangInfo.apiCode;
      aiService
        .translate(seg.text, srcApiCode, "vi", /* model */ null)
        .then((res) => {
          setTranslations((prev) => {
            const next = new Map(prev);
            next.set(seg.id, { originalId: seg.id, translated: res.translated, isLoading: false });
            return next;
          });
        })
        .catch(() => {
          setTranslations((prev) => {
            const next = new Map(prev);
            next.set(seg.id, { originalId: seg.id, translated: "[Lỗi dịch]", isLoading: false });
            return next;
          });
        })
        .finally(() => {
          translatingRef.current.delete(seg.id);
        });
    }
  }, [segments, isVietnamese, currentLangInfo.apiCode, translations]);

  // Clear translations when segments are cleared
  useEffect(() => {
    if (segments.length === 0) {
      setTranslations(new Map());
    }
  }, [segments.length]);

  // Auto-scroll to bottom when new text arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, translations]);

  const handleCopy = useCallback(() => {
    if (isVietnamese) {
      onCopy();
    } else {
      // Copy with both original + translation
      const text = segments
        .filter((s) => s.isFinal)
        .map((s) => {
          const tr = translations.get(s.id);
          const trText = tr?.translated ? ` → ${tr.translated}` : "";
          return `[${s.timestamp}] [${s.speaker}] ${s.text}${trText}`;
        })
        .join("\n");
      if (text) navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [isVietnamese, onCopy, segments, translations]);

  return (
    <div className="absolute inset-y-0 right-0 z-40 flex h-full w-full max-w-[420px] flex-col overflow-hidden border-l border-white/15 bg-black/90 shadow-2xl backdrop-blur-md sm:w-[420px]">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
        {isListening && (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
        <span className="text-white text-sm font-semibold flex-1">
          Phiên Âm Giọng Nói
          {isListening && <span className="text-red-400 ml-2 text-xs">● LIVE</span>}
        </span>

        <select
          title="Chọn engine nhận dạng"
          value={sttEngine}
          onChange={(e) =>
            onSttEngineChange(e.target.value as "browser" | "google")
          }
          className="max-w-28 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
        >
          <option className="bg-gray-900 text-white" value="google">
            Google AI
          </option>
          <option className="bg-gray-900 text-white" value="browser">
            Browser
          </option>
        </select>

        {/* Lang picker button */}
        <div className="relative">
          <button
            type="button"
            title="Chọn ngôn ngữ nhận dạng"
            onClick={() => setShowLangMenu((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            <LanguageIcon className="w-3.5 h-3.5" />
            {currentLangInfo.label.split(" ").slice(1).join(" ")}
          </button>

          {/* Dropdown */}
          {showLangMenu && (
            <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-white/15 rounded-xl shadow-2xl overflow-hidden z-50 w-52">
              <div className="text-white/40 text-[10px] font-semibold uppercase px-3 py-1.5 border-b border-white/10">
                Ngôn ngữ nhận dạng
              </div>
              <div className="max-h-56 overflow-y-auto">
                {STT_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      onLangChange(l.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                      l.code === lang
                        ? "bg-secondary/30 text-secondary"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {l.label}
                    {l.code === lang && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
              {!isVietnamese && (
                <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/40">
                  💡 Kết quả sẽ tự động dịch sang Tiếng Việt
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          title="Sao chép toàn bộ"
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ClipboardDocumentIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Xóa nội dung"
          onClick={onClear}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Đóng"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        </div>
      </div>

      {/* Transcript body */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-2.5"
        onClick={() => setShowLangMenu(false)}
      >
        {!isSupported ? (
          <p className="text-white/50 text-xs text-center py-4">
            {sttEngine === "google" ? (
              <>
                Trình duyệt không hỗ trợ thu âm MediaRecorder.<br />
                Hãy đổi sang Browser STT hoặc dùng Chrome/Edge.
              </>
            ) : (
              <>
                Trình duyệt không hỗ trợ Speech Recognition.<br />
                Hãy dùng Chrome hoặc Edge.
              </>
            )}
          </p>
        ) : segments.length === 0 ? (
          <p className="text-white/40 text-xs text-center py-4 select-none">
            {isListening
              ? "Đang lắng nghe... hãy nói gì đó"
              : "Nhấn nút micro để bắt đầu phiên âm"}
          </p>
        ) : (
          segments.map((seg) => {
            const tr = translations.get(seg.id);
            return (
              <div key={seg.id} className="group flex gap-2">
                <span className="text-white/30 text-[10px] leading-5 shrink-0 mt-0.5">
                  {seg.timestamp}
                </span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <span className="text-white/45 text-[10px] font-semibold leading-none">
                    {seg.speaker}
                  </span>
                  {/* Original text */}
                  <p
                    className={`text-sm leading-relaxed break-words ${
                      seg.isFinal ? "text-white" : "text-white/50 italic"
                    }`}
                  >
                    {seg.text}
                  </p>

                  {/* Translation row — only for non-Vietnamese + final segments */}
                  {!isVietnamese && seg.isFinal && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-secondary/70 text-[10px] mt-0.5 shrink-0">🇻🇳</span>
                      {tr?.isLoading ? (
                        <span className="text-white/30 text-xs italic animate-pulse">Đang dịch...</span>
                      ) : tr?.translated ? (
                        <p className="text-secondary/90 text-xs leading-relaxed break-words">
                          {tr.translated}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: toggle button */}
      <div className="shrink-0 px-4 py-3 border-t border-white/10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { setShowLangMenu(false); onToggle(); }}
          disabled={!isSupported}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all select-none outline-none
            ${isListening
              ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
              : "bg-white/15 hover:bg-white/25 text-white"
            }
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          <MicrophoneIcon className={`w-4 h-4 ${isListening ? "animate-pulse" : ""}`} />
          {isListening ? "Dừng phiên âm" : "Bắt đầu phiên âm"}
        </button>
        <span className="text-white/40 text-xs">
          {segments.filter((s) => s.isFinal).length} câu đã phiên âm
          {!isVietnamese && ` • tự động dịch sang 🇻🇳`}
        </span>
      </div>
    </div>
  );
}
