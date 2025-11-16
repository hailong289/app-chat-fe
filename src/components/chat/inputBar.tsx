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
import { useEffect, useRef, useState } from "react";
import FilePreviewGridModal from "../FilePreviewGridModal";
import useMessageStore from "@/store/useMessageStore";
import { FilePreview, MessageType } from "@/store/types/message.state";
import useAuthStore from "@/store/useAuthStore";
import { useSocket } from "../providers/SocketProvider";
import EmojiPicker, { EmojiClickData, Categories } from "emoji-picker-react";
import { ObjectId } from "bson";
import { toast } from "@/store/useToastStore";
import { m } from "framer-motion";
import { useVoiceRecorder } from "@/libs/useVoiceRecorder";
import { PermissionService } from "@/service/permisson.service";
import WaveformCanvas from "./WaveformCanvas";
import {
  PauseCircleIcon,
  PlayIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";
const emojiTab = [
  {
    name: "Gần đây",
    category: Categories.SUGGESTED,
  },
  {
    name: "Mặt cười",
    category: Categories.SMILEYS_PEOPLE,
  },
  {
    name: "Động vật",
    category: Categories.ANIMALS_NATURE,
  },
  {
    name: "Đồ ăn",
    category: Categories.FOOD_DRINK,
  },
  {
    name: "Hoạt động",
    category: Categories.ACTIVITIES,
  },
  {
    name: "Du lịch",
    category: Categories.TRAVEL_PLACES,
  },
  {
    name: "Đồ vật",
    category: Categories.OBJECTS,
  },
  {
    name: "Ký hiệu",
    category: Categories.SYMBOLS,
  },
  {
    name: "Cờ",
    category: Categories.FLAGS,
  },
];
const maxFiles = 20;
export default function ChatInputBar({
  chatId,
  noAction,
}: Readonly<{ chatId: string; noAction: boolean }>) {
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [compressImages, setCompressImages] = useState(true);
  const [micro, setMicro] = useState(false);
  const attRef = useRef<FilePreview[]>([]);
  attRef.current = attachments;

  const useMessage = useMessageStore();
  const authState = useAuthStore();
  const { socket } = useSocket();

  // Get reply from store using selector
  const replyingTo = useMessageStore(
    (state) => state.messagesRoom[chatId]?.reply
  );

  // defaultConfig.maxFiles = 10;
  const config: FileAcceptConfig = {
    ...defaultConfig,
    maxFiles,
    compressImages,
  };

  // Callback khi vượt quá giới hạn files
  const handleMaxFilesExceeded = (current: number, max: number) => {
    console.log(
      "🚨 Max files exceeded:",
      current,
      "files selected, max is",
      max
    );

    toast.error(
      `Chỉ được chọn tối đa ${max} files. Bạn đã chọn ${current} files.`
    );
  };

  useEffect(() => {
    cleanupAll(attRef);
    setAttachments(useMessage.messagesRoom[chatId]?.attachments || []);
    setIsDragging(false);
    setMessage(useMessage.messagesRoom[chatId]?.input || "");
  }, [chatId]);
  useEffect(() => {
    useMessage.setAttachments(chatId, attachments);
    useMessage.setInput(chatId, message);
  }, [attachments, message]);
  const setAttachmentsAsync = (
    updater: (prev: FilePreview[]) => Promise<FilePreview[]>
  ) => {
    setAttachments((prev) => {
      updater(prev).then(setAttachments);
      return prev;
    });
  };

  const onPaste = handlePasteFactory(
    setAttachmentsAsync as any,
    config,
    handleMaxFilesExceeded
  );
  const onPick = handleFilePickFactory(
    setAttachmentsAsync as any,
    config,
    handleMaxFilesExceeded
  );
  const onDrop = handleDropFactory(
    setAttachmentsAsync as any,
    config,
    setIsDragging,
    handleMaxFilesExceeded
  );

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [gifs, setGifs] = useState<any[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";
  const TENOR_CLIENT_KEY = "chat-app";

  const searchGifs = async (query: string) => {
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
  };

  useEffect(() => {
    if (isGifPickerOpen && gifs.length === 0) {
      searchGifs("trending");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGifPickerOpen]);

  useEffect(() => {
    if (!isGifPickerOpen) return;

    const timer = setTimeout(() => {
      if (gifSearchQuery) {
        searchGifs(gifSearchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifSearchQuery, isGifPickerOpen]);

  const onSend = () => {
    if (!message.trim() && attachments.length === 0) return;

    // Get replyTo ID if exists
    const replyToId = replyingTo?.id;

    // Gửi file message trước (nếu có)
    if (attachments.length > 0) {
      // Xác định type dựa vào loại file đầu tiên
      const firstAttachment = attachments[0];
      let messageType: "image" | "file" | "video" = "file";

      if (firstAttachment.mimeType?.startsWith("image/")) {
        messageType = "image";
      } else if (firstAttachment.mimeType?.startsWith("video/")) {
        messageType = "video";
      }

      // Gửi message chứa files (không có text)
      useMessage.sendMessage({
        roomId: chatId,
        content: "",
        attachments: attachments,
        type: messageType,
        replyTo: replyToId,
        socket,
        userId: authState.user?.id,
        userFullname: authState.user?.fullname,
        userAvatar: authState.user?.avatar,
      });

      setAttachments([]);
    }

    // Gửi text message riêng (nếu có)
    if (message.trim()) {
      useMessage.sendMessage({
        roomId: chatId,
        content: message,
        attachments: [],
        type: "text",
        replyTo: replyToId,
        socket,
        userId: authState.user?.id,
        userFullname: authState.user?.fullname,
        userAvatar: authState.user?.avatar,
      });

      setMessage("");
    }

    // Clear reply after sending
    if (replyToId) {
      useMessageStore.getState().setReplyMessage(chatId, null);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const input = inputRef.current;

    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);

      // Set cursor position after emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setMessage(message + emoji);
    }

    // Không đóng picker - để user tiếp tục chọn
  };

  const onGifClick = async (gifUrl: string, gifTitle: string = "animation") => {
    try {
      // Download GIF từ URL
      const response = await fetch(gifUrl);
      const blob = await response.blob();

      // Tạo File object từ blob
      const fileName = `${gifTitle.replaceAll(
        /[^a-z0-9]/gi,
        "_"
      )}_${Date.now()}.gif`;
      const file = new File([blob], fileName, { type: "image/gif" });

      // Tạo preview URL
      const previewUrl = URL.createObjectURL(blob);
      const id = new ObjectId().toHexString();
      // Tạo FilePreview object giống như paste/drop file
      const filePreview: FilePreview = {
        _id: id,
        file: file,
        url: previewUrl,
        name: fileName,
        size: blob.size,
        mimeType: "image/gif",
        kind: "photo", // GIF được coi là photo
        status: "pending",
        uploadProgress: 0,
      };

      // Thêm vào attachments
      // setAttachments((prev) => [...prev, filePreview]);

      // Không đóng picker - để user tiếp tục chọn GIF khác nếu muốn
      useMessage.sendMessage({
        roomId: chatId,
        content: message,
        attachments: [filePreview], // Tạm thời để rỗng, sẽ xử lý upload sau
        type: "gif",
        socket,
        userId: authState.user?.id,
        userFullname: authState.user?.fullname,
        userAvatar: authState.user?.avatar,
      });
      console.log("✅ GIF added as attachment:", fileName);
    } catch (error) {
      console.error("❌ Error downloading GIF:", error);
      // Fallback: insert URL vào message (vẫn giữ picker mở)
      setMessage((prev) => prev + (prev ? " " : "") + gifUrl);
    }
  };
  // void chat
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
  const handleVoiceChatToggle = async () => {
    // 1️⃣ Xin quyền mic trước
    try {
      await PermissionService.requestMicrophoneAccess();
    } catch (error) {
      // Log the error and show a user-friendly toast
      console.error("PermissionService.requestMicrophoneAccess failed:", error);
      toast.error("Không thể truy cập micro.");
      return;
    }

    // 2️⃣ Nếu đang tắt micro → bật và bắt đầu ghi
    if (!micro) {
      setMicro(true);
      // đảm bảo mic khởi tạo xong rồi mới start
      setTimeout(() => {
        if (state === "idle") start();
      }, 100);
    } else {
      // 3️⃣ Nếu đang bật → hủy ghi
      console.log("cancel voice");
      cancel();
      setMicro(false);
    }
  };
  // giữ giá trị preview mới nhất để chờ stop() xong
  const previewRef = useRef(preview);
  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  // helper: đợi có preview sau khi stop() (tối đa 3s)
  function waitForPreview(getPreview: () => any, timeoutMs = 1200) {
    const start = performance.now();
    return new Promise<any | null>((resolve) => {
      const tick = () => {
        const p = getPreview();
        if (p) return resolve(p);
        if (performance.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, 20);
      };
      tick();
    });
  }

  // chống spam gửi
  const sendingRef = useRef(false);
  const onVoiceSend = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      // 1) đảm bảo dừng ghi
      if (state === "recording" || state === "paused") {
        stop(); // onstop -> setPreview
      }

      // 2) đợi preview sẵn sàng
      const fp = preview ?? (await waitForPreview(() => preview));
      if (!fp) {
        sendingRef.current = false;
        return;
      }

      // 3) gửi message
      await useMessage.sendMessage({
        roomId: chatId,
        content: "",
        attachments: [fp],
        type: "audio",
        socket,
        userId: authState.user?.id,
        userFullname: authState.user?.fullname,
        userAvatar: authState.user?.avatar,
      });

      // 4) TẮT MIC HOÀN TOÀN: dọn recorder + stream + AudioContext
      cancel(); // <-- quan trọng: stop tracks + close audioCtx + revoke blob URL
      setMicro(false); // tắt UI voice

      // (tuỳ chọn) delay 100–200ms cho browser cập nhật icon mic
      // await new Promise(r => setTimeout(r, 150));
    } finally {
      sendingRef.current = false;
    }
  };
  const onDragLeave = handleDragLeaveFactory(setIsDragging);
  if (noAction) {
    return (
      <section
        aria-label="Chat input area"
        className="absolute bottom-0 left-0 w-full px-4 py-4 mt-5 backdrop-blur-2xl bg-white/30 border-t border-white/30 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.1)] flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%)",
        }}
      >
        <p className="text-gray-500">
          Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này.
        </p>
      </section>
    );
  }
  return (
    <section
      aria-label="Chat input area"
      className="absolute bottom-0 left-0 w-full px-4 py-4 mt-5 backdrop-blur-2xl bg-white/30 border-t border-white/30 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.1)]"
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
        files={attachments} // [{file, url}]
        onRemove={(idx) =>
          setAttachments((prev) => {
            const copy = [...prev];
            const [rm] = copy.splice(idx, 1);
            if (rm) URL.revokeObjectURL(rm.url);
            return copy;
          })
        }
        onRemoveAll={() => {
          // Revoke tất cả URLs trước khi xóa
          for (const att of attachments) {
            URL.revokeObjectURL(att.url);
          }
          setAttachments([]);
        }}
        showPdfInline={true}
      />

      {/* Toggle nén ảnh */}
      {attachments.some((att) => att.kind === "photo") && (
        <div className="mb-2 flex items-center justify-end bg-gray-50 p-2 rounded-lg gap-2">
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
      {/* Reply message preview */}
      {replyingTo && (
        <div className="mb-2 flex w-full items-start bg-gradient-to-r from-teal-50 to-blue-50 border-l-4 border-teal-500 p-3 rounded-lg gap-3 shadow-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-teal-600">
                Trả lời{" "}
                {replyingTo.isMine
                  ? "chính tôi"
                  : replyingTo.sender?.fullname || "Unknown"}
              </span>
              {replyingTo.type !== "text" && (
                <Chip size="sm" variant="flat" color="primary" className="h-5">
                  {replyingTo.type === "image" && "📷 Ảnh"}
                  {replyingTo.type === "video" && "🎥 Video"}
                  {replyingTo.type === "file" && "📎 File"}
                  {replyingTo.type === "gif" && "🎬 GIF"}
                </Chip>
              )}
            </div>
            <p className="text-sm text-gray-700 line-clamp-2">
              {replyingTo.type === "text" && replyingTo.content}
              {replyingTo.type === "image" && "📷 Ảnh"}
              {replyingTo.type === "video" && "🎥 Video"}
              {replyingTo.type === "file" && "📎 File"}
              {replyingTo.type === "gif" && "🎬 GIF"}
            </p>
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() =>
              useMessageStore.getState().setReplyMessage(chatId, null)
            }
            className="hover:bg-red-100 min-w-unit-8"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500 hover:text-red-500" />
          </Button>
        </div>
      )}
      <div className="flex items-center gap-3">
        {/* Left icons */}
        <Button
          isIconOnly
          color="primary"
          className="bg-teal-500 hover:bg-teal-600"
          size="sm"
          radius="full"
          onPress={() => handleVoiceChatToggle()}
        >
          {!micro && <MicrophoneIcon className="w-5 h-5" />}
          {micro && <XCircleIcon className="w-5 h-5" />}
        </Button>
        {!micro && (
          <div className="flex items-center gap-2">
            <Tooltip
              content={`Chèn ảnh hoặc video tối đa ${maxFiles} files và có kích thước tối đa ${config.maxSizeMB}MB mỗi file`}
            >
              <Button
                isIconOnly
                color="primary"
                className="bg-teal-500 hover:bg-teal-600"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <PhotoIcon className="w-5 h-5" />
              </Button>
            </Tooltip>

            <Popover
              isOpen={isEmojiPickerOpen}
              onOpenChange={setIsEmojiPickerOpen}
              placement="top-start"
              offset={10}
              shouldBlockScroll={false}
              backdrop="transparent"
              classNames={{
                content:
                  "p-0 backdrop-blur-2xl bg-white/30 border border-white/30 shadow-xl",
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
              <PopoverContent className="p-0 border-none shadow-xl backdrop-blur-2xl bg-white/20">
                <div className="h-[400px] w-[400px]">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width="100%"
                    height={400}
                    previewConfig={{
                      showPreview: false,
                    }}
                    searchPlaceHolder="Tìm emoji..."
                    skinTonesDisabled
                    lazyLoadEmojis={true}
                    categories={emojiTab}
                  />
                </div>
              </PopoverContent>
            </Popover>

            <Popover
              isOpen={isGifPickerOpen}
              onOpenChange={setIsGifPickerOpen}
              placement="top-start"
              offset={10}
              shouldBlockScroll={false}
              backdrop="transparent"
              classNames={{
                content:
                  "p-0 backdrop-blur-2xl bg-white/30 border border-white/30 shadow-xl w-[400px]",
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
              <PopoverContent className="p-0 border-none shadow-xl backdrop-blur-2xl bg-white/20 w-[400px]">
                <div className="flex flex-col h-[400px]">
                  {/* Search header */}
                  <div className="p-3 border-b border-gray-200">
                    <Input
                      placeholder="Tìm GIF..."
                      value={gifSearchQuery}
                      onChange={(e) => setGifSearchQuery(e.target.value)}
                      size="sm"
                      classNames={{
                        input: "text-sm",
                        inputWrapper: "h-9",
                      }}
                    />
                  </div>

                  {/* GIF grid */}
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
                                className="relative aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity cursor-pointer bg-gray-100"
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
                        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                          {gifSearchQuery
                            ? "Không tìm thấy GIF"
                            : "Nhập để tìm GIF..."}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="p-2 border-t border-gray-200 text-center">
                    <span className="text-xs text-gray-400">
                      Powered by Tenor
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Message input */}
        <div className="flex-1">
          {!micro && (
            <Input
              ref={inputRef}
              placeholder="Aa"
              classNames={{
                input: "bg-white",
                inputWrapper:
                  "bg-white border-gray-200 hover:border-teal-500 focus-within:border-teal-500",
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
            />
          )}

          {micro && !preview && (
            <div className="flex  items-center j">
              {state === "recording" && (
                <>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={() => pause()}
                  >
                    <PauseCircleIcon />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={() => stop()}
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
                    onPress={() => resume()}
                  >
                    <PlayIcon />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={() => stop()}
                  >
                    <StopCircleIcon />
                  </Button>
                </>
              )}
              {/* <span className="text-sm tabular-nums">dfwf</span> */}

              <div className="flex-1 w-full max-w-[80%] ml-4 mr-2">
                {" "}
                {/* 👈 thêm min-w-0 để cho phép co */}
                <WaveformCanvas
                  height={56}
                  attach={(el) =>
                    attachCanvas(el, {
                      render: "bars",
                      height: 56,
                      color: "#09b9ffff",
                      barCount: 18,
                      smoothing: 0.8,
                    })
                  }
                />
              </div>
              <div>
                <span className="text-sm tabular-nums">
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
              <audio controls src={preview.url} className="w-full" />
            </div>
          )}
        </div>

        {/* Right icons */}
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
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        onChange={onPick}
        accept={"image/*,video/*"}
      />
    </section>
  );
}
