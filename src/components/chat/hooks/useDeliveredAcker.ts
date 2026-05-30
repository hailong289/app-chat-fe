import { useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import { socketEvent } from "@/types/socketEvent.type";

/**
 * Forward-only, debounced emitter for `message:delivered`. Tracks the latest
 * ACKed msgId per room so duplicate/older ACKs are skipped. The server
 * watermark is also forward-only, so this is a client-side optimization.
 */
export function useDeliveredAcker(socket: Socket | null | undefined) {
  const lastAcked = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  return useCallback(
    (roomId: string, msgId: string) => {
      if (!socket || !roomId || !msgId) return;
      if (lastAcked.current[roomId] === msgId) return;
      clearTimeout(timers.current[roomId]);
      timers.current[roomId] = setTimeout(() => {
        lastAcked.current[roomId] = msgId;
        socket.emit(socketEvent.MSGDELIVERED, { roomId, msgId });
      }, 50); // 50ms micro-debounce for extremely responsive delivered updates
    },
    [socket],
  );
}
