import {
  EllipsisVerticalIcon,
  ArrowUturnLeftIcon,
  FaceSmileIcon,
} from "@heroicons/react/16/solid";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { useState } from "react";
import { MessageType } from "@/store/types/message.state";
import { EMOJIS } from "../constants/messageConstants";
import { canRecallMessage } from "../../../utils/messageHelpers";
import { useTranslation } from "react-i18next";

interface MessageActionsProps {
  readonly msg: MessageType;
  readonly socket: any;
  readonly chatId: string;
  readonly onReply: (msg: MessageType) => void;
  readonly onReact: (msg: MessageType, emoji: string) => void;
  readonly onDelete: (msg: MessageType) => void;
  readonly onRecall: (msg: MessageType) => void;
  readonly onTogglePin: (msg: MessageType) => void;
  readonly onCopy: (content: string) => void;
  readonly onTranslate?: (msg: MessageType) => void;
  readonly onSummarize?: (msg: MessageType) => void;
  readonly noAction?: boolean;
}

export function MessageActions({
  msg,
  socket,
  chatId,
  onReply,
  onReact,
  onDelete,
  onRecall,
  onTogglePin,
  onCopy,
  onTranslate,
  onSummarize,
  noAction = false,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const canTranslate = msg.type === "text" && !!onTranslate;
  const summarizableMime = (
    msg.attachments || []
  ).some((att) => {
    const mime = att.mimeType || "";
    return (
      mime.startsWith("application/pdf") ||
      mime.startsWith("application/msword") ||
      mime.startsWith("application/vnd.openxmlformats-officedocument") ||
      mime.startsWith("application/vnd.ms-powerpoint") ||
      mime.startsWith("application/vnd.openxmlformats-officedocument.presentationml") ||
      mime.startsWith("text/")
    );
  });

  const canSummarize = !!onSummarize && summarizableMime && msg.type !== "document";

  const handleTranslate = async () => {
    if (!onTranslate) return;
    try {
      setIsTranslating(true);
      await onTranslate(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSummarize = async () => {
    if (!onSummarize) return;
    try {
      setIsSummarizing(true);
      await onSummarize(msg);
    } finally {
      setIsSummarizing(false);
    }
  };
  // Actions are hidden for deleted/hidden messages
  if (msg.isDeleted || msg.hiddenByMe) return null;

  return (
    <div
      className={`gap-3 flex justify-end items-center ${
        msg.isMine ? "" : "flex-row-reverse"
      }`}
    >
      <div
        className={`flex gap-2 items-center ${
          msg.isMine ? "" : "flex-row-reverse"
        }`}
      >
        <Dropdown backdrop="blur">
          <DropdownTrigger>
            <Button
              className="
                p-0 rounded-full 
                text-gray-400 dark:text-gray-300
                opacity-0 group-hover:opacity-100 
                transition-opacity duration-200
                hover:bg-gray-100 dark:hover:bg-gray-800
              "
              size="sm"
              variant="flat"
              isIconOnly
            >
              <EllipsisVerticalIcon className="h-3 w-3" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Static Actions" variant="faded">
            {noAction ? null : (
              <DropdownItem key="gim" onPress={() => onTogglePin(msg)}>
                {msg.pinned
                  ? t("chat.messages.actions.unpin")
                  : t("chat.messages.actions.pin")}
              </DropdownItem>
            )}
            {/* Copy - chỉ hiện với text messages */}
            {msg.type === "text" ? (
              <DropdownItem
                key="copy"
                onPress={() => onCopy(msg.content || "")}
              >
                {t("chat.messages.actions.copy")}
              </DropdownItem>
            ) : null}
            {canTranslate ? (
              <DropdownItem
                key="translate"
                onPress={handleTranslate}
                isDisabled={isTranslating}
              >
                {isTranslating
                  ? t("chat.messages.actions.translating", "Đang dịch...")
                  : t("chat.messages.actions.translate", "Dịch nội dung")}
              </DropdownItem>
            ) : null}
            {canSummarize ? (
              <DropdownItem
                key="summarize"
                onPress={handleSummarize}
                isDisabled={isSummarizing}
              >
                {isSummarizing
                  ? t("chat.messages.actions.summarizing", "Đang tóm tắt...")
                  : t("chat.messages.actions.summarize", "Tóm tắt tài liệu")}
              </DropdownItem>
            ) : null}
            {/* Actions limited to messages created by me */}
            {msg.isMine ? (
              <>
                {/* Nếu trong 30 phút → cho thu hồi (recall) */}
                {canRecallMessage(msg) ? (
                  <DropdownItem
                    className="text-danger"
                    color="danger"
                    key="recall"
                    onPress={() => onRecall(msg)}
                  >
                    {t("chat.messages.actions.recall")}
                  </DropdownItem>
                ) : null}
              </>
            ) : null}
            <DropdownItem
              key="delete"
              className="text-danger"
              color="danger"
              onPress={() => onDelete(msg)}
            >
              {t("chat.messages.actions.deleteForMe")}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>

        {noAction ? null : (
          <Button
            className="
              p-0 rounded-full 
              text-gray-400 dark:text-gray-300
              opacity-0 group-hover:opacity-100 
              transition-opacity duration-200
              hover:bg-gray-100 dark:hover:bg-gray-800
            "
            size="sm"
            variant="flat"
            isIconOnly
            onPress={() => onReply(msg)}
          >
            <ArrowUturnLeftIcon className="h-3 w-3" />
          </Button>
        )}

        <Popover placement="top" backdrop="opaque">
          <PopoverTrigger>
            <Button
              className="
                p-0 rounded-full 
                text-gray-400 dark:text-gray-300
                opacity-0 group-hover:opacity-100 
                transition-opacity duration-200
                hover:bg-gray-100 dark:hover:bg-gray-800
              "
              size="sm"
              variant="flat"
              isIconOnly
            >
              <FaceSmileIcon className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="
              p-2 
              bg-white dark:bg-gray-900
              border border-gray-200 dark:border-gray-700
            "
          >
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 px-2">
                {t("chat.messages.actions.react")}
              </div>
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(msg, emoji)}
                    className="
                      text-2xl 
                      p-2 rounded-lg
                      hover:scale-125 
                      transition-transform duration-200
                      hover:bg-gray-100 dark:hover:bg-gray-700
                    "
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
