"use client";
import { BlockNoteEditor } from "@blocknote/core";
import { useEffect, useCallback } from "react";
import { useSocket } from "@/components/providers/SocketProvider";

interface BlockNoteSyncOptions {
  docId: string;
  editor: BlockNoteEditor | null;
  onLoadSnapshot?: (snapshot: any[]) => void;
}

/**
 * Hook to sync BlockNote document with server via WebSocket
 * - Join room khi connect
 * - Load snapshot từ server
 * - Sync local changes lên server
 * - Apply server updates về client
 */
export function useBlockNoteSync({
  docId,
  editor,
  onLoadSnapshot,
}: BlockNoteSyncOptions) {
  const { socket, status } = useSocket();

  // Join room và request snapshot
  useEffect(() => {
    if (!socket || status !== "connected" || !docId) return;

    socket.emit("doc:join", { docId });

    // Request snapshot từ server
    socket.emit("doc:request-snapshot", { docId });

    return () => {
      socket.emit("doc:leave", { docId });
    };
  }, [socket, status, docId]);

  // Nhận snapshot từ server
  useEffect(() => {
    if (!socket) return;

    const handleSnapshot = (data: { docId: string; snapshot: any[] }) => {
      if (data.docId !== docId) return;

      onLoadSnapshot?.(data.snapshot);

      if (editor && data.snapshot.length > 0) {
        editor.replaceBlocks(editor.document, data.snapshot);
      }
    };

    socket.on("doc:snapshot", handleSnapshot);

    return () => {
      socket.off("doc:snapshot", handleSnapshot);
    };
  }, [socket, docId, editor, onLoadSnapshot]);

  // Nhận updates từ server (từ users khác)
  useEffect(() => {
    if (!socket || !editor) return;

    const handleUpdate = (data: {
      docId: string;
      blocks: any[];
      userId: string;
    }) => {
      if (data.docId !== docId) return;

      // Merge updates từ server
      if (Array.isArray(data.blocks)) {
        // Option 1: Replace toàn bộ document
        editor.replaceBlocks(editor.document, data.blocks);

        // Option 2 (advanced): Merge changes thông minh
        // const currentDoc = editor.document;
        // const merged = mergeDocuments(currentDoc, data.blocks);
        // editor.replaceBlocks(currentDoc, merged);
      }
    };

    socket.on("doc:update", handleUpdate);

    return () => {
      socket.off("doc:update", handleUpdate);
    };
  }, [socket, editor, docId]);

  // Gửi local changes lên server
  const sendUpdate = useCallback(
    (blocks: any[]) => {
      if (!socket || !docId) return;

      socket.emit("doc:update-client", {
        docId,
        blocks,
      });
    },
    [socket, docId]
  );

  return { sendUpdate };
}
