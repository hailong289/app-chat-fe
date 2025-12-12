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
    console.log("🔍 BlockNote fragment created:", {
      fragmentLength: frag.length,
      fragmentType: frag.constructor?.name,
      hasData: frag.length > 0,
    });
    return frag;
  }, [ydoc]);

  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      try {
        console.log("📤 Uploading file:", file.name);
        const response = await UploadService.uploadSingle(file, "docs");
        // The API returns { metadata: { url: ... } } but typed as UploadSingleResp in service
        // We cast to any to safely access metadata based on actual API response structure
        const data = response.data as any;
        const url = data.metadata?.url || data.url;

        if (!url) {
          throw new Error("No URL returned from upload API");
        }

        console.log("✅ File uploaded:", url);
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
    theme: resolvedTheme,
  });

  return (
    <BlockNoteView
      editor={editor}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="min-h-[500px]"
    />
  );
}
