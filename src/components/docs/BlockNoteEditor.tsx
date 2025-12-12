// src/components/docs/BlockNoteEditor.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { Doc } from "yjs";
import { SocketIOProvider } from "@/libs/SocketIOProvider";
import UploadService from "@/service/uploadfile.service";

export interface BlockNoteEditorProps {
  readonly onEditorReady?: (editor: any) => void;
  readonly ydoc: Doc;
  readonly provider: SocketIOProvider | null;
  readonly userName?: string;
  readonly userColor?: string;
  readonly userAvatar?: string;
}

export default function BlockNoteEditorBase({
  onEditorReady,
  ydoc,
  provider,
  userName = "Anonymous",
  userColor = "#ff0000",
  userAvatar,
}: BlockNoteEditorProps) {
  const { resolvedTheme } = useTheme();

  // Create STABLE reference to fragment - CRITICAL for BlockNote to read existing data
  const fragment = useMemo(() => {
    const frag = ydoc.getXmlFragment("document-store");
    return frag;
  }, [ydoc]);

  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      try {
        const response = await UploadService.uploadSingle(file, "docs");
        // The API returns { metadata: { url: ... } } but typed as UploadSingleResp in service
        // We cast to any to safely access metadata based on actual API response structure
        const data = response.data as any;

        // Try to find the URL in various places
        const url = data.url || data.metadata?.url || data.data?.url;

        if (!url) {
          console.error("❌ No URL found in response:", data);
          throw new Error("No URL returned from upload API");
        }

        return url;
      } catch (error) {
        console.error("❌ Upload failed:", error);
        // Return empty string or throw to indicate failure
        throw error;
      }
    },
    collaboration: {
      provider: provider || undefined,
      fragment, // Use stable fragment reference
      user: {
        name: userName,
        color: userColor,
        // @ts-ignore - BlockNote types might not explicitly include avatar yet, but it's often supported in custom implementations or newer versions
        avatar: userAvatar,
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return (
    <BlockNoteView
      editor={editor}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="min-h-[500px]"
    />
  );
}
