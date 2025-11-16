import { EyeDropperIcon } from "@heroicons/react/16/solid";
import { LinkPreview } from "./LinkPreview";
import { extractFirstUrl } from "@/libs/url-helpers";
import { MAX_MESSAGE_LENGTH } from "./constants/messageConstants";
import { MessageType } from "@/store/types/message.state";

interface MessageBubbleProps {
  msg: MessageType;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
}

export function MessageBubble({
  msg,
  isSameSenderAsPrev,
  isSameSenderAsNext,
  isExpanded,
  onToggleExpanded,
}: MessageBubbleProps) {
  // Deleted message
  if (msg.hiddenByMe) {
    return (
      <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
        <div
          className={`
            relative px-4 py-2.5 rounded-2xl shadow-sm bg-gray-100 text-gray-500 italic text-sm border border-gray-200
          `}
        >
          {msg.isMine ? "Bạn đã xoá tin nhắn này" : "Tin nhắn đã bị xoá"}
        </div>
      </div>
    );
  }

  // Recalled message
  if (msg.isDeleted) {
    return (
      <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
        <div
          className={`
            relative px-4 py-2.5 rounded-2xl shadow-sm bg-gray-100 text-gray-500 italic text-sm border border-gray-200
          `}
        >
          {msg.isMine
            ? "Bạn đã thu hồi tin nhắn này"
            : "Tin nhắn đã bị thu hồi"}
        </div>
      </div>
    );
  }

  // Regular text content
  if (msg.content) {
    const isLongMessage = msg.content.length > MAX_MESSAGE_LENGTH;
    const displayContent =
      isLongMessage && !isExpanded
        ? msg.content.slice(0, MAX_MESSAGE_LENGTH) + "..."
        : msg.content;
    const previewUrl = extractFirstUrl(msg.content);

    return (
      <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
        <div
          className={`
            relative px-4 py-2.5 rounded-2xl shadow-sm
            ${
              msg.isMine
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                : "bg-white text-gray-800 border border-gray-200"
            }
            ${
              !isSameSenderAsPrev && msg.isMine ? "rounded-tr-md" : ""
            }
            ${
              !isSameSenderAsPrev && !msg.isMine ? "rounded-tl-md" : ""
            }
            ${
              !isSameSenderAsNext && msg.isMine ? "rounded-br-md" : ""
            }
            ${
              !isSameSenderAsNext && !msg.isMine ? "rounded-bl-md" : ""
            }
            ${
              msg.status === "pending" || msg.status === "uploading"
                ? "opacity-60"
                : ""
            }
            ${
              msg.status === "failed"
                ? "opacity-80 border-2 border-red-400"
                : ""
            }
          `}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {displayContent}
          </p>

          {/* Nút xem thêm/thu gọn */}
          {isLongMessage && (
            <button
              onClick={() => onToggleExpanded(msg.id)}
              className={`text-xs mt-1 font-medium hover:underline ${
                msg.isMine ? "text-blue-100" : "text-blue-600"
              }`}
            >
              {isExpanded ? "Thu gọn" : "Xem thêm"}
            </button>
          )}

          {/* Pinned icon */}
          {msg.pinned && (
            <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1 shadow-md">
              <EyeDropperIcon className="w-3 h-3 text-white" />
            </div>
          )}

          {/* Uploading indicator */}
          {msg.status === "uploading" && (
            <div className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 shadow-md animate-pulse">
              <span className="text-white text-xs">⏳</span>
            </div>
          )}
        </div>

        {/* Link Preview - hiển thị nếu có URL */}
        {previewUrl ? (
          <div className="mt-2">
            <LinkPreview url={previewUrl} isMine={msg.isMine} />
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

