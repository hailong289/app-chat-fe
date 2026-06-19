"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSupportedMimeType } from "@/libs/mime";
import {
  normalizeAudioMimeType,
  readBlobAsBase64,
  sttNowTimestamp,
} from "@/libs/sttHelpers";
import type { SpeechSegment } from "@/hooks/useSpeechToText";

interface UseGoogleSttOptions {
  socket?: Socket | null;
  roomId?: string | null;
  speakerUserId?: string;
  speakerName?: string;
  remoteSpeakerName?: string;
  language?: "vi" | "en";
  chunkDurationMs?: number;
  onSegment?: (seg: SpeechSegment) => void;
  onError?: (message: string) => void;
}

interface SttResultPayload {
  actionUserId?: string;
  speakerUserId?: string;
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
  return sttNowTimestamp();
}

export function useGoogleStt({
  socket,
  roomId,
  speakerUserId,
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
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const speakerNameRef = useRef(speakerName);
  speakerNameRef.current = speakerName;
  const speakerUserIdRef = useRef(speakerUserId);
  speakerUserIdRef.current = speakerUserId;
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
        speakerUserId: data.speakerUserId || data.actionUserId,
        speaker: data.speaker || remoteSpeakerNameRef.current,
        text: data.text,
        isFinal: true,
        timestamp: data.timestamp || nowTimestamp(),
        detectedLanguage: data.detectedLanguage,
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

  const sendAudioChunk = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (!blob.size || blob.size < 256 || !socketRef.current || !roomIdRef.current) {
        return;
      }

      const audioChunk = await readBlobAsBase64(blob);
      if (!audioChunk) return;

      socketRef.current.emit(
        "call:stt-audio-chunk",
        {
          roomId: roomIdRef.current,
          speakerUserId: speakerUserIdRef.current,
          speaker: speakerNameRef.current,
          audioChunk,
          mimeType: normalizeAudioMimeType(mimeType),
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
    },
    [reportError],
  );

  const stop = useCallback(() => {
    isListeningRef.current = false;
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

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
      isListeningRef.current = true;

      const startRecorderCycle = () => {
        if (!isListeningRef.current || !streamRef.current) return;

        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (!event.data.size) return;
          const chunkMime = event.data.type || mimeType || "audio/webm";
          void sendAudioChunk(event.data, chunkMime).catch((err) => {
            reportError(
              err instanceof Error
                ? err.message
                : "Không thể đọc audio chunk",
            );
          });
        };

        recorder.onerror = () => {
          reportError("MediaRecorder gặp lỗi khi thu âm");
          stop();
        };

        recorder.onstop = () => {
          if (!isListeningRef.current || mediaRecorderRef.current !== recorder) {
            return;
          }
          mediaRecorderRef.current = null;
          chunkTimerRef.current = setTimeout(startRecorderCycle, 50);
        };

        try {
          recorder.start();
          chunkTimerRef.current = setTimeout(() => {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }, chunkDurationMs);
        } catch (err) {
          reportError(
            err instanceof Error
              ? err.message
              : "Không thể bật MediaRecorder",
          );
          stop();
        }
      };

      startRecorderCycle();
      setIsListening(true);
    } catch (err) {
      stop();
      reportError(
        err instanceof Error
          ? err.message
          : "Không thể bật micro cho Google STT",
      );
    }
  }, [chunkDurationMs, isListening, isSupported, reportError, sendAudioChunk, stop]);

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
