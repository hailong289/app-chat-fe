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
// Comment-related styles (.bn-thread, .bn-thread-mark, .bn-comment-editor,
// .bn-threads-sidebar) live ONLY in @blocknote/react/style.css — not in
// mantine/style.css. Without this import, saving a comment succeeds but
// the highlighted anchor and floating thread UI render unstyled, making
// it look like nothing happened after clicking Save.
import "@blocknote/react/style.css";

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

  // Comments thread store (Yjs-backed). Don't gate on `provider` — we'd
  // miss the editor-creation window when the SocketIO provider hasn't
  // connected yet, leaving `extensions: []` and the comment button hidden
  // forever (AddCommentButton returns null when "comments" extension is
  // missing, see @blocknote/react/.../AddCommentButton.tsx). The Yjs map
  // works locally without sync; provider only forwards updates to peers
  // once it does connect.
  const threadStore = useMemo(() => {
    const threadsMap = ydoc.getMap("comments");
    return new YjsThreadStore(
      userId,
      threadsMap,
      new DefaultThreadStoreAuth(userId, "editor"),
    );
  }, [ydoc, userId]);

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

  // Pre-populate current user into the comment UserStore cache.
  //
  // BlockNote's <Comments /> component (Comments.tsx:34-37) hard-throws if
  // `users.get(thread.resolvedBy)` returns undefined when rendering a
  // resolved thread. The store loads users via the async `resolveUsers`
  // callback, but the first render happens BEFORE the promise resolves —
  // for any thread the current user has resolved (very common), the throw
  // crashes the editor before our resolveUsers callback ever runs.
  //
  // Writing directly into the private `userCache` Map and emitting the
  // store's "update" event sidesteps the race for the current user; threads
  // resolved by other users still fall back to the async path, and their
  // first render benefits from a non-empty cache too (the warning becomes
  // a transient miss instead of an instant crash).
  useEffect(() => {
    if (!editor) return;
    const commentsExt = editor.getExtension?.("comments") as any;
    const userStore = commentsExt?.userStore;
    if (!userStore?.userCache) return;
    if (userStore.userCache.has(userId)) return;
    userStore.userCache.set(userId, {
      id: userId,
      username: userName || "Anonymous",
      avatarUrl: userAvatar || "",
    });
    userStore.emit?.("update", userStore.userCache);
  }, [editor, userId, userName, userAvatar]);

  // When BlockNoteView has children, it disables ALL default UIs.
  // We explicitly disable each default and re-add via controllers so we can
  // also include custom suggestion menus (@) and custom toolbar buttons.
  return (
    <div
      className="flex flex-col gap-2 h-full flex-1"
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
        className="flex-1 min-h-full"
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

        {/* Custom formatting toolbar with Cut/Copy/Paste prepended.
            getFormattingToolbarItems() in v0.48 already auto-includes the
            "Add comment" button when CommentsExtension is configured, so
            we don't need to add it manually. */}
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

        {/* New-comment popup + inline thread popover are auto-rendered by
            BlockNoteDefaultUI when CommentsExtension is configured (props
            `comments` defaults to true). We don't add explicit Controllers
            here on purpose. The threads list is ALSO surfaced Word-style in
            <ThreadsSidebarPanel> (see docs/[id]/page.tsx) — that's a
            standalone view of the same Yjs-backed thread store, not a
            duplicate UI. */}

        {/* Other default UIs */}
        <FilePanelController />
        <SideMenuController />
        <TableHandlesController />
      </BlockNoteView>
    </div>
  );
}
