"use client";

import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import * as Y from "yjs";
import { SocketIOProvider } from "@/libs/SocketIOProvider";
import { Socket } from "socket.io-client";

interface BlockNoteEditorProps {
  onEditorReady?: (editor: any) => void;
  docId: string;
  socket: Socket | null;
  userName?: string;
  userColor?: string;
  initialYjsSnapshot?: number[] | Uint8Array; // Initial document state from server
}

export default function BlockNoteEditor({
  onEditorReady,
  docId,
  socket,
  userName = "Anonymous",
  userColor = "#ff0000",
  initialYjsSnapshot,
}: BlockNoteEditorProps) {
  const [ydoc] = useState(() => {
    const doc = new Y.Doc();

    // Apply initial snapshot if available
    if (initialYjsSnapshot) {
      const snapshot = Array.isArray(initialYjsSnapshot)
        ? new Uint8Array(initialYjsSnapshot)
        : initialYjsSnapshot;
      Y.applyUpdate(doc, snapshot);
    }

    return doc;
  });

  const [provider] = useState(() =>
    socket ? new SocketIOProvider(docId, ydoc, socket) : null
  );

  const editor = useCreateBlockNote({
    collaboration: provider
      ? {
          provider,
          fragment: ydoc.getXmlFragment("document-store"),
          user: {
            name: userName,
            color: userColor,
          },
        }
      : undefined,
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    return () => {
      provider?.destroy();
    };
  }, [provider]);

  return <BlockNoteView editor={editor} />;
}
