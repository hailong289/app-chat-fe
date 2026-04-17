// src/components/docs/BlockNoteEditor.tsx
"use client";

import { useEffect, useMemo } from "react";
import {
  useCreateBlockNote,
  createReactInlineContentSpec,
  SuggestionMenuController,
  FormattingToolbar,
  FormattingToolbarController,
  FilePanelController,
  SideMenuController,
  TableHandlesController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useBlockNoteEditor,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import {
  BlockNoteSchema,
  defaultInlineContentSpecs,
  filterSuggestionItems,
} from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import {
  CommentsExtension,
  DefaultThreadStoreAuth,
  YjsThreadStore,
} from "@blocknote/core/comments";
import * as locales from "@blocknote/core/locales";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Doc } from "yjs";
import { Button, Tooltip } from "@heroui/react";
import {
  ScissorsIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { SocketIOProvider } from "@/libs/SocketIOProvider";
import UploadService from "@/service/uploadfile.service";
import { SharedWithItem } from "@/service/document.service";

// ─── Custom inline content: @mention ───────────────────────────────────────────
const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      user: { default: "Unknown User" },
      email: { default: "" },
      avatar: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { user, email, avatar } = props.inlineContent.props;
      return (
        <Tooltip
          content={
            <div className="flex items-center gap-3 px-1 py-2">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                <img
                  src={
                    avatar ||
                    `https://ui-avatars.com/api/?name=${user}&background=random`
                  }
                  alt={user}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-small">{user}</span>
                <span className="text-tiny text-gray-500">{email}</span>
              </div>
            </div>
          }
        >
          <span className="text-blue-600 font-bold cursor-pointer bg-blue-50 px-1 rounded mx-0.5">
            @{user}
          </span>
        </Tooltip>
      );
    },
  },
);

