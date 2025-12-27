// src/components/docs/BlockNoteEditor.tsx
"use client";

import { useEffect, useMemo } from "react";
import {
  useCreateBlockNote,
  createReactInlineContentSpec,
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
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
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import { Button, Tooltip } from "@heroui/react";
import {
  ScissorsIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";

const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      user: {
        default: "Unknown User",
      },
      email: {
        default: "",
      },
      avatar: {
        default: "",
      },
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
  }
);

import { SharedWithItem } from "@/service/document.service";

// ... existing imports ...

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

  const schema = useMemo(() => {
    return BlockNoteSchema.create({
      blockSpecs: defaultBlockSpecs,
      inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        mention: Mention,
      },
    });
  }, []);

  const editor = useCreateBlockNote({
    schema,
    dictionary,
    uploadFile: async (file: File) => {
      try {
        const response = await UploadService.uploadSingle(file, "docs");
        // The API returns { metadata: { url: ... } } but typed as UploadSingleResp in service
        // We cast to any to safely access metadata based on actual API response structure
        const data = response.data;

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
    resolveUsers: async (userIds: string[]) => {
      return userIds.map((id: string) => ({
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
        (editor as any)?.openSuggestionMenu("/");
      }}
    >
      <BlockNoteView
        editable={editable}
        editor={editor}
        onChange={() => onChange?.(editor)}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        className="min-h-[500px]"
        formattingToolbar={false}
      >
        <FormattingToolbarController
          formattingToolbar={(props) => (
            <FormattingToolbar {...props}>
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
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query) =>
            getDefaultReactSlashMenuItems(editor).filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            )
          }
        />
        <SuggestionMenuController
          triggerCharacter={"@"}
          getItems={async (query) =>
            (sharedWith || [])
              .filter((item: any) =>
                (item.user?.usr_fullname || "")
                  .toLowerCase()
                  .includes(query.toLowerCase())
              )
              .map((item: any) => ({
                title: item.user?.usr_fullname || "Unknown User",
                subtext: item.user?.usr_email,
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
                    {
                      type: "text",
                      text: " ",
                      styles: {},
                    },
                  ]);
                },
              }))
          }
        />
      </BlockNoteView>
    </div>
  );
}
