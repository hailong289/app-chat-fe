// MiniAudioBubble.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlayIcon, PauseIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";

function fmt(t: number) {
  if (!isFinite(t) || t <= 0) return "0:00";
  const s = Math.floor(t);
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

export default function MiniAudioBubble({
  src,
  initialDuration,
  className = "",
  onPlayChange, // optional callback khi play/pause
}: {
  src: string;
  initialDuration?: number; // giây (nếu đã có sẵn từ server)
  className?: string;
  onPlayChange?: (isPlaying: boolean) => void;
}) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [dur, setDur] = useState(initialDuration ?? 0);

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

  const bars = useMemo(() => {
    // 18 cột cao dần nhìn giống Messenger
    return new Array(18).fill(0).map((_, i) => i);
  }, []);

  return (
    <div
      className={`flex items-center gap-3 w-full rounded-2xl px-3 py-2
                  bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm ${className}`}
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
      <div className="flex-1 min-w-0 h-8 flex items-end gap-[3px]">
        {bars.map((i) => (
          <span
            key={i}
            className={`w-[4px] bg-white/90 rounded-sm origin-bottom
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
  );
}
