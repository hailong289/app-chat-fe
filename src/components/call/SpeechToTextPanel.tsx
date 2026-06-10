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

const TRANSLATE_LANGUAGE_OPTIONS = [
  { code: "auto", label: "Tự động nhận diện" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
] as const;

export interface RemoteSttParticipant {
  id: string;
  fullname: string;
}

export interface TranslatedSegment {
  originalId: string;
  translated: string;
  isLoading: boolean;
}

interface SpeechToTextPanelProps {
  isListening: boolean;
  isSupported: boolean;
  segments: SpeechSegment[];
  onClear: () => void;
  onCopy: () => void;
  onClose: () => void;
  /** Current speech recognition language code e.g. "vi-VN" */
  lang: string;
  onLangChange: (lang: string) => void;
  sttEngine: "browser" | "google";
  onSttEngineChange: (engine: "browser" | "google") => void;
  remoteParticipants: RemoteSttParticipant[];
  subscriptions: Record<string, boolean>;
  onSubscriptionChange: (targetUserId: string, enabled: boolean) => void;
  isSendingTranscript: boolean;
  remoteRequesterNames: string[];
  translateEnabled: boolean;
  translateFrom: string;
  translateTo: string;
  onTranslateEnabledChange: (enabled: boolean) => void;
  onTranslateFromChange: (language: string) => void;
  onTranslateToChange: (language: string) => void;
}

export function SpeechToTextPanel({
  isListening,
  isSupported,
  segments,
  onClear,
  onCopy,
  onClose,
  lang,
  onLangChange,
  sttEngine,
  onSttEngineChange,
  remoteParticipants,
  subscriptions,
  onSubscriptionChange,
  isSendingTranscript,
  remoteRequesterNames,
  translateEnabled,
  translateFrom,
  translateTo,
  onTranslateEnabledChange,
  onTranslateFromChange,
  onTranslateToChange,
}: SpeechToTextPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  // translations: map of segment id → translated text
  const [translations, setTranslations] = useState<Map<string, TranslatedSegment>>(new Map());
  const translatingRef = useRef<Set<string>>(new Set());

  const currentLangInfo = STT_LANGUAGES.find((l) => l.code === lang) ?? STT_LANGUAGES[0];
  const canTranslate = translateEnabled && translateFrom !== translateTo;
  const targetLangInfo =
    TRANSLATE_LANGUAGE_OPTIONS.find((l) => l.code === translateTo) ??
    TRANSLATE_LANGUAGE_OPTIONS[1];
  const translationKeyFor = useCallback(
    (seg: SpeechSegment) => `${seg.id}:${translateFrom}:${translateTo}`,
    [translateFrom, translateTo],
  );

  // Auto-translate newly finalized segments using explicit from/to settings.
  useEffect(() => {
    if (!canTranslate) return;
    const finalSegments = segments.filter((s) => s.isFinal);
    for (const seg of finalSegments) {
      const key = translationKeyFor(seg);
      if (translations.has(key)) continue;
      if (translatingRef.current.has(key)) continue;
      translatingRef.current.add(key);

      // Set loading state
      setTranslations((prev) => {
        const next = new Map(prev);
        next.set(key, { originalId: seg.id, translated: "", isLoading: true });
        return next;
      });

      // Call translation API with model=null (free/model-0)
      const srcApiCode = translateFrom === "auto" ? "auto" : translateFrom;
      aiService
        .translate(seg.text, srcApiCode, translateTo, /* model */ null)
        .then((res) => {
          setTranslations((prev) => {
            const next = new Map(prev);
            next.set(key, { originalId: seg.id, translated: res.translated, isLoading: false });
            return next;
          });
        })
        .catch(() => {
          setTranslations((prev) => {
            const next = new Map(prev);
            next.set(key, { originalId: seg.id, translated: "[Lỗi dịch]", isLoading: false });
            return next;
          });
        })
        .finally(() => {
          translatingRef.current.delete(key);
        });
    }
  }, [segments, canTranslate, translateFrom, translateTo, translations, translationKeyFor]);

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
    if (!canTranslate) {
      onCopy();
    } else {
      // Copy with both original + translation
      const text = segments
        .filter((s) => s.isFinal)
        .map((s) => {
          const tr = translations.get(translationKeyFor(s));
          const trText = tr?.translated ? ` -> ${tr.translated}` : "";
          return `[${s.timestamp}] [${s.speaker}] ${s.text}${trText}`;
        })
        .join("\n");
      if (text) navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [canTranslate, onCopy, segments, translations, translationKeyFor]);

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
              <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/40">
                Ngôn ngữ này chỉ dùng cho nhận dạng giọng nói.
              </div>
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
        <div className="mt-3 grid grid-cols-[auto_1fr_1fr] items-end gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={translateEnabled}
            onClick={() => onTranslateEnabledChange(!translateEnabled)}
            className={`h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
              translateEnabled
                ? "bg-secondary text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Dịch
          </button>
          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-white/35">
              From
            </span>
            <select
              value={translateFrom}
              onChange={(e) => onTranslateFromChange(e.target.value)}
              disabled={!translateEnabled}
              className="h-8 w-full rounded-lg bg-white/10 px-2 text-xs text-white outline-none disabled:opacity-40"
            >
              {TRANSLATE_LANGUAGE_OPTIONS.map((l) => (
                <option className="bg-gray-900 text-white" key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-white/35">
              To
            </span>
            <select
              value={translateTo}
              onChange={(e) => onTranslateToChange(e.target.value)}
              disabled={!translateEnabled}
              className="h-8 w-full rounded-lg bg-white/10 px-2 text-xs text-white outline-none disabled:opacity-40"
            >
              {TRANSLATE_LANGUAGE_OPTIONS.filter((l) => l.code !== "auto").map((l) => (
                <option className="bg-gray-900 text-white" key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Transcript body */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-2.5"
        onClick={() => setShowLangMenu(false)}
      >
        {!isSupported && isSendingTranscript ? (
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
              ? "Đang xử lý phiên âm..."
              : "Bật switch người muốn nhận phiên âm"}
          </p>
        ) : (
          segments.map((seg) => {
            const tr = translations.get(translationKeyFor(seg));
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

                  {/* Translation row */}
                  {canTranslate && seg.isFinal && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-secondary/70 text-[10px] mt-0.5 shrink-0">
                        {targetLangInfo.code.toUpperCase()}
                      </span>
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

      {/* Footer: remote STT switches */}
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase text-white/35">
            Nhận phiên âm từ
          </span>
          <span className="text-white/40 text-xs">
            {segments.filter((s) => s.isFinal).length} câu
            {canTranslate && ` -> ${targetLangInfo.code.toUpperCase()}`}
          </span>
        </div>
        <div className="space-y-2">
          {remoteParticipants.length === 0 ? (
            <p className="text-xs text-white/40">Chưa có người tham gia khác.</p>
          ) : (
            remoteParticipants.map((participant) => {
              const enabled = !!subscriptions[participant.id];
              return (
                <div
                  key={participant.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-white">
                    {participant.fullname}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => {
                      setShowLangMenu(false);
                      onSubscriptionChange(participant.id, !enabled);
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      enabled ? "bg-secondary" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        enabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })
          )}
        </div>
        {isSendingTranscript && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <MicrophoneIcon className="h-4 w-4 animate-pulse" />
            <span className="min-w-0">
              Đang gửi phiên âm của bạn
              {remoteRequesterNames.length > 0
                ? ` cho ${remoteRequesterNames.join(", ")}`
                : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
