"use client";

import {
  cleanupAll,
  defaultConfig,
  handleDragLeaveFactory,
  handleDragOver,
  handleDropFactory,
  handleFilePickFactory,
  handlePasteFactory,
  FileAcceptConfig,
} from "@/libs/file-handlers";
import {
  FaceSmileIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  GifIcon,
  XMarkIcon,
  XCircleIcon,
  TrashIcon,
  DocumentIcon,
  BookOpenIcon,
} from "@heroicons/react/16/solid";
import {
  Button,
  Switch,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Chip,
  Tooltip,
} from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FilePreviewGridModal from "../file/FilePreviewGridModal";
import useMessageStore from "@/store/useMessageStore";
import { FilePreview } from "@/store/types/message.state";
import useAuthStore from "@/store/useAuthStore";
import { useSocket } from "../../providers/SocketProvider";
import EmojiPicker, { EmojiClickData, Categories } from "emoji-picker-react";
import { ObjectId } from "bson";
import { toast } from "@/store/useToastStore";
import { useVoiceRecorder } from "@/libs/useVoiceRecorder";
import { PermissionService } from "@/service/permisson.service";
import WaveformCanvas from "../message/WaveformCanvas";
import {
  PauseCircleIcon,
  PlayIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";
import useRoomStore from "@/store/useRoomStore";
import TypingIndicator from "./TypingIndicator";
import { useTranslation } from "react-i18next";
import { DocumentPickerModal } from "../modals/DocumentPickerModal";
import { Document } from "@/service/document.service";
import FileGalleryModal from "../../modals/FileGalleryModal";

const maxFiles = 20;

type ChatInputBarProps = Readonly<{
  chatId: string;
  noAction: boolean;
  isBlocked?: boolean;
  blockByMine?: boolean;
  setToggleInput: (val: boolean) => void;
  toggleInput: boolean;
  setScrollto: (val: string | null) => void;
}>;

export default function ChatInputBar({
  chatId,
  noAction,
  isBlocked = false,
  blockByMine = false,
  setToggleInput,
  toggleInput,
  setScrollto,
}: ChatInputBarProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [compressImages, setCompressImages] = useState(true);
  const [micro, setMicro] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [showFileGallery, setShowFileGallery] = useState(false);

  const emojiTab = useMemo(
    () => [
      { name: t("chat.emoji.recent"), category: Categories.SUGGESTED },
      { name: t("chat.emoji.smileys"), category: Categories.SMILEYS_PEOPLE },
      { name: t("chat.emoji.animals"), category: Categories.ANIMALS_NATURE },
      { name: t("chat.emoji.food"), category: Categories.FOOD_DRINK },
      { name: t("chat.emoji.activities"), category: Categories.ACTIVITIES },
      { name: t("chat.emoji.travel"), category: Categories.TRAVEL_PLACES },
      { name: t("chat.emoji.objects"), category: Categories.OBJECTS },
      { name: t("chat.emoji.symbols"), category: Categories.SYMBOLS },
      { name: t("chat.emoji.flags"), category: Categories.FLAGS },
    ],
    [t]
  );

  const fileMediaInputRef = useRef<HTMLInputElement>(null);
  const fileDocInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const attRef = useRef<FilePreview[]>([]);
  attRef.current = attachments;

  // ====== STORE SELECTORS ======
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const setRoomAttachments = useMessageStore((state) => state.setAttachments);
  const setInput = useMessageStore((state) => state.setInput);
  const setReplyMessage = useMessageStore((state) => state.setReplyMessage);

  const replyingTo = useMessageStore(
    (state) => state.messagesRoom[chatId]?.reply
  );

  const auth = useAuthStore((state) => state.user);

  const room = useRoomStore((state) => state.room);
  const roomTypingUsers = useRoomStore((state) => state.roomTypingUsers);
  const roomTypingSocket = useRoomStore((state) => state.roomTypingSocket);

  const { socket } = useSocket("/chat");

  const isGuest = useMemo(() => {
    return room?.members?.some(
      (member) => member.id === auth?.id && member.role === "guest"
    );
  }, [room, auth]);

  // ====== FILE CONFIG ======,
  const config: FileAcceptConfig = useMemo(
    () => ({
      ...defaultConfig,
      accept: ["*/*"],
      maxFiles,
      compressImages,
    }),
    [compressImages]
  );

  const handleMaxFilesExceeded = useCallback(
    (current: number, max: number) => {
      toast.error(t("chat.input.maxFilesExceeded", { max, current }));
    },
    [t]
  );

  // ====== SYNC LOCAL STATE VỚI STORE KHI ĐỔI CHAT ======
  useEffect(() => {
    cleanupAll(attRef);

    const snapshot = useMessageStore.getState().messagesRoom[chatId];

    setAttachments(snapshot?.attachments || []);
    setIsDragging(false);
    setMessage(snapshot?.input || "");
  }, [chatId]);

  // Đẩy local state ngược lại store (1 chiều)
  useEffect(() => {
    setRoomAttachments(chatId, attachments);
    setInput(chatId, message);
  }, [attachments, message, chatId, setRoomAttachments, setInput]);

  // ====== WRAPPER SET ATTACHMENTS ASYNC ======
  const setAttachmentsAsync = useCallback(
    (updater: (prev: FilePreview[]) => Promise<FilePreview[]>) => {
      setAttachments((prev) => {
        updater(prev).then((next) => {
          setAttachments(next);
        });
        return prev;
      });
    },
    []
  );

  const onPaste = useMemo(
    () =>
      handlePasteFactory(
        setAttachmentsAsync as any,
        config,
        handleMaxFilesExceeded
      ),
    [config, handleMaxFilesExceeded, setAttachmentsAsync]
  );

  const onPick = useMemo(
    () =>
      handleFilePickFactory(
        setAttachmentsAsync as any,
        config,
        handleMaxFilesExceeded
      ),
    [config, handleMaxFilesExceeded, setAttachmentsAsync]
  );

  const onDrop = useMemo(
    () =>
      handleDropFactory(
        setAttachmentsAsync as any,
        config,
        setIsDragging,
        handleMaxFilesExceeded
      ),
    [config, handleMaxFilesExceeded, setAttachmentsAsync]
  );

  const onDragLeave = useMemo(() => handleDragLeaveFactory(setIsDragging), []);

  // ====== EMOJI & GIF ======
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [gifs, setGifs] = useState<any[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);

  const TENOR_API_KEY = process.env.NEXT_PUBLIC_REACT_APP_TENOR_API_KEY || "";
  const TENOR_CLIENT_KEY = "chat-app";

  const searchGifs = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        query = "trending";
      }

      setIsLoadingGifs(true);
      try {
        const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(
          query
        )}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20&locale=vi_VN`;
        const response = await fetch(url);
        const data = await response.json();
        setGifs(data.results || []);
      } catch (error) {
        console.error("Error fetching GIFs:", error);
        setGifs([]);
      } finally {
        setIsLoadingGifs(false);
      }
    },
    [TENOR_API_KEY]
  );

  useEffect(() => {
    if (isGifPickerOpen && gifs.length === 0) {
      searchGifs("trending");
    }
  }, [isGifPickerOpen, gifs.length, searchGifs]);

  useEffect(() => {
    if (!isGifPickerOpen) return;

    const timer = setTimeout(() => {
      if (gifSearchQuery) {
        searchGifs(gifSearchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [gifSearchQuery, isGifPickerOpen, searchGifs]);

  const onEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      const emoji = emojiData.emoji;
      const input = inputRef.current;

      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newMessage = message.slice(0, start) + emoji + message.slice(end);
        setMessage(newMessage);

        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
      } else {
        setMessage((prev) => prev + emoji);
      }
    },
    [message]
  );

  const onGifClick = useCallback(
    async (gifUrl: string, gifTitle: string = "animation") => {
      try {
        const response = await fetch(gifUrl);
        const blob = await response.blob();

        const fileName = `${gifTitle.replaceAll(
          /[^a-z0-9]/gi,
          "_"
        )}_${Date.now()}.gif`;
        const file = new File([blob], fileName, { type: "image/gif" });
        const previewUrl = URL.createObjectURL(blob);
        const id = new ObjectId().toHexString();

        const filePreview: FilePreview = {
          _id: id,
          file,
          url: previewUrl,
          name: fileName,
          size: blob.size,
          mimeType: "image/gif",
          kind: "photo",
          status: "pending",
          uploadProgress: 0,
        };

        await sendMessage({
          roomId: chatId,
          content: message,
          attachments: [filePreview],
          type: "gif",
          socket,
          userId: auth?.id,
          userFullname: auth?.fullname,
          userAvatar: auth?.avatar,
        });

        setToggleInput(!toggleInput);
      } catch (error) {
        console.error("❌ Error downloading GIF:", error);
        setMessage((prev) => prev + (prev ? " " : "") + gifUrl);
      }
    },
    [auth, chatId, message, sendMessage, socket, setToggleInput, toggleInput]
  );

  // ====== SEND TEXT / FILE MESSAGE ======
  const onSend = useCallback(() => {
    if (!message.trim() && attachments.length === 0) return;

    const replyToId = replyingTo?.id;

    if (attachments.length > 0) {
      const firstAttachment = attachments[0];
      let messageType: "image" | "file" | "video" = "file";

      if (firstAttachment.mimeType?.startsWith("image/")) {
        messageType = "image";
      } else if (firstAttachment.mimeType?.startsWith("video/")) {
        messageType = "video";
      }

      sendMessage({
        roomId: chatId,
        content: "",
        attachments,
        type: messageType,
        replyTo: replyToId,
        socket,
        userId: auth?.id,
        userFullname: auth?.fullname,
        userAvatar: auth?.avatar,
      });

      setAttachments([]);
    }

    if (message.trim()) {
      sendMessage({
        roomId: chatId,
        content: message,
        attachments: [],
        type: "text",
        replyTo: replyToId,
        socket,
        userId: auth?.id,
        userFullname: auth?.fullname,
        userAvatar: auth?.avatar,
      });

      setMessage("");
    }

    setToggleInput(!toggleInput);
    if (replyToId) {
      setReplyMessage(chatId, null);
    }
  }, [
    attachments,
    auth,
    chatId,
    message,
    replyingTo,
    sendMessage,
    setReplyMessage,
    socket,
    setToggleInput,
    toggleInput,
   
  ]);

  // ====== VOICE CHAT ======
  const {
    state,
    durationMs,
    preview,
    start,
    pause,
    resume,
    stop,
    attachCanvas,
    cancel,
  } = useVoiceRecorder();

  const handleVoiceChatToggle = useCallback(async () => {
    try {
      await PermissionService.requestMicrophoneAccess();
    } catch (error) {
      console.error("PermissionService.requestMicrophoneAccess failed:", error);
      toast.error(t("chat.voice.error.access"));
      return;
    }

    if (!micro) {
      setMicro(true);
      setTimeout(() => {
        if (state === "idle") start();
      }, 100);
    } else {
      cancel();
      setMicro(false);
    }
  }, [cancel, micro, start, state]);

  const previewRef = useRef(preview);
  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  async function waitForPreview(
    getPreview: () => any,
    timeoutMs = 1200
  ): Promise<any | null> {
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const p = getPreview();
        if (p) return resolve(p);
        if (performance.now() - t0 > timeoutMs) return resolve(null);
        setTimeout(tick, 20);
      };
      tick();
    });
  }

  const sendingRef = useRef(false);
  const onVoiceSend = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      if (state === "recording" || state === "paused") {
        stop();
      }

      const fp = preview ?? (await waitForPreview(() => previewRef.current));
      if (!fp) {
        sendingRef.current = false;
        return;
      }

      await sendMessage({
        roomId: chatId,
        content: "",
        attachments: [fp],
        type: "audio",
        socket,
        userId: auth?.id,
        userFullname: auth?.fullname,
        userAvatar: auth?.avatar,
      });

      cancel();
      setMicro(false);
    } finally {
      sendingRef.current = false;
      setToggleInput(!toggleInput);
    }
  }, [
    auth,
    cancel,
    chatId,
    preview,
    sendMessage,
    setToggleInput,
    socket,
    state,
    stop,
    toggleInput,
  ]);

  // ====== RENDER ======
  const handleSelectDocument = useCallback(
    (doc: Document) => {
      if (!socket || !auth) return;

      sendMessage({
        roomId: chatId,
        content: doc.title,
        attachments: [],
        type: "document",
        socket,
        userId: auth._id,
        userFullname: auth.fullname,
        userAvatar: auth.avatar,
        documentId: doc._id,
      });

      setShowDocPicker(false);
    },
    [chatId, socket, auth, sendMessage]
  );

  // ====== BLOCKED / NO ACTION ======
  if (noAction || isBlocked || !room?.id || isGuest) {
    return (
      <section
        aria-label="Chat input area"
        className="
          absolute bottom-0 left-0 w-full px-4 py-4 mt-5 
          backdrop-blur-2xl bg-white/30 border-t border-white/30          
        "
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%)",
        }}
      >
        {!blockByMine && !isGuest && (
          <p className="text-gray-500 dark:text-gray-300">
            {t("chat.input.blocked.noPermission")}
          </p>
        )}
        {blockByMine && (
          <p className="text-gray-500 dark:text-gray-300">
            {t("chat.input.blocked.blockedByMe")}
          </p>
        )}
        {isGuest && (
          <p className="text-gray-500 dark:text-gray-300">
            {t("chat.input.blocked.guest", "Bạn chỉ có quyền xem")}
          </p>
        )}
      </section>
    );
  }

  return (
    <div>
      <DocumentPickerModal
        isOpen={showDocPicker}
        onClose={() => setShowDocPicker(false)}
        onSelect={handleSelectDocument}
        roomId={chatId}
      />
      <div className="mb-4 absolute bottom-15">
        <TypingIndicator users={roomTypingUsers[room?.roomId || ""] || []} />
      </div>
      <section
        aria-label="Chat input area"
        className="
          absolute bottom-0 left-0 w-full px-4 py-4 mt-5 
          backdrop-blur-2xl bg-white/30 border-t border-white/30
          dark:bg-gray-950/80 dark:border-gray-800
        "
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%)",
        }}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => {
          handleDragOver(e);
          if (!isDragging) setIsDragging(true);
        }}
        onDragLeave={onDragLeave}
      >
        <FilePreviewGridModal
          files={attachments}
          onRemove={(idx) =>
            setAttachments((prev) => {
              const copy = [...prev];
              const [rm] = copy.splice(idx, 1);
              if (rm) URL.revokeObjectURL(rm.url);
              return copy;
            })
          }
          onRemoveAll={() => {
            for (const att of attachments) {
              URL.revokeObjectURL(att.url);
            }
            setAttachments([]);
          }}
          showPdfInline={true}
        />

        {attachments.some((att) => att.kind === "photo") && (
          <div className="mb-2 flex items-center justify-end bg-gray-50 dark:bg-gray-800 p-2 rounded-lg gap-2">
            <Chip color="warning" variant="bordered">
              HD
            </Chip>
            <Switch
              size="sm"
              isSelected={!compressImages}
              onValueChange={setCompressImages}
            />
          </div>
        )}

        {replyingTo && (
          <button
            className="
              mb-2 flex w-full items-start
              bg-gradient-to-r from-teal-50 to-blue-50 
              dark:from-teal-900/40 dark:to-blue-900/40
              border-l-4 border-teal-500 dark:border-teal-400
              p-3 rounded-lg gap-3 shadow-sm
            "
            onClick={() => {
              setScrollto(replyingTo.id);
            }}
          >
            <div className="flex-1 justify-start min-w-0">
              <div className="flex flex-col items-start gap-2 mb-1">
                <div>
                  <span className="text-xs font-semibold text-teal-600 dark:text-teal-300">
                    {t("chat.input.replyingTo", {
                      name: replyingTo.isMine
                        ? t("chat.input.you")
                        : replyingTo.sender?.fullname || "Unknown",
                    })}
                  </span>
                  {replyingTo.type !== "text" && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="primary"
                      className="h-5"
                    >
                      {replyingTo.type === "image" &&
                        `📷 ${t("chat.input.image")}`}
                      {replyingTo.type === "video" &&
                        `🎥 ${t("chat.input.video")}`}
                      {replyingTo.type === "file" &&
                        `📎 ${t("chat.input.file")}`}
                      {replyingTo.type === "gif" && `🎬 ${t("chat.input.gif")}`}
                      {replyingTo.type === "audio" &&
                        `🎵 ${t("chat.input.audio")}`}
                    </Chip>
                  )}
                </div>
                <p className="text-sm text-center text-gray-700 dark:text-gray-200 line-clamp-2">
                  {replyingTo.type === "text" && replyingTo.content}
                  {replyingTo.type === "image" && `📷 ${t("chat.input.image")}`}
                  {replyingTo.type === "video" && `🎥 ${t("chat.input.video")}`}
                  {replyingTo.type === "file" && `📎 ${t("chat.input.file")}`}
                  {replyingTo.type === "gif" && `🎬 ${t("chat.input.gif")}`}
                </p>
              </div>
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setReplyMessage(chatId, null)}
              className="hover:bg-red-100 dark:hover:bg-red-900/40 min-w-unit-8"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400" />
            </Button>
          </button>
        )}

        <div className="flex items-center gap-3">
          {/* Left icons */}
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
            radius="full"
            onPress={handleVoiceChatToggle}
          >
            {!micro && <MicrophoneIcon className="w-5 h-5" />}
            {micro && <XCircleIcon className="w-5 h-5" />}
          </Button>

          {!micro && (
            <div className="flex items-center gap-2">
              <Tooltip
                content={t("chat.input.tooltipMedia", {
                  maxFiles,
                  maxSize: config.maxSizeMB,
                })}
              >
                <Button
                  isIconOnly
                  color="primary"
                  className="bg-teal-500 hover:bg-teal-600"
                  size="sm"
                  onClick={() => fileMediaInputRef.current?.click()}
                >
                  <PhotoIcon className="w-5 h-5" />
                </Button>
              </Tooltip>
              <Tooltip
                content={t("chat.input.tooltipFile", {
                  maxFiles,
                  maxSize: config.maxSizeMB,
                })}
              >
                <Button
                  isIconOnly
                  color="primary"
                  className="bg-teal-500 hover:bg-teal-600"
                  size="sm"
                  onClick={() => fileDocInputRef.current?.click()}
                >
                  <DocumentIcon className="w-5 h-5" />
                </Button>
              </Tooltip>

              <Tooltip
                content={t("documents.select_document", "Select Document")}
              >
                <Button
                  isIconOnly
                  color="secondary"
                  className="bg-purple-500 hover:bg-purple-600"
                  size="sm"
                  onClick={() => setShowDocPicker(true)}
                >
                  <BookOpenIcon className="w-5 h-5" />
                </Button>
              </Tooltip>

              {/* Emoji Picker */}
              <Popover
                isOpen={isEmojiPickerOpen}
                onOpenChange={setIsEmojiPickerOpen}
                placement="top-start"
                offset={10}
                shouldBlockScroll={false}
                backdrop="transparent"
                classNames={{
                  content:
                    "p-0 backdrop-blur-2xl bg-white/30 border border-white/30 shadow-xl dark:bg-gray-900/80 dark:border-gray-700",
                }}
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%)",
                }}
              >
                <PopoverTrigger>
                  <Button
                    isIconOnly
                    color="primary"
                    className="bg-teal-500 hover:bg-teal-600"
                    size="sm"
                  >
                    <FaceSmileIcon className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 border-none shadow-xl backdrop-blur-2xl bg-white/20 dark:bg-gray-900/90">
                  <div className="h-[400px] w-[400px]">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      width="100%"
                      height={400}
                      previewConfig={{
                        showPreview: false,
                      }}
                      searchPlaceHolder={t("chat.input.searchEmoji")}
                      skinTonesDisabled
                      lazyLoadEmojis={true}
                      categories={emojiTab}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              {/* GIF Picker */}
              <Popover
                isOpen={isGifPickerOpen}
                onOpenChange={setIsGifPickerOpen}
                placement="top-start"
                offset={10}
                shouldBlockScroll={false}
                backdrop="transparent"
                classNames={{
                  content:
                    "p-0 backdrop-blur-2xl bg-white/30 border border-white/30 shadow-xl w-[400px] dark:bg-gray-900/80 dark:border-gray-700",
                }}
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%)",
                }}
              >
                <PopoverTrigger>
                  <Button
                    isIconOnly
                    color="primary"
                    className="bg-teal-500 hover:bg-teal-600"
                    size="sm"
                  >
                    <GifIcon className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 border-none shadow-xl backdrop-blur-2xl bg-white/20 dark:bg-gray-900/90 w-[400px]">
                  <div className="flex flex-col h-[400px]">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                      <Input
                        placeholder={t("chat.input.searchGif")}
                        value={gifSearchQuery}
                        onChange={(e) => setGifSearchQuery(e.target.value)}
                        size="sm"
                        classNames={{
                          input: "text-sm",
                          inputWrapper: "h-9",
                        }}
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                      {(() => {
                        if (isLoadingGifs) {
                          return (
                            <div className="flex items-center justify-center h-40">
                              <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent"></div>
                            </div>
                          );
                        }
                        if (gifs.length > 0) {
                          return (
                            <div className="grid grid-cols-2 gap-2">
                              {gifs.map((gif) => (
                                <button
                                  key={gif.id}
                                  onClick={() =>
                                    onGifClick(
                                      gif.media_formats.gif.url,
                                      gif.content_description || gif.id
                                    )
                                  }
                                  className="
                                    relative aspect-square rounded-lg overflow-hidden 
                                    hover:opacity-80 transition-opacity cursor-pointer
                                    bg-gray-100 dark:bg-gray-800
                                  "
                                >
                                  <img
                                    src={gif.media_formats.tinygif.url}
                                    alt={gif.content_description || "GIF"}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </button>
                              ))}
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
                            {gifSearchQuery
                              ? t("chat.input.noGifFound")
                              : t("chat.input.enterToSearchGif")}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="p-2 border-t border-gray-200 dark:border-gray-800 text-center">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Powered by Tenor
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* MESSAGE INPUT / VOICE UI */}
          <div className="flex-1">
            {!micro && (
              <Input
                ref={inputRef}
                placeholder="Aa"
                classNames={{
                  input: "bg-white dark:bg-gray-900 dark:text-gray-100",
                  inputWrapper:
                    "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-400 focus-within:border-teal-500 dark:focus-within:border-teal-400",
                }}
                size="lg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                onFocus={() => roomTypingSocket({ isTyping: true, socket })}
                onBlur={() => roomTypingSocket({ isTyping: false, socket })}
              />
            )}

            {micro && !preview && (
              <div className="flex items-center">
                {state === "recording" && (
                  <>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={pause}
                    >
                      <PauseCircleIcon />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={stop}
                    >
                      <StopCircleIcon />
                    </Button>
                  </>
                )}
                {state === "paused" && (
                  <>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={resume}
                    >
                      <PlayIcon />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={stop}
                    >
                      <StopCircleIcon />
                    </Button>
                  </>
                )}

                <div className="flex-1 w-full max-w-[80%] ml-4 mr-2">
                  <WaveformCanvas
                    height={40}
                    attach={(el) =>
                      attachCanvas(el, {
                        render: "bars",
                        height: 40,
                        color: "#09b9ffff",
                        barCount: 18,
                        smoothing: 0.8,
                      })
                    }
                  />
                </div>
                <div>
                  <span className="text-sm tabular-nums dark:text-gray-200">
                    {new Date(durationMs).toISOString().slice(14, 19)}
                  </span>
                </div>
              </div>
            )}

            {micro && preview && (
              <div className="flex items-center gap-2">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => {
                    cancel();
                    setMicro(false);
                  }}
                >
                  <TrashIcon className="w-5 h-5" />
                </Button>
                <audio controls src={preview.url} className="w-full">
                  <track kind="captions" />
                </audio>
              </div>
            )}
          </div>

          {/* RIGHT ICONS */}
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              color="primary"
              className="bg-teal-500 hover:bg-teal-600"
              size="sm"
              radius="full"
              onPress={micro ? onVoiceSend : onSend}
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <input
          ref={fileMediaInputRef}
          type="file"
          hidden
          multiple
          onChange={onPick}
          accept={"image/*,video/*,audio/*"}
        />
        <input
          ref={fileDocInputRef}
          type="file"
          hidden
          multiple
          onChange={onPick}
          accept="*"
        />
      </section>

      <FileGalleryModal
        isOpen={showFileGallery}
        onClose={() => setShowFileGallery(false)}
        onSelect={(files) => {
          if (files.length > 0 && socket) {
            const attachmentIds = files.map((f) => f._id);
            socket.emit("message:send", {
              roomId: chatId,
              userId: useAuthStore.getState().user?._id,
              type: "text",
              content: "",
              attachments: attachmentIds,
            });
          }
        }}
        roomId={chatId}
        userId={useAuthStore.getState().user?._id}
      />
    </div>
  );
}
