// src/components/docs/BlockNoteEditor.tsx
"use client";

import { useEffect, useMemo } from "react";
import {
  useCreateBlockNote,
  FormattingToolbar,
  FormattingToolbarController,
  BlockTypeSelect,
  FileCaptionButton,
  FileReplaceButton,
  BasicTextStyleButton,
  TextAlignButton,
  ColorStyleButton,
  NestBlockButton,
  CreateLinkButton,
  AddCommentButton,
  useBlockNoteEditor,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { Doc } from "yjs";
import { SocketIOProvider } from "@/libs/SocketIOProvider";
import UploadService from "@/service/uploadfile.service";
import { useTranslation } from "react-i18next";
import * as locales from "@blocknote/core/locales";
import {
  DefaultThreadStoreAuth,
  YjsThreadStore,
} from "@blocknote/core/comments";
import { Button, Tooltip } from "@heroui/react";
import {
  ScissorsIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from "@heroicons/react/24/outline";

export interface BlockNoteEditorProps {
  readonly onEditorReady?: (editor: any) => void;
  readonly ydoc: Doc;
  readonly provider: SocketIOProvider | null;
  readonly userId?: string;
  readonly userName?: string;
  readonly userColor?: string;
  readonly userAvatar?: string;
}

const UndoButton = () => {
  const editor = useBlockNoteEditor();
  const handleClick = () => {
    if (editor) {
      editor.undo();
      editor.focus();
    }
  };
  return (
    <Tooltip content="Undo (Ctrl+Z)">
      <Button isIconOnly variant="light" size="sm" onPress={handleClick}>
        <ArrowUturnLeftIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

const RedoButton = () => {
  const editor = useBlockNoteEditor();
  const handleClick = () => {
    if (editor) {
      editor.redo();
      editor.focus();
    }
  };
  return (
    <Tooltip content="Redo (Ctrl+Y)">
      <Button isIconOnly variant="light" size="sm" onPress={handleClick}>
        <ArrowUturnRightIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

const CutButton = () => {
  const editor = useBlockNoteEditor();
  const handleClick = () => {
    editor?.focus();
    document.execCommand("cut");
  };
  return (
    <Tooltip content="Cut">
      <Button isIconOnly variant="light" size="sm" onPress={handleClick}>
        <ScissorsIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

const CopyButton = () => {
  const editor = useBlockNoteEditor();
  const handleClick = () => {
    editor?.focus();
    document.execCommand("copy");
  };
  return (
    <Tooltip content="Copy">
      <Button isIconOnly variant="light" size="sm" onPress={handleClick}>
        <DocumentDuplicateIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

const PasteButton = () => {
  const editor = useBlockNoteEditor();
  const handleClick = async () => {
    editor?.focus();
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          const html = await blob.text();
          editor?.pasteHTML(html);
          return;
        }
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const text = await blob.text();
          editor?.insertInlineContent(text);
          return;
        }
      }
    } catch (err) {
      try {
        const text = await navigator.clipboard.readText();
        editor?.insertInlineContent(text);
      } catch (e) {
        console.error("Failed to paste:", e);
      }
    }
  };
  return (
    <Tooltip content="Paste">
      <Button isIconOnly variant="light" size="sm" onPress={handleClick}>
        <ClipboardDocumentIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

export default function BlockNoteEditorBase({
  onEditorReady,
  ydoc,
  provider,
  userId = "anonymous",
  userName = "Anonymous",
  userColor = "#ff0000",
  userAvatar,
}: BlockNoteEditorProps) {
  const { resolvedTheme } = useTheme();
  const { i18n } = useTranslation();

  const dictionary = useMemo(() => {
    const base = i18n.language === "vi" ? locales.vi : locales.en;
    return {
      ...base,
      placeholders: {
        ...base.placeholders,
        default:
          i18n.language === "vi"
            ? "Nhập văn bản, gõ '/' hoặc bấm chuột phải để mở menu"
            : "Enter text, type '/' or right click to open menu",
      },
    };
  }, [i18n.language]);

  // Create STABLE reference to fragment - CRITICAL for BlockNote to read existing data
  const fragment = useMemo(() => {
    const frag = ydoc.getXmlFragment("document-store");
    return frag;
  }, [ydoc]);

  const threadStore = useMemo(() => {
    if (!provider) return null;
    const threadsMap = ydoc.getMap("comments");
    return new YjsThreadStore(
      userId,
      threadsMap,
      new DefaultThreadStoreAuth(userId, "editor")
    );
  }, [provider, ydoc, userId]);

  const editor = useCreateBlockNote({
    dictionary,
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
    comments: threadStore
      ? {
          threadStore,
        }
      : undefined,
    resolveUsers: async (userIds) => {
      return userIds.map((id) => ({
        id,
        username: id === userId ? userName : "User " + id.slice(0, 4),
        avatarUrl: id === userId ? userAvatar || "" : "",
      }));
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return (
    <div
      className="flex flex-col gap-2"
      role="application"
      onContextMenu={(e) => {
        e.preventDefault();
        editor?.openSuggestionMenu("/");
      }}
    >
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        className="min-h-[500px]"
        formattingToolbar={false}
      >
        <FormattingToolbarController
          formattingToolbar={(props) => (
            <FormattingToolbar {...props}>
              <UndoButton />
              <RedoButton />
              <CutButton />
              <CopyButton />
              <PasteButton />
              <BlockTypeSelect key={"blockTypeSelect"} />
              <FileCaptionButton key={"fileCaptionButton"} />
              <FileReplaceButton key={"replaceFileButton"} />
              <BasicTextStyleButton
                basicTextStyle={"bold"}
                key={"boldStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"italic"}
                key={"italicStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"underline"}
                key={"underlineStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"strike"}
                key={"strikeStyleButton"}
              />
              <TextAlignButton
                textAlignment={"left"}
                key={"textAlignLeftButton"}
              />
              <TextAlignButton
                textAlignment={"center"}
                key={"textAlignCenterButton"}
              />
              <TextAlignButton
                textAlignment={"right"}
                key={"textAlignRightButton"}
              />
              <ColorStyleButton key={"colorStyleButton"} />
              <NestBlockButton key={"nestBlockButton"} />
              <CreateLinkButton key={"createLinkButton"} />
              <AddCommentButton key={"addCommentButton"} />
            </FormattingToolbar>
          )}
        />
      </BlockNoteView>
    </div>
  );
}
