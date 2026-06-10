"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export interface SpeechSegment {
  id: string;
  speakerUserId?: string;
  speaker: string;
  text: string;
  isFinal: boolean;
  timestamp: string;
  detectedLanguage?: string;
}

interface UseSpeechToTextOptions {
  lang?: string;
  /** Called whenever a new final/interim segment is emitted */
  onSegment?: (seg: SpeechSegment) => void;
  speakerUserId?: string;
  speakerName?: string;
  /** Socket.IO client connected to the /call namespace */
  socket?: Socket | null;
  /** Current call room id */
  roomId?: string | null;
  /** Fallback display name for remote STT segments */
  remoteSpeakerName?: string;
}

interface RemoteSttPayload {
  actionUserId?: string;
  speakerUserId?: string;
  roomId?: string;
  speaker?: string;
  text: string;
  isFinal: boolean;
  timestamp?: string;
  detectedLanguage?: string;
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useSpeechToText({
  lang = "vi-VN",
  onSegment,
  speakerUserId,
  speakerName = "Bạn",
  socket,
  roomId,
  remoteSpeakerName = "Người tham gia",
}: UseSpeechToTextOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState<SpeechSegment[]>([]);
  const [isSupported] = useState(() => !!SpeechRecognitionAPI);
  const recognitionRef = useRef<any>(null);
  const interimIdRef = useRef<string | null>(null);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;
  const speakerNameRef = useRef(speakerName);
  speakerNameRef.current = speakerName;
  const speakerUserIdRef = useRef(speakerUserId);
  speakerUserIdRef.current = speakerUserId;
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const remoteSpeakerNameRef = useRef(remoteSpeakerName);
  remoteSpeakerNameRef.current = remoteSpeakerName;

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI || isListening) return;

    const rec = new SpeechRecognitionAPI();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => setIsListening(true);

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        const isFinal = result.isFinal;

        if (isFinal) {
          const finalSeg: SpeechSegment = {
            id: Date.now().toString() + Math.random(),
            speakerUserId: speakerUserIdRef.current,
            speaker: speakerNameRef.current,
            text: transcript,
            isFinal: true,
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            detectedLanguage: lang.split("-")[0],
          };
          // Remove interim, add final
          setSegments((prev) => {
            const filtered = interimIdRef.current
              ? prev.filter((s) => s.id !== interimIdRef.current)
              : prev;
            return [...filtered, finalSeg];
          });
          interimIdRef.current = null;
          onSegmentRef.current?.(finalSeg);

          if (socketRef.current && roomIdRef.current) {
            socketRef.current.emit("call:stt-segment", {
              roomId: roomIdRef.current,
              speakerUserId: speakerUserIdRef.current,
              speaker: speakerNameRef.current,
              text: transcript,
              isFinal: true,
              detectedLanguage: lang.split("-")[0],
              timestamp: finalSeg.timestamp,
            });
          }
        } else {
          // Interim: update or create an interim segment
          setSegments((prev) => {
            if (interimIdRef.current) {
              return prev.map((s) =>
                s.id === interimIdRef.current ? { ...s, text: transcript } : s
              );
            }
            const interimId = "interim-" + Date.now();
            interimIdRef.current = interimId;
            const interimSeg: SpeechSegment = {
              id: interimId,
              speakerUserId: speakerUserIdRef.current,
              speaker: speakerNameRef.current,
              text: transcript,
              isFinal: false,
              timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              detectedLanguage: lang.split("-")[0],
            };
            return [...prev, interimSeg];
          });
        }
      }
    };

    rec.onerror = (e: any) => {
      console.warn("[STT] error:", e.error);
      if (e.error !== "aborted" && e.error !== "no-speech") {
        setIsListening(false);
      }
    };

    rec.onend = () => {
      // Auto-restart if still in listening mode (recognition stops after silence)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    try {
      rec.start();
    } catch {
      setIsListening(false);
    }
  }, [lang, isListening]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try { rec.stop(); } catch {}
    }
    setIsListening(false);
    interimIdRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  const clear = useCallback(() => {
    setSegments([]);
    interimIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleRemoteStt = (data: RemoteSttPayload) => {
      if (data.roomId && data.roomId !== roomIdRef.current) return;

      const remoteSeg: SpeechSegment = {
        id: Date.now().toString() + Math.random(),
        speakerUserId: data.speakerUserId || data.actionUserId,
        speaker: data.speaker || remoteSpeakerNameRef.current,
        text: data.text,
        isFinal: data.isFinal,
        detectedLanguage: data.detectedLanguage,
        timestamp:
          data.timestamp ||
          new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
      };

      setSegments((prev) => [...prev, remoteSeg]);
      onSegmentRef.current?.(remoteSeg);
    };

    socket.on("call:stt-segment", handleRemoteStt);

    return () => {
      socket.off("call:stt-segment", handleRemoteStt);
    };
  }, [socket, roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) try { rec.stop(); } catch {}
    };
  }, []);

  // Handle language change while listening
  useEffect(() => {
    if (isListening) {
      // Stop current and restart with new lang
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) {
        try { rec.stop(); } catch {}
      }
      // Re-start after a short delay to allow 'onend' to fire and cleanup
      const timer = setTimeout(() => {
        start();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [lang]); // Re-run when lang changes

  return { isListening, isSupported, segments, start, stop, toggle, clear };
}
