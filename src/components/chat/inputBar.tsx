import {
  cleanupAll,
  defaultConfig,
  handleDragLeaveFactory,
  handleDragOver,
  handleDropFactory,
  handleFilePickFactory,
  handlePasteFactory,
} from "@/libs/file-handlers";
import {
  Bars3Icon,
  FaceSmileIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/16/solid";
import { Button } from "@heroui/button";
import { Input } from "@heroui/react";
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
  const attRef = useRef<FilePreview[]>([]);
  attRef.current = attachments;

  useEffect(() => {
    cleanupAll(attRef);
    setAttachments([]);
    setIsDragging(false);
  }, [chatId]);

  const onPaste = handlePasteFactory(setAttachments, defaultConfig);
  const onPick = handleFilePickFactory(setAttachments, defaultConfig);
  const onDrop = handleDropFactory(
    setAttachments,
    defaultConfig,
    setIsDragging
  );
  const useMessage = useMessageStore((state) => state);
  const authState = useAuthStore((state) => state);
  const { socket } = useSocket();

  const onSend = () => {
    if (!message.trim() && attachments.length === 0) return;

    useMessage.sendMessage({
      roomId: chatId,
      content: message,
      attachments: [], // Tạm thời để rỗng, sẽ xử lý upload sau
      type: "text",
      socket,
      userId: authState.user?.id,
      userFullname: authState.user?.fullname,
      userAvatar: authState.user?.avatar,
    });

    setMessage("");
    setAttachments([]);
  };
  const onDragLeave = handleDragLeaveFactory(setIsDragging);
  return (
    <div
      className="absolute bottom-8 left-[5%] bg-white w-[90%] p-4 rounded-2xl"
      role="region"
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
            <Bars3Icon className="w-5 h-5" />
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
    </div>
  );
}
