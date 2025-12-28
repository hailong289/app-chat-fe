import {
  EyeDropperIcon,
  DocumentIcon,
  PhoneIcon,
  VideoCameraIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/16/solid";
import { LinkPreview } from "./LinkPreview";
import { extractFirstUrl } from "@/libs/url-helpers";
import { MAX_MESSAGE_LENGTH } from "../constants/messageConstants";
import { CallHistoryType, MessageType } from "@/store/types/message.state";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Helpers from "@/libs/helpers";
import useAuthStore from "@/store/useAuthStore";

interface MessageBubbleProps {
  msg: MessageType;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  type:
    | "text"
    | "image"
    | "file"
    | "system"
    | "video"
    | "audio"
    | "gif"
    | "call";
  callHistory: CallHistoryType | null;
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

function DocumentMessageBubble({ msg }: Readonly<{ msg: MessageType }>) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="relative max-w-xs md:max-w-sm lg:max-w-md group">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            router.push(`/docs/${msg.documentId}`);
          }
        }}
        className={`
          relative p-3 rounded-2xl shadow-sm border flex items-center gap-3 cursor-pointer
          transition-all hover:shadow-md outline-none focus:ring-2 focus:ring-blue-500
          ${
            msg.isMine
              ? "bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800"
              : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
          }
        `}
        onClick={() => {
          router.push(`/docs/${msg.documentId}`);
        }}
      >
        {/* Icon Box */}
        <div
          className={`p-2.5 rounded-lg flex-shrink-0 ${
            msg.isMine
              ? "bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          <DocumentIcon className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4
            className={`text-sm font-semibold truncate mb-0.5 ${
              msg.isMine
                ? "text-blue-900 dark:text-blue-100"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {msg.content || t("docs.untitled", "Untitled Document")}
          </h4>
          <div className="flex items-center justify-between">
            <p
              className={`text-xs truncate ${
                msg.isMine
                  ? "text-blue-700/80 dark:text-blue-200/70"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {t("docs.click_to_open", "Click to open")}
            </p>
            <ArrowTopRightOnSquareIcon
              className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                msg.isMine
                  ? "text-blue-600 dark:text-blue-300"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            />
          </div>
        </div>
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

function CallMessageBubble({
  msg,
  isSameSenderAsPrev,
  isSameSenderAsNext,
  callHistory,
}: Readonly<{
  msg: MessageType;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  callHistory: CallHistoryType;
}>) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const totalMembers = callHistory.members.length;
  const isGroupCall = totalMembers > 2;
  const isVideoCall = callHistory.call_type === "video";

  const currentUser = callHistory.members.find(
    (member) => member.id === user?.id
  );
  const otherUser = callHistory.members.find(
    (member) => member.id !== user?.id
  );
  const isCaller = currentUser?.is_caller;

  // Determine status
  let statusLabel = t("call.status.ended", "Cuộc gọi đã kết thúc");
  let statusColor = "text-gray-500 dark:text-gray-400";
  let iconColor =
    "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";

  const myStatus = currentUser?.status;
  const otherStatus = otherUser?.status;

  if (["initiated", "started", "pending"].includes(myStatus || "")) {
    statusLabel = t("call.status.waiting", "Đang chờ...");
    statusColor = "text-yellow-600 dark:text-yellow-400";
    iconColor =
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400";
  } else if (["started", "accepted"].includes(otherStatus || "")) {
    statusLabel = t("call.status.ongoing", "Đang diễn ra");
    statusColor = "text-green-600 dark:text-green-400";
    iconColor =
      "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
  } else if (
    myStatus === "missed" ||
    myStatus === "rejected" ||
    (isCaller && otherStatus === "missed")
  ) {
    statusLabel = t("call.status.missed", "Cuộc gọi nhỡ");
    statusColor = "text-red-600 dark:text-red-400";
    iconColor = "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  } else if (myStatus === "cancelled") {
    statusLabel = t("call.status.cancelled", "Đã hủy");
  }

  let title = t("call.type.voice", "Voice Call");
  if (isGroupCall) {
    title = t("call.type.group", "Cuộc gọi nhóm");
  } else if (isVideoCall) {
    title = t("call.type.video", "Video Call");
  }

  const subtitle = isGroupCall
    ? t("call.members_count", {
        count: totalMembers - 1,
        defaultValue: `với ${totalMembers - 1} người khác`,
      })
    : otherUser?.fullname || t("common.unknown_user", "Người dùng");

  return (
    <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
      <div
        className={`
        relative p-3 rounded-2xl shadow-sm border flex items-center gap-3
        ${
          msg.isMine
            ? "bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800"
            : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
        }
      `}
      >
        {/* Icon Box */}
        <div className={`p-2.5 rounded-full flex-shrink-0 ${iconColor}`}>
          {isVideoCall ? (
            <VideoCameraIcon className="w-5 h-5" />
          ) : (
            <PhoneIcon className="w-5 h-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4
            className={`font-semibold text-sm truncate ${
              msg.isMine
                ? "text-blue-900 dark:text-blue-100"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {title}
          </h4>
          <p
            className={`text-xs truncate mb-0.5 ${
              msg.isMine
                ? "text-blue-700/80 dark:text-blue-200/70"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {subtitle}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
            {callHistory.duration > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {Helpers.formatDuration(callHistory.duration)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageBubble({
  msg,
  isSameSenderAsPrev,
  isSameSenderAsNext,
  isExpanded,
  onToggleExpanded,
  type,
  callHistory,
}: Readonly<MessageBubbleProps>) {
  if (msg.hiddenByMe) {
    return <DeletedMessageBubble isMine={msg.isMine} />;
  }

  if (msg.isDeleted) {
    return <RecalledMessageBubble isMine={msg.isMine} />;
  }

  if (msg.type === "document") {
    return <DocumentMessageBubble msg={msg} />;
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

  if (type === "call" && callHistory) {
    return (
      <CallMessageBubble
        msg={msg}
        isSameSenderAsPrev={isSameSenderAsPrev}
        isSameSenderAsNext={isSameSenderAsNext}
        callHistory={callHistory}
      />
    );
  }

  return null;
}
