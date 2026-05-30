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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Spinner,
} from "@heroui/react";
import { FlashcardConfigModal } from "@/components/flash-card/modals/FlashcardConfigModal";
import { useState } from "react";
import { MessageType } from "@/store/types/message.state";
import { EMOJIS } from "../constants/messageConstants";
import { canRecallMessage } from "../../../utils/messageHelpers";
import { useTranslation } from "react-i18next";

const TRANSLATE_LANGUAGE_OPTIONS = [
  { code: "auto", label: "Tự động nhận diện" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
] as const;
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
  readonly onTranslate?: (
    msg: MessageType,
    targetLanguage?: string,
    sourceLanguage?: string,
  ) => void;
  readonly onSummarize?: (msg: MessageType) => void;
  readonly onTranslateProgress?: (state: {
    isLoading: boolean;
    text: string;
  }) => void;
  readonly onSummarizeProgress?: (state: {
    isLoading: boolean;
    text: string;
  }) => void;
  readonly noAction?: boolean;
  readonly isMine: boolean;
  readonly hiddenByMe: boolean;
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
  onTranslateProgress,
  onSummarizeProgress,
  noAction = false,
  isMine,
  hiddenByMe,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isTranslateModalOpen, setIsTranslateModalOpen] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("vi");

  const canTranslate = msg.type === "text" && !!onTranslate;
  const canSummarize =
    !!onSummarize &&
    (msg.type === "document" || (msg.attachments?.length ?? 0) > 0);
  const hasUsableAttachment =
    (msg.attachments || []).some((a) => Boolean(a.uploadedUrl || a.url));
  const canGenerateFlashcard =
    msg.type === "document" || hasUsableAttachment;

  const handleTranslate = async () => {
    if (!onTranslate) return;
    setIsTranslateModalOpen(false);
    try {
      setIsTranslating(true);
      onTranslateProgress?.({
        isLoading: true,
        text: "Đang gửi yêu cầu dịch...",
      });
      await Promise.resolve();
      onTranslateProgress?.({
        isLoading: true,
        text: `Đang dịch ${sourceLanguage === "auto" ? "tự động nhận diện" : sourceLanguage} -> ${targetLanguage}...`,
      });
      await onTranslate(msg, targetLanguage, sourceLanguage);
      onTranslateProgress?.({
        isLoading: false,
        text: "Đã hoàn tất dịch.",
      });
    } finally {
      setIsTranslating(false);
      setTimeout(() => {
        onTranslateProgress?.({ isLoading: false, text: "" });
      }, 1200);
    }
  };

  const handleSummarize = async () => {
    if (!onSummarize) return;
    try {
      setIsSummarizing(true);
      onSummarizeProgress?.({
        isLoading: true,
        text: "Đang gửi yêu cầu tóm tắt...",
      });
      await Promise.resolve();
      onSummarizeProgress?.({
        isLoading: true,
        text: "AI đang đọc tài liệu và tóm tắt nội dung...",
      });
      await onSummarize(msg);
      onSummarizeProgress?.({
        isLoading: false,
        text: "Đã tóm tắt xong tài liệu.",
      });
    } finally {
      setIsSummarizing(false);
      setTimeout(() => {
        onSummarizeProgress?.({ isLoading: false, text: "" });
      }, 1200);
    }
  };
  // Actions are hidden for deleted/hidden messages, or if the message is not yet successfully sent (pending, uploading, failed)
  const isPendingOrFailed =
    msg.status === "pending" ||
    msg.status === "uploading" ||
    msg.status === "failed";

  if (msg.isDeleted || hiddenByMe || isPendingOrFailed) return null;

  return (
    <>
    <div
      className={`gap-3 flex justify-end items-center ${
        isMine ? "" : "flex-row-reverse"
      }`}
    >
      <div
        className={`flex gap-2 items-center ${
          isMine ? "" : "flex-row-reverse"
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
                onPress={() => setIsTranslateModalOpen(true)}
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
            {canGenerateFlashcard ? (
              <DropdownItem
                key="generate-flashcard"
                onPress={() => setIsConfigModalOpen(true)}
              >
                Tạo flashcard
              </DropdownItem>
            ) : null}
            {/* Actions limited to messages created by me */}
            {isMine ? (
              <>
                {/* Nếu trong 30 phút → cho thu hồi (recall) */}
                {canRecallMessage(msg, isMine) ? (
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

    <FlashcardConfigModal
      isOpen={isConfigModalOpen}
      msg={msg}
      onClose={() => setIsConfigModalOpen(false)}
    />

    <Modal isOpen={isTranslateModalOpen} onClose={() => setIsTranslateModalOpen(false)} placement="center">
      <ModalContent>
        <ModalHeader>Dịch tin nhắn</ModalHeader>
        <ModalBody className="space-y-3">
          <Select
            label="Ngôn ngữ tin nhắn"
            selectedKeys={new Set([sourceLanguage])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              if (selected) setSourceLanguage(selected);
            }}
          >
            {TRANSLATE_LANGUAGE_OPTIONS.map((lang) => (
              <SelectItem key={lang.code}>{lang.label}</SelectItem>
            ))}
          </Select>
          <Select
            label="Ngôn ngữ đích"
            selectedKeys={new Set([targetLanguage])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              if (selected) setTargetLanguage(selected);
            }}
          >
            {TRANSLATE_LANGUAGE_OPTIONS.map((lang) => (
              <SelectItem key={lang.code}>{lang.label}</SelectItem>
            ))}
          </Select>

        </ModalBody>
        <ModalFooter>
          <Button
            variant="light"
            onPress={() => setIsTranslateModalOpen(false)}
            isDisabled={isTranslating}
          >
            Hủy
          </Button>
          <Button color="primary" onPress={handleTranslate} isLoading={isTranslating}>
            Dịch
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
    </>
  );
}
