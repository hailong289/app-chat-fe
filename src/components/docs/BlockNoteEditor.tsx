// src/components/docs/BlockNoteEditor.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import * as Y from "yjs";
import { SocketIOProvider } from "@/libs/SocketIOProvider";
import UploadService from "@/service/uploadfile.service";

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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait for hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Create STABLE reference to fragment - CRITICAL for BlockNote to read existing data
  const fragment = useMemo(() => {
    const frag = ydoc.getXmlFragment("document-store");

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
    uploadFile: async (file: File) => {
      try {
        console.log("📤 Uploading file:", file.name);
        const response = await UploadService.uploadSingle(file, "docs");
        const data = response.data as any;
        const url = data?.metadata?.url || data?.url;

        if (url) {
          console.log("✅ File uploaded:", url);
          return url;
        } else {
          console.error("❌ Upload response missing URL:", data);
          return "";
        }
      } catch (error) {
        console.error("❌ Upload failed:", error);
        return "";
      }
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // DEBUG: Listen to Y.Doc updates to verify BlockNote is writing to it
  useEffect(() => {
    const updateHandler = (update: Uint8Array, origin: any) => {
      // Debug logging removed for production
    };

    ydoc.on("update", updateHandler);

    return () => {
      ydoc.off("update", updateHandler);
    };
  }, [ydoc, provider]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="blocknote-wrapper w-full h-full">
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        className="min-h-[500px]"
      />
    </div>
  );
}
