// src/components/docs/BlockNoteEditor.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import * as Y from "yjs";
import { SocketIOProvider } from "@/libs/SocketIOProvider";

export interface BlockNoteEditorProps {
  readonly onEditorReady?: (editor: any) => void;
  readonly ydoc: Y.Doc;
  readonly provider: SocketIOProvider | null;
  readonly userName?: string;
  readonly userColor?: string;
}

export default function BlockNoteEditorBase({
  onEditorReady,
  ydoc,
  provider,
  userName = "Anonymous",
  userColor = "#ff0000",
}: BlockNoteEditorProps) {
  // Create STABLE reference to fragment - CRITICAL for BlockNote to read existing data
  const fragment = useMemo(() => {
    const frag = ydoc.getXmlFragment("document-store");
    console.log("🔍 BlockNote fragment created:", {
      fragmentLength: frag.length,
      fragmentType: frag.constructor.name,
      hasData: frag.length > 0,
    });
    return frag;
  }, [ydoc]);

  const editor = useCreateBlockNote({
    collaboration: provider
      ? {
          provider,
          fragment, // Use stable fragment reference
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

  // DEBUG: Listen to Y.Doc updates to verify BlockNote is writing to it
  useEffect(() => {
    const updateHandler = (update: Uint8Array, origin: any) => {
      console.log("🔔 Y.Doc UPDATE in BlockNoteEditor:", {
        updateSize: update.length,
        origin: origin?.constructor?.name || typeof origin,
        hasProvider: !!provider,
        providerType: provider?.constructor?.name,
      });
    };

    ydoc.on("update", updateHandler);

    return () => {
      ydoc.off("update", updateHandler);
    };
  }, [ydoc, provider]);

  console.log("🎨 BlockNote editor rendering:", {
    hasEditor: !!editor,
    hasProvider: !!provider,
    fragmentLength: fragment.length,
  });

  return <BlockNoteView editor={editor} />;
}
