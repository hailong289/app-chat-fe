"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSupportedMimeType } from "@/libs/mime";
import {
  isGarbageSttText,
  normalizeAudioMimeType,
  parseRemoteStreamUserId,
  readBlobAsBase64,
  sttNowTimestamp,
} from "@/libs/sttHelpers";
import type { CallMember } from "@/store/types/call.state";
import type { SpeechSegment } from "@/hooks/useSpeechToText";

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

interface UseRemoteStreamSttOptions {
  enabled: boolean;
  socket?: Socket | null;
  roomId?: string | null;
  currentUserId?: string | null;
  remoteStreams: Map<string, MediaStream>;
  members: CallMember[];
  mutedPeerIds?: Set<string>;
  language?: "vi" | "en";
  chunkDurationMs?: number;
  onSegment?: (seg: SpeechSegment) => void;
  onError?: (message: string) => void;
}

type PeerRecorder = {
  userId: string;
  streamKey: string;
  recorder: MediaRecorder | null;
  timer: ReturnType<typeof setTimeout> | null;
  isRunning: boolean;
  sourceStream: MediaStream;
};

function createPeerRecorder(params: {
  userId: string;
  streamKey: string;
  track: MediaStreamTrack;
}) {
  return {
    userId: params.userId,
    streamKey: params.streamKey,
    recorder: null,
    timer: null,
    isRunning: false,
    sourceStream: new MediaStream([params.track]),
  } satisfies PeerRecorder;
}

