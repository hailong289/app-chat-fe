import { EyeDropperIcon, DocumentIcon, PhoneIcon, VideoCameraIcon, UserIcon, UsersIcon } from "@heroicons/react/16/solid";
import { LinkPreview } from "./LinkPreview";
import { extractFirstUrl } from "@/libs/url-helpers";
import { MAX_MESSAGE_LENGTH } from "../constants/messageConstants";
import { CallHistoryType, MessageType } from "@/store/types/message.state";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import Helpers from "@/libs/helpers";
import useAuthStore from "@/store/useAuthStore";

interface MessageBubbleProps {
  msg: MessageType;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  type: "text" | "image" | "file" | "system" | "video" | "audio" | "gif" | "call"
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
    <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
      <div
        className={`
          relative p-3 rounded-2xl shadow-sm flex items-center gap-3 cursor-pointer
          transition-colors border
          ${
            msg.isMine
              ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
              : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
          }
        `}
        onClick={() => {
          router.push(`/docs/${msg.documentId}`);
        }}
      >
        <div
          className={`p-2 rounded-lg ${
            msg.isMine
              ? "bg-blue-100 dark:bg-blue-800"
              : "bg-gray-100 dark:bg-gray-700"
          }`}
        >
          <DocumentIcon
            className={`w-6 h-6 ${
              msg.isMine
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              msg.isMine
                ? "text-blue-900 dark:text-blue-100"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {msg.content || t("documents.untitled", "Untitled Document")}
          </p>
          <p
            className={`text-xs truncate ${
              msg.isMine
                ? "text-blue-700 dark:text-blue-300"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {t("documents.click_to_open", "Click to open")}
          </p>
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
  const { user } = useAuthStore();
  const totalMembers = callHistory.members.length;
  const isGroupCall = totalMembers > 2;
  const isVideoCall = callHistory.call_type === "video";
  const callTypeLabel = isVideoCall ? "video" : "gọi thoại";
  const currentUser = callHistory.members.find((member) => member.id === user?.id);
  const otherUser = callHistory.members.find((member) => member.id !== user?.id);
  const isCaller = currentUser?.is_caller === true ? true : false;
  let status = "Đã kết thúc";
  if (["initiated", "started", "pending"].includes(currentUser?.status || "")) {
    status = "Đang chờ";
  } else if (["started", "accepted"].includes(otherUser?.status || "")) {
    status = "Đang diễn ra";
  } else if (currentUser?.status === "ended") {
    status = isCaller ? "Bạn đã kết thúc cuộc gọi" : "Cuộc gọi đã kết thúc";
  } else if (currentUser?.status === "cancelled") {
    status = isCaller ? "Bạn đã hủy cuộc gọi" : "Cuộc gọi đã bị hủy";
  } else if (currentUser?.status === "rejected") {
    status = isCaller ? "Bạn đã từ chối cuộc gọi" : "Cuộc gọi đã bị từ chối";
  }

  return (
    <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
      <div className={getBubbleClasses(msg, isSameSenderAsPrev, isSameSenderAsNext)}>
        {isGroupCall ? (
          <div className="flex items-center">
            <UsersIcon className="w-4 h-4 inline-block mr-2 text-green-500" />
            <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              Cuộc gọi nhóm với {totalMembers - 1} người khác
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center border-b border-gray-200 pb-2">
              <UserIcon className="w-4 h-4 inline-block mr-2 text-green-500" />
              <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {`Cuộc gọi ${callTypeLabel} với ${otherUser?.fullname}`}
              </span>
            </div>
            <div className="flex items-center pt-2">
              {isVideoCall ? <VideoCameraIcon className="w-4 h-4 inline-block mr-2 text-green-500" /> : <PhoneIcon className="w-4 h-4 inline-block mr-2 text-green-500" />}
              <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {status}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                Thời gian: {Helpers.formatDuration(callHistory.duration)}
              </span>
            </div>
          </>
        )}
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
    return <CallMessageBubble msg={msg} isSameSenderAsPrev={isSameSenderAsPrev} isSameSenderAsNext={isSameSenderAsNext} callHistory={callHistory} />;
  }


  return null;
}
