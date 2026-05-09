// MiniAudioBubble.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlayIcon,
  PauseIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import { aiService } from "@/service/ai.service";

function fmt(t: number) {
  if (!isFinite(t) || t <= 0) return "0:00";
  const s = Math.floor(t);
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

interface MiniAudioBubbleProps {
  src: string;
  initialDuration?: number; // giây (nếu đã có sẵn từ server)
  className?: string;
  onPlayChange?: (isPlaying: boolean) => void;
  /**
   * IDs needed to call Speech-to-Text. When BOTH provided, a "Convert to
   * text" button renders next to the play button. The audio is fetched
   * server-side from S3 — FE only sends the IDs to `/ai/transcribe-attachment`.
   */
  attachmentId?: string;
  messageId?: string;
  /**
   * Existing transcript loaded with the message (from `attachment.transcript`
   * field on the BE). When set, the button is hidden and the transcript
   * is rendered immediately. `null` / `undefined` means not transcribed yet.
   */
  initialTranscript?: string | null;
}

export default function MiniAudioBubble({
  src,
  initialDuration,
  className = "",
  onPlayChange,
  attachmentId,
  messageId,
  initialTranscript,
}: MiniAudioBubbleProps) {
  const { t, i18n } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [dur, setDur] = useState(initialDuration ?? 0);

  // Local transcript state — initialized from prop, mutated by the
  // transcribe button. This lets the user see their own transcript
  // immediately without waiting for a message-store roundtrip.
  const [transcript, setTranscript] = useState<string | null>(
    initialTranscript ?? null,
  );
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when the parent reloads a message that already has
  // transcript persisted (e.g., page refresh, or another user transcribed
  // and the message gets re-fetched).
  useEffect(() => {
    if (typeof initialTranscript === "string") {
      setTranscript(initialTranscript);
    }
  }, [initialTranscript]);

  useEffect(() => {
    const a = new Audio(src);
    audioRef.current = a;
    a.preload = "metadata";

    const onLoaded = () => setDur(a.duration || initialDuration || 0);
    const onEnded = () => {
      setPlaying(false);
      onPlayChange?.(false);
    };
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);

    return () => {
      a.pause();
      a.src = "";
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [src, initialDuration, onPlayChange]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setPlaying(false);
      onPlayChange?.(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
        onPlayChange?.(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleTranscribe = async () => {
    if (!attachmentId || !messageId || transcribing) return;
    // Avoid re-running when we already have a transcript locally.
    if (typeof transcript === "string") return;

    setTranscribing(true);
    setError(null);
    try {
      const lang: "vi" | "en" = i18n.language === "en" ? "en" : "vi";
      const res = await aiService.transcribeAttachment(
        attachmentId,
        messageId,
        lang,
      );
      setTranscript(res.transcript ?? "");
    } catch (err) {
      console.error("[stt] transcribe failed", err);
      setError(t("chat.stt.failed"));
    } finally {
      setTranscribing(false);
    }
  };

  const bars = useMemo(() => {
    // 18 cột cao dần nhìn giống Messenger
    return new Array(18).fill(0).map((_, i) => i);
  }, []);

  const showTranscribeButton =
    !!attachmentId && !!messageId && typeof transcript !== "string";

  return (
    <div className="flex flex-col gap-1 w-full">
      <div
        className={`flex items-center gap-3 w-full rounded-2xl px-3 py-2
                  bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-sm ${className}`}
      >
        <button
          onClick={toggle}
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/25 hover:bg-white/35 transition"
          aria-label={
            isPlaying ? t("chat.file.audio.pause") : t("chat.file.audio.play")
          }
        >
          {isPlaying ? (
            <PauseIcon className="w-4 h-4" />
          ) : (
            <PlayIcon className="w-4 h-4" />
          )}
        </button>

        {/* Cột sóng */}
        <div className="flex-1 min-w-0 h-8 flex items-end gap-0.75">
          {bars.map((i) => (
            <span
              key={i}
              className={`w-1 bg-white/90 rounded-sm origin-bottom
              ${isPlaying ? "animate-voicebar" : ""}`}
              style={{
                height: `${6 + i * 2}px`, // cao dần
                animationDelay: `${(i % 6) * 80}ms`,
              }}
            />
          ))}
        </div>

        <div className="shrink-0 text-[12px] font-semibold tabular-nums">
          {fmt(dur)}
        </div>

        {/* "Convert to text" button — only shown when we can call STT and
            don't already have a transcript. Compact icon-only button to
            avoid making the audio bubble overflow on narrow chat columns. */}
        {showTranscribeButton && (
          <button
            onClick={handleTranscribe}
            disabled={transcribing}
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/25 hover:bg-white/35 transition disabled:opacity-60 disabled:cursor-wait"
            aria-label={t("chat.stt.transcribe")}
            title={t("chat.stt.transcribe")}
          >
            {transcribing ? (
              <span className="w-3 h-3 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
            ) : (
              <DocumentTextIcon className="w-4 h-4" />
            )}
          </button>
        )}

        {/* audio ẩn */}
        <audio src={src} className="hidden" />
        <style jsx>{`
          @keyframes voicebar {
            0% {
              transform: scaleY(0.6);
              opacity: 0.85;
            }
            50% {
              transform: scaleY(1.1);
              opacity: 1;
            }
            100% {
              transform: scaleY(0.6);
              opacity: 0.85;
            }
          }
          .animate-voicebar {
            animation: voicebar 900ms ease-in-out infinite;
          }
        `}</style>
      </div>

      {/* Transcript inline — sits below the audio bubble. Empty string
          (transcript === "") means audio was processed but no speech was
          detected; show a hint instead of an empty card. Errors render in
          red but don't block the user from retrying. */}
      {typeof transcript === "string" && (
        <div className="text-xs leading-relaxed px-3 py-2 rounded-lg bg-default-100 dark:bg-default-50 text-default-700 dark:text-default-200">
          <span className="text-default-500 dark:text-default-400 mr-1">
            📄
          </span>
          {transcript.length > 0 ? transcript : t("chat.stt.noSpeech")}
        </div>
      )}
      {error && (
        <div className="text-xs px-3 py-1 rounded-lg bg-danger/10 text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