// ─── Custom toolbar buttons (Cut/Copy/Paste) ──────────────────────────────────
const CutButton = () => {
  const editor = useBlockNoteEditor();
  return (
    <Tooltip content="Cut">
      <Button
        isIconOnly
        variant="light"
        size="sm"
        onPress={() => {
          editor?.focus();
          document.execCommand("cut");
        }}
      >
        <ScissorsIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

const CopyButton = () => {
  const editor = useBlockNoteEditor();
  return (
    <Tooltip content="Copy">
      <Button
        isIconOnly
        variant="light"
        size="sm"
        onPress={() => {
          editor?.focus();
          document.execCommand("copy");
        }}
      >
        <DocumentDuplicateIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

const PasteButton = () => {
  const editor = useBlockNoteEditor();
  return (
    <Tooltip content="Paste">
      <Button
        isIconOnly
        variant="light"
        size="sm"
        onPress={async () => {
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
              }
            }
          } catch (e) {
            console.error("Failed to paste:", e);
          }
        }}
      >
        <ClipboardDocumentIcon className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
};

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface BlockNoteEditorProps {
  readonly onEditorReady?: (editor: any) => void;
  readonly onChange?: (editor: any) => void;
  readonly ydoc: Doc;
  readonly provider: SocketIOProvider | null;
  readonly userId?: string;
  readonly userName?: string;
  readonly userColor?: string;
  readonly userAvatar?: string;
  readonly sharedWith?: SharedWithItem[];
  readonly editable?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function BlockNoteEditorBase({
  onEditorReady,
  onChange,
  ydoc,
  provider,
  userId = "anonymous",
  userName = "Anonymous",
  userColor = "#ff0000",
  userAvatar,
  sharedWith = [],
  editable = true,
}: BlockNoteEditorProps) {
  const { resolvedTheme } = useTheme();
  const { i18n } = useTranslation();

  // i18n dictionary (vi/en)
  const dictionary = useMemo(() => {
    const base = i18n.language === "vi" ? locales.vi : locales.en;
    return {
      ...base,
      placeholders: {
        ...base.placeholders,
        default:
          i18n.language === "vi"
            ? "Nhập văn bản hoặc gõ '/' để mở menu"
            : "Enter text or type '/' to open menu",
      },
    };
  }, [i18n.language]);

  // Stable Yjs fragment reference — required for BlockNote to read existing data
  const fragment = useMemo(
    () => ydoc.getXmlFragment("document-store"),
    [ydoc],
  );

  // Comments thread store (Yjs-backed)
  const threadStore = useMemo(() => {
    if (!provider) return null;
    const threadsMap = ydoc.getMap("comments");
    return new YjsThreadStore(
      userId,
      threadsMap,
      new DefaultThreadStoreAuth(userId, "editor"),
    );
  }, [provider, ydoc, userId]);

  // Schema with custom @mention inline content + all default block specs
  const schema = useMemo(
    () =>
      BlockNoteSchema.create({
        inlineContentSpecs: {
          ...defaultInlineContentSpecs,
          mention: Mention,
        },
      }),
    [],
  );

  // resolveUsers — used by CommentsExtension to render avatars/names
  const resolveUsers = useMemo(
    () => async (userIds: string[]) =>
      userIds.map((id) => ({
        id,
        username: id === userId ? userName : "User " + id.slice(0, 4),
        avatarUrl: id === userId ? userAvatar || "" : "",
      })),
    [userId, userName, userAvatar],
  );

  // Editor instance — follows official Next.js guide pattern.
  // v0.48: comments are configured via CommentsExtension (no longer a top-level option).
  const editor = useCreateBlockNote({
    schema,
    dictionary,
    uploadFile: async (file: File) => {
      const response = await UploadService.uploadSingle(file, "docs");
      const data = response.data;
      const url = data.url || data.metadata?.url || data.data?.url;
      if (!url) {
        throw new Error("Upload API returned no URL");
      }
      return url;
    },
    collaboration: {
      provider: provider || undefined,
      fragment,
      user: {
        name: userName,
        color: userColor,
        // @ts-ignore - avatar may not be in BlockNote types but is supported
        avatar: userAvatar,
      },
    },
    extensions: threadStore
      ? [CommentsExtension({ threadStore, resolveUsers })]
      : [],
  });

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // When BlockNoteView has children, it disables ALL default UIs.
  // We explicitly disable each default and re-add via controllers so we can
  // also include custom suggestion menus (@) and custom toolbar buttons.
  return (
    <div
      className="flex flex-col gap-2"
      role="application"
      onContextMenu={(e) => {
        e.preventDefault();
        // BlockNote v0.45+: openSuggestionMenu lives on the SuggestionMenu extension
        editor?.getExtension(SuggestionMenu)?.openSuggestionMenu("/");
      }}
    >
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={() => onChange?.(editor)}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        className="min-h-[500px]"
        slashMenu={false}
        formattingToolbar={false}
        filePanel={false}
        sideMenu={false}
        tableHandles={false}
      >
        {/* Default '/' slash menu — re-add via controller */}
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query)
          }
        />

        {/* Custom '@' mention menu */}
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (query) =>
            filterSuggestionItems(
              (sharedWith || []).map((item: any) => ({
                title: item.user?.usr_fullname || "Unknown User",
                subtext: item.user?.usr_email,
                onItemClick: () => {
                  editor.insertInlineContent([
                    {
                      type: "mention",
                      props: {
                        user: item.user?.usr_fullname || "Unknown User",
                        email: item.user?.usr_email,
                        avatar: item.user?.usr_avatar,
                      },
                    },
                    { type: "text", text: " ", styles: {} },
                  ]);
                },
                icon: (
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200">
                    <img
                      src={
                        item.user?.usr_avatar ||
                        `https://ui-avatars.com/api/?name=${
                          item.user?.usr_fullname || "User"
                        }&background=random`
                      }
                      alt={item.user?.usr_fullname}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ),
              })),
              query,
            )
          }
        />

        {/* Custom formatting toolbar with Cut/Copy/Paste prepended */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <CutButton key="cut" />
              <CopyButton key="copy" />
              <PasteButton key="paste" />
              {getFormattingToolbarItems()}
            </FormattingToolbar>
          )}
        />

        {/* Other default UIs */}
        <FilePanelController />
        <SideMenuController />
        <TableHandlesController />
      </BlockNoteView>
    </div>
  );
}
