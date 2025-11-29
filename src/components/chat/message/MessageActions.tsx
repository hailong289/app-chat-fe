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
import { MessageType } from "@/store/types/message.state";
import { EMOJIS } from "../constants/messageConstants";
import { canRecallMessage } from "../../../utils/messageHelpers";

interface MessageActionsProps {
  msg: MessageType;
  socket: any;
  chatId: string;
  onReply: (msg: MessageType) => void;
  onReact: (msg: MessageType, emoji: string) => void;
  onDelete: (msg: MessageType) => void;
  onRecall: (msg: MessageType) => void;
  onTogglePin: (msg: MessageType) => void;
  onCopy: (content: string) => void;
  noAction?: boolean;
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
  noAction = false,
}: MessageActionsProps) {
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
                {msg.pinned ? "Bỏ gim" : "Gim"}
              </DropdownItem>
            )}
            {/* Copy - chỉ hiện với text messages */}
            {msg.type === "text" ? (
              <DropdownItem
                key="copy"
                onPress={() => onCopy(msg.content || "")}
              >
                Sao chép
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
                    Thu hồi
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
              Xoá chỉ ở phía tôi
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
                Thả cảm xúc
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
