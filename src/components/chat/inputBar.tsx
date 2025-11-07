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
} from "@heroicons/react/16/solid";
import {
  Button,
  Switch,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Chip,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import FilePreviewGridModal from "../FilePreviewGridModal";
import useMessageStore from "@/store/useMessageStore";
import { FilePreview } from "@/store/types/message.state";
import useAuthStore from "@/store/useAuthStore";
import { useSocket } from "../providers/SocketProvider";
import EmojiPicker, { EmojiClickData, Categories } from "emoji-picker-react";

export default function ChatInputBar({ chatId }: Readonly<{ chatId: string }>) {
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

  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [compressImages, setCompressImages] = useState(false);
  const attRef = useRef<FilePreview[]>([]);
  attRef.current = attachments;

  const config: FileAcceptConfig = {
    ...defaultConfig,
    compressImages,
  };

  useEffect(() => {
    cleanupAll(attRef);
    setAttachments([]);
    setIsDragging(false);
  }, [chatId]);

  const setAttachmentsAsync = (
    updater: (prev: FilePreview[]) => Promise<FilePreview[]>
  ) => {
    setAttachments((prev) => {
      updater(prev).then(setAttachments);
      return prev;
    });
  };

  const onPaste = handlePasteFactory(setAttachmentsAsync as any, config);
  const onPick = handleFilePickFactory(setAttachmentsAsync as any, config);
  const onDrop = handleDropFactory(
    setAttachmentsAsync as any,
    config,
    setIsDragging
  );

  const useMessage = useMessageStore((state) => state);
  const authState = useAuthStore((state) => state);
  const { socket } = useSocket();
  const [type, setType] = useState<"text" | "image" | "file" | "video">("text");
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

    useMessage.sendMessage({
      roomId: chatId,
      content: message,
      attachments: attachments, // Tạm thời để rỗng, sẽ xử lý upload sau
      type: type,
      socket,
      userId: authState.user?.id,
      userFullname: authState.user?.fullname,
      userAvatar: authState.user?.avatar,
    });

    setMessage("");
    setAttachments([]);
    setType("text");
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

      // Tạo FilePreview object giống như paste/drop file
      const filePreview: FilePreview = {
        _id: `temp_${Date.now()}_${Math.random()}`,
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
      setAttachments((prev) => [...prev, filePreview]);

      // Không đóng picker - để user tiếp tục chọn GIF khác nếu muốn

      console.log("✅ GIF added as attachment:", fileName);
    } catch (error) {
      console.error("❌ Error downloading GIF:", error);
      // Fallback: insert URL vào message (vẫn giữ picker mở)
      setMessage((prev) => prev + (prev ? " " : "") + gifUrl);
    }
  };

  const onDragLeave = handleDragLeaveFactory(setIsDragging);

  return (
    <section
      aria-label="Chat input area"
      className="absolute bottom-4 left-[5%] bg-white w-[90%] p-4 rounded-2xl"
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
            isSelected={compressImages}
            onValueChange={setCompressImages}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Left icons */}
        <div className="flex items-center gap-2">
          {/* <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
          >
            <MicrophoneIcon className="w-5 h-5" />
          </Button> */}
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <PhotoIcon className="w-5 h-5" />
          </Button>

          <Popover
            isOpen={isEmojiPickerOpen}
            onOpenChange={setIsEmojiPickerOpen}
            placement="top-start"
            offset={10}
            shouldBlockScroll={false}
            backdrop="transparent"
            classNames={{
              content: "p-0",
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
            <PopoverContent className="p-0 border-none shadow-xl">
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
              content: "p-0",
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
            <PopoverContent className="p-0 border-none shadow-xl w-[400px]">
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

        {/* Message input */}
        <div className="flex-1">
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
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
            radius="full"
          >
            <MicrophoneIcon className="w-5 h-5" />
          </Button>
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
            radius="full"
            onClick={onSend}
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
        accept={defaultConfig.accept.join(",")}
      />
    </section>
  );
}