export function useRemoteStreamStt({
  enabled,
  socket,
  roomId,
  currentUserId,
  remoteStreams,
  members,
  mutedPeerIds,
  language = "vi",
  chunkDurationMs = 3000,
  onSegment,
  onError,
}: UseRemoteStreamSttOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => typeof window !== "undefined" && typeof MediaRecorder !== "undefined",
  );
  const [segments, setSegments] = useState<SpeechSegment[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef(socket);
  socketRef.current = socket;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const languageRef = useRef(language);
  languageRef.current = language;
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      if (!m?.id) continue;
      map.set(m.id, m.fullname || "Người tham gia");
    }
    return map;
  }, [members]);

  const reportError = useCallback((message: string) => {
    setLastError(message);
    onErrorRef.current?.(message);
  }, []);

  const peerRecordersRef = useRef<Map<string, PeerRecorder>>(new Map());

  const stopPeerRecorder = useCallback((peer: PeerRecorder) => {
    peer.isRunning = false;
    if (peer.timer) {
      clearTimeout(peer.timer);
      peer.timer = null;
    }
    const rec = peer.recorder;
    peer.recorder = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {}
    }
  }, []);

  const stopAll = useCallback(() => {
    const peers = peerRecordersRef.current;
    for (const peer of peers.values()) {
      stopPeerRecorder(peer);
    }
    peers.clear();
    setIsListening(false);
  }, [stopPeerRecorder]);

  const sendAudioChunk = useCallback(
    async (peer: PeerRecorder, blob: Blob, mimeType: string) => {
      if (!blob.size || blob.size < 256) return;
      if (!socketRef.current || !roomIdRef.current) return;

      const audioChunk = await readBlobAsBase64(blob);
      if (!audioChunk) return;

      socketRef.current.emit(
        "call:stt-audio-chunk",
        {
          roomId: roomIdRef.current,
          speakerUserId: peer.userId,
          speaker: nameByUserId.get(peer.userId) || "Người tham gia",
          audioChunk,
          mimeType: normalizeAudioMimeType(mimeType),
          language: languageRef.current,
        },
        (ack?: SttAck) => {
          if (ack && ack.ok === false) {
            reportError(ack.error || "Không thể nhận dạng giọng nói lúc này");
          }
        },
      );
    },
    [nameByUserId, reportError],
  );

  const startPeerRecorder = useCallback(
    (peer: PeerRecorder) => {
      if (!isSupported || !enabledRef.current) return;
      if (!socketRef.current || !roomIdRef.current) return;
      if (peer.isRunning) return;

      const mimeType = getSupportedMimeType();
      peer.isRunning = true;

      const startCycle = () => {
        if (!peer.isRunning || !enabledRef.current) return;

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(peer.sourceStream, { mimeType });
        } catch (e) {
          peer.isRunning = false;
          reportError(e instanceof Error ? e.message : "Không thể bật MediaRecorder");
          return;
        }

        peer.recorder = recorder;

        recorder.ondataavailable = (event) => {
          if (!event.data.size) return;
          const chunkMime = event.data.type || mimeType || "audio/webm";
          void sendAudioChunk(peer, event.data, chunkMime).catch((err) => {
            reportError(
              err instanceof Error ? err.message : "Không thể đọc audio chunk",
            );
          });
        };

        recorder.onerror = () => {
          reportError("MediaRecorder gặp lỗi khi thu âm");
          stopPeerRecorder(peer);
        };

        recorder.onstop = () => {
          if (!peer.isRunning || peer.recorder !== recorder) return;
          peer.recorder = null;
          peer.timer = setTimeout(startCycle, 50);
        };

        try {
          recorder.start();
          peer.timer = setTimeout(() => {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }, chunkDurationMs);
        } catch (e) {
          reportError(e instanceof Error ? e.message : "Không thể bật MediaRecorder");
          stopPeerRecorder(peer);
        }
      };

      startCycle();
    },
    [chunkDurationMs, isSupported, reportError, sendAudioChunk, stopPeerRecorder],
  );

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleSttResult = (data: SttResultPayload) => {
      if (data.roomId && data.roomId !== roomIdRef.current) return;
      if (isGarbageSttText(data.text)) return;

      const seg: SpeechSegment = {
        id: Date.now().toString() + Math.random(),
        speakerUserId: data.speakerUserId || data.actionUserId,
        speaker: data.speaker || "Người tham gia",
        text: data.text,
        isFinal: true,
        timestamp: data.timestamp || sttNowTimestamp(),
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

  useEffect(() => {
    if (!enabled || !isSupported || !socket || !roomId) {
      stopAll();
      return;
    }

    setLastError(null);
    setIsListening(true);

    const peers = peerRecordersRef.current;
    const nextUserIds = new Set<string>();

    remoteStreams.forEach((stream, streamKey) => {
      const userId = parseRemoteStreamUserId(streamKey, roomId);
      if (!userId) return;
      if (currentUserIdRef.current && userId === currentUserIdRef.current) return;
      if (mutedPeerIds?.has(userId)) return;

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;
      if (audioTrack.readyState === "ended") return;
      if (audioTrack.muted) return;

      nextUserIds.add(userId);

      const existing = peers.get(userId);
      if (existing && existing.streamKey === streamKey) {
        const prevTrack = existing.sourceStream.getAudioTracks()[0];
        if (prevTrack?.id !== audioTrack.id) {
          stopPeerRecorder(existing);
          peers.set(userId, createPeerRecorder({ userId, streamKey, track: audioTrack }));
          startPeerRecorder(peers.get(userId)!);
        } else {
          startPeerRecorder(existing);
        }
        return;
      }

      if (existing) {
        stopPeerRecorder(existing);
      }

      const peer = createPeerRecorder({ userId, streamKey, track: audioTrack });
      peers.set(userId, peer);
      startPeerRecorder(peer);
    });

    for (const [userId, peer] of peers.entries()) {
      if (!nextUserIds.has(userId)) {
        stopPeerRecorder(peer);
        peers.delete(userId);
      }
    }
  }, [
    enabled,
    isSupported,
    mutedPeerIds,
    remoteStreams,
    roomId,
    socket,
    startPeerRecorder,
    stopAll,
    stopPeerRecorder,
  ]);

  useEffect(() => stopAll, [stopAll]);

  const clear = useCallback(() => {
    setSegments([]);
    setLastError(null);
  }, []);

  return {
    isListening,
    isSupported,
    segments,
    lastError,
    clear,
    stop: stopAll,
  };
}

