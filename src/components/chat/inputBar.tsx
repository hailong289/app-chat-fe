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
  Bars3Icon,
  FaceSmileIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PhotoIcon,
} from "@heroicons/react/16/solid";
import { Button, Switch, Input } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import FilePreviewGridModal from "../FilePreviewGridModal";
import useMessageStore from "@/store/useMessageStore";
import { FilePreview } from "@/store/types/message.state";
import useAuthStore from "@/store/useAuthStore";
import { useSocket } from "../providers/SocketProvider";

export default function ChatInputBar({ chatId }: { chatId: string }) {
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [compressImages, setCompressImages] = useState(false); // Toggle nén ảnh
  const attRef = useRef<FilePreview[]>([]);
  attRef.current = attachments;

  // Config với compression setting
  const config: FileAcceptConfig = {
    ...defaultConfig,
    compressImages,
  };

  useEffect(() => {
    cleanupAll(attRef);
    setAttachments([]);
    setIsDragging(false);
  }, [chatId]);

  // Wrapper để xử lý async
  const setAttachmentsAsync = (
    updater: (prev: FilePreview[]) => Promise<FilePreview[]>
  ) => {
    setAttachments((prev) => {
      updater(prev).then(setAttachments);
      return prev; // Giữ state cũ trong khi chờ
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
  const onDragLeave = handleDragLeaveFactory(setIsDragging);
  return (
    <section
      aria-label="Chat input area"
      className="absolute bottom-8 left-[5%] bg-white w-[90%] p-4 rounded-2xl"
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
          attachments.forEach((att) => URL.revokeObjectURL(att.url));
          setAttachments([]);
        }}
        showPdfInline={true}
      />

      {/* Toggle nén ảnh */}
      {attachments.some((att) => att.kind === "photo") && (
        <div className="mb-2 flex items-center justify-between bg-gray-50 p-2 rounded-lg">
          <span className="text-sm text-gray-600">Nén ảnh trước khi gửi</span>
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
          <Button
            isIconOnly
            color="primary"
            className="bg-teal-500 hover:bg-teal-600"
            size="sm"
          >
            <FaceSmileIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Message input */}
        <div className="flex-1">
          <Input
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
