import { EyeDropperIcon } from "@heroicons/react/16/solid";
import { LinkPreview } from "./LinkPreview";
import { extractFirstUrl } from "@/libs/url-helpers";
import { MAX_MESSAGE_LENGTH } from "../constants/messageConstants";
import { MessageType } from "@/store/types/message.state";
import { useTranslation } from "react-i18next";

interface MessageBubbleProps {
  msg: MessageType;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
}

function DeletedMessageBubble({ isMine }: Readonly<{ isMine: boolean }>) {
  const { t } = useTranslation();
  return (
    <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
      <div
        className={`
          relative px-4 py-2.5 rounded-2xl shadow-sm
          bg-gray-100 text-gray-500 border border-gray-200 italic text-sm
          dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700
        `}
      >
        {isMine
          ? t("chat.messages.bubble.deleted.me")
          : t("chat.messages.bubble.deleted.other")}
      </div>
    </div>
  );
}

function RecalledMessageBubble({ isMine }: Readonly<{ isMine: boolean }>) {
  const { t } = useTranslation();
  return (
    <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
      <div
        className={`
          relative px-4 py-2.5 rounded-2xl shadow-sm
          bg-gray-100 text-gray-500 border border-gray-200 italic text-sm
          dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700
        `}
      >
        {isMine
          ? t("chat.messages.bubble.recalled.me")
          : t("chat.messages.bubble.recalled.other")}
      </div>
    </div>
  );
}

function getBubbleClasses(
  msg: MessageType,
  isSameSenderAsPrev: boolean,
  isSameSenderAsNext: boolean
) {
  return `
    relative px-4 py-2.5 rounded-2xl shadow-sm
    ${
      msg.isMine
        ? `
          bg-gradient-to-br from-blue-500 to-blue-600 text-white
          dark:from-blue-500 dark:to-blue-600 dark:text-white
        `
        : `
          bg-white text-gray-800 border border-gray-200
          dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700
        `
    }
    ${!isSameSenderAsPrev && msg.isMine ? "rounded-tr-md" : ""}
    ${!isSameSenderAsPrev && !msg.isMine ? "rounded-tl-md" : ""}
    ${!isSameSenderAsNext && msg.isMine ? "rounded-br-md" : ""}
    ${!isSameSenderAsNext && !msg.isMine ? "rounded-bl-md" : ""}
    ${
      msg.status === "pending" || msg.status === "uploading" ? "opacity-60" : ""
    }
    ${
      msg.status === "failed"
        ? "opacity-80 border-2 border-red-400 dark:border-red-500"
        : ""
    }
  `;
}

function UploadingIndicator() {
  return (
    <div className="absolute -top-2 -right-2 bg-blue-500 dark:bg-blue-400 rounded-full p-1 shadow-md animate-pulse">
      <span className="text-white text-xs">⏳</span>
    </div>
  );
}

function RegularMessageBubble({
  msg,
  isSameSenderAsPrev,
  isSameSenderAsNext,
  isExpanded,
  onToggleExpanded,
}: Readonly<{
  msg: MessageType;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
}>) {
  const { t } = useTranslation();
  const isLongMessage = msg.content.length > MAX_MESSAGE_LENGTH;
  const displayContent =
    isLongMessage && !isExpanded
      ? msg.content.slice(0, MAX_MESSAGE_LENGTH) + "..."
      : msg.content;
  const previewUrl = extractFirstUrl(msg.content);

  return (
    <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
      <div
        className={getBubbleClasses(
          msg,
          isSameSenderAsPrev,
          isSameSenderAsNext
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {displayContent}
        </p>

        {/* Nút xem thêm/thu gọn */}
        {isLongMessage && (
          <button
            onClick={() => onToggleExpanded(msg.id)}
            className={`text-xs mt-1 font-medium hover:underline ${
              msg.isMine ? "text-blue-100" : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {isExpanded
              ? t("chat.messages.bubble.collapse")
              : t("chat.messages.bubble.seeMore")}
          </button>
        )}

        {/* Uploading indicator */}
        {msg.status === "uploading" && <UploadingIndicator />}
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

export function MessageBubble({
  msg,
  isSameSenderAsPrev,
  isSameSenderAsNext,
  isExpanded,
  onToggleExpanded,
}: Readonly<MessageBubbleProps>) {
  if (msg.hiddenByMe) {
    return <DeletedMessageBubble isMine={msg.isMine} />;
  }

  if (msg.isDeleted) {
    return <RecalledMessageBubble isMine={msg.isMine} />;
  }

  if (msg.content) {
    return (
      <RegularMessageBubble
        msg={msg}
        isSameSenderAsPrev={isSameSenderAsPrev}
        isSameSenderAsNext={isSameSenderAsNext}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
      />
    );
  }

  return null;
}
