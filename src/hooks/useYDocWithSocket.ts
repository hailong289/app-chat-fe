// hooks/useYDocWithSocket.ts
"use client";

import { useSocket } from "@/components/providers/SocketProvider";
import { useEffect, useMemo } from "react";
import * as Y from "yjs";
// Nếu bị lỗi bundler với `.js` thì đổi lại thành: "y-protocols/awareness"
import { Awareness } from "y-protocols/awareness.js";

interface AwarenessUpdate {
  added: number[];
  updated: number[];
  removed: number[];
}

export function useYDocWithSocket(roomId: string) {
  const { socket, status } = useSocket();

  // Mỗi roomId = 1 Y.Doc riêng, doc sống suốt vòng đời của room
  const doc = useMemo(() => new Y.Doc(), [roomId]);

  // Awareness gắn với doc (để handle cursor, selection, user info)
  const awareness = useMemo(() => new Awareness(doc), [doc]);

  /**
   * 1. Sync nội dung Y.Doc với server (update / sync)
   */
  useEffect(() => {
    if (!socket || status !== "connected") return;
    if (!roomId) return;

    // Join room + xin full state ban đầu
    socket.emit("doc:join-room", { roomId });

    // Nhận full state ban đầu (hoặc state snapshot)
    const handleSync = (updateArr: number[] | Uint8Array) => {
      const update =
        updateArr instanceof Uint8Array ? updateArr : new Uint8Array(updateArr);
      Y.applyUpdate(doc, update, "remote"); // origin = "remote" để phân biệt
    };

    // Nhận incremental update từ server
    const handleServerUpdate = (updateBuf: number[] | Uint8Array) => {
      const update =
        updateBuf instanceof Uint8Array ? updateBuf : new Uint8Array(updateBuf);
      Y.applyUpdate(doc, update, "remote");
    };

    // Local thay đổi -> bắn update lên server
    const handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return; // tránh vòng lặp

      socket.emit("doc:update", {
        roomId,
        update: Array.from(update), // serializable
      });
    };

    // Đăng ký listener
    socket.on("doc:sync", handleSync);
    socket.on("doc:update", handleServerUpdate);

    // (optional) legacy event nếu ông đang dùng "sync"/"update" chỗ khác
    socket.on("sync", handleSync);
    socket.on("update", handleServerUpdate);

    doc.on("update", handleLocalUpdate);

    // Cleanup
    return () => {
      doc.off("update", handleLocalUpdate);

      socket.off("doc:sync", handleSync);
      socket.off("doc:update", handleServerUpdate);

      socket.off("sync", handleSync);
      socket.off("update", handleServerUpdate);

      // Optional: báo rời room
      // socket.emit("doc:leave-room", { roomId });
    };
  }, [socket, status, doc, roomId]);

  /**
   * 2. Sync Awareness (cursor, selection, user meta) qua socket
   */
  useEffect(() => {
    if (!socket || status !== "connected") return;
    if (!roomId) return;

    // Khi local awareness thay đổi (mình move caret, join/leave, đổi tên,...)
    const handleAwarenessUpdate = (update: AwarenessUpdate) => {
      const states = awareness.getStates(); // Map<clientId, state>

      socket.emit("doc:awareness", {
        roomId,
        awareness: Array.from(states.entries()), // [[clientId, state], ...]
        changed: update,
      });
    };

    // Khi server gửi awareness state của room về
    const handleServerAwareness = (states: [number, any][]) => {
      // states: [[clientId, state], ...]
      awareness.doc.transact(() => {
        const localId = awareness.clientID;

        // Tuỳ chiến lược đồng bộ, ở đây clear rồi set lại cho đơn giản
        awareness.states.clear();

        for (const [clientId, state] of states) {
          // Không overwrite local state của chính mình
          if (clientId === localId) continue;
          awareness.states.set(clientId, state);
        }
      });
    };

    awareness.on("update", handleAwarenessUpdate);
    socket.on("doc:awareness", handleServerAwareness);

    // Cleanup
    return () => {
      awareness.off("update", handleAwarenessUpdate);
      socket.off("doc:awareness", handleServerAwareness);
    };
  }, [socket, status, awareness, roomId]);

  return { doc, awareness };
}
