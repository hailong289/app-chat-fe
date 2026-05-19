"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSupportedMimeType } from "@/libs/mime";
import type { SpeechSegment } from "@/hooks/useSpeechToText";

interface UseGoogleSttOptions {
  socket?: Socket | null;
  roomId?: string | null;
  speakerName?: string;
  remoteSpeakerName?: string;
  language?: "vi" | "en";
  chunkDurationMs?: number;
  onSegment?: (seg: SpeechSegment) => void;
  onError?: (message: string) => void;
}

interface SttResultPayload {
  actionUserId?: string;
  roomId?: string;
  speaker?: string;
  text: string;
  detectedLanguage?: string;
  timestamp?: string;
}

interface SttAck {
  ok?: boolean;
  error?: string;
  isEmpty?: boolean;
}

function nowTimestamp() {
  return new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.readAsDataURL(blob);
  });
}

export function useGoogleStt({
  socket,
  roomId,
  speakerName = "Bạn",
  remoteSpeakerName = "Người tham gia",
  language = "vi",
  chunkDurationMs = 3000,
  onSegment,
  onError,
}: UseGoogleSttOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState<SpeechSegment[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSupported] = useState(
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const speakerNameRef = useRef(speakerName);
  speakerNameRef.current = speakerName;
  const remoteSpeakerNameRef = useRef(remoteSpeakerName);
  remoteSpeakerNameRef.current = remoteSpeakerName;
  const languageRef = useRef(language);
  languageRef.current = language;
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const reportError = useCallback((message: string) => {
    setLastError(message);
    onErrorRef.current?.(message);
  }, []);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleSttResult = (data: SttResultPayload) => {
      if (data.roomId && data.roomId !== roomIdRef.current) return;

      const seg: SpeechSegment = {
        id: Date.now().toString() + Math.random(),
        speaker: data.speaker || remoteSpeakerNameRef.current,
        text: data.text,
        isFinal: true,
        timestamp: data.timestamp || nowTimestamp(),
      };
      setSegments((prev) => [...prev, seg]);
      onSegmentRef.current?.(seg);
    };

    const handleSttError = (data: { message?: string }) => {
      reportError(data.message || "Không thể nhận dạng giọng nói lúc này");
    };

    socket.on("call:stt-result", handleSttResult);
    socket.on("call:stt-error", handleSttError);

    return () => {
      socket.off("call:stt-result", handleSttResult);
      socket.off("call:stt-error", handleSttError);
    };
  }, [socket, roomId, reportError]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {}
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || isListening || !socketRef.current || !roomIdRef.current) {
      return;
    }

    try {
      setLastError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = async (event) => {
        if (!event.data.size || !socketRef.current || !roomIdRef.current) return;

        try {
          const audioChunk = await readBlobAsBase64(event.data);
          if (!audioChunk) return;

          socketRef.current.emit(
            "call:stt-audio-chunk",
            {
              roomId: roomIdRef.current,
              speaker: speakerNameRef.current,
              audioChunk,
              mimeType: event.data.type || mimeType || "audio/webm",
              language: languageRef.current,
            },
            (ack?: SttAck) => {
              if (ack && ack.ok === false) {
                reportError(
                  ack.error || "Không thể nhận dạng giọng nói lúc này",
                );
              }
            },
          );
        } catch (err) {
          reportError(
            err instanceof Error
              ? err.message
              : "Không thể đọc audio chunk",
          );
        }
      };

      recorder.onerror = () => {
        reportError("MediaRecorder gặp lỗi khi thu âm");
        stop();
      };

      recorder.start(chunkDurationMs);
      mediaRecorderRef.current = recorder;
      setIsListening(true);
    } catch (err) {
      stop();
      reportError(
        err instanceof Error
          ? err.message
          : "Không thể bật micro cho Google STT",
      );
    }
  }, [chunkDurationMs, isListening, isSupported, reportError, stop]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else void start();
  }, [isListening, start, stop]);

  const clear = useCallback(() => {
    setSegments([]);
    setLastError(null);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    isListening,
    isSupported,
    segments,
    lastError,
    start,
    stop,
    toggle,
    clear,
  };
}
