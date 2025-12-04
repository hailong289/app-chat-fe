import { Avatar, Button, Tooltip } from "@heroui/react";
import { motion } from "framer-motion";
import { formatMessageTime } from "@/libs/timeline-helpers";
import { CompactFileGallery } from "../CompactFileGallery";
import { MessageBubble } from "./MessageBubble";
import { MessageActions } from "./MessageActions";
import { MessageReactions } from "./MessageReactions";
import { ReplyPreview } from "./ReplyPreview";
import { MessageType } from "@/store/types/message.state";

interface MessageItemProps {
  msg: MessageType;
  prevMsg: MessageType | null;
  nextMsg: MessageType | null;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showAvatar: boolean;
  messageSpacing: string;
  shouldAnimate: boolean;
  isNewMessage: boolean;
  isExpanded: boolean;
  isUnreadDivider: boolean;
  lastMsgId: string;
  chatId: string;
  socket: any;
  noAction?: boolean;
  onToggleExpanded: (id: string) => void;
  onReply: (msg: MessageType) => void;
  onReact: (msg: MessageType, emoji: string) => void;
  onDelete: (msg: MessageType) => void;
  onRecall: (msg: MessageType) => void;
  onTogglePin: (msg: MessageType) => void;
  onCopy: (content: string) => void;
  onJumpToMessage: (id: string) => void;
  setMessageRef: (id: string) => (el: HTMLElement | null) => void;
  messageState: any;
}

export function MessageItem({
  msg,
  prevMsg,
  nextMsg,
  isFirstInGroup,
  isLastInGroup,
  showAvatar,
  messageSpacing,
  shouldAnimate,
  isNewMessage,
  isExpanded,
  isUnreadDivider,
  lastMsgId,
  chatId,
  socket,
  noAction,
  onToggleExpanded,
  onReply,
  onReact,
  onDelete,
  onRecall,
  onTogglePin,
  onCopy,
  onJumpToMessage,
  setMessageRef,
  messageState,
}: Readonly<MessageItemProps>) {
  const isSameSenderAsPrev = prevMsg?.sender._id === msg.sender._id;
  const isSameSenderAsNext = nextMsg?.sender._id === msg.sender._id;
  const shouldAnimateThis = shouldAnimate && isNewMessage;

  // Small helper that renders the "Tin chưa đọc" divider
  const UnreadDivider = () => {
    if (!(isUnreadDivider && !msg.isRead && !msg.isMine)) return null;
    return (
      <motion.div
        initial={shouldAnimate ? { opacity: 0, scale: 0.8 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: shouldAnimate ? 0.4 : 0,
          ease: "easeOut",
        }}
        className="flex items-center gap-3 my-6"
      >
        <motion.div
          initial={shouldAnimate ? { width: 0 } : false}
          animate={{ width: "100%" }}
          transition={{
            duration: shouldAnimate ? 0.6 : 0,
            delay: shouldAnimate ? 0.2 : 0,
          }}
          className="flex-1 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent"
        ></motion.div>
        <motion.span
          initial={shouldAnimate ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={
            shouldAnimate
              ? {
                  duration: 0.4,
                  delay: 0.3,
                  type: "spring",
                  stiffness: 200,
                }
              : { duration: 0 }
          }
          className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg"
        >
          ✨ Tin chưa đọc
        </motion.span>
        <motion.div
          initial={shouldAnimate ? { width: 0 } : false}
          animate={{ width: "100%" }}
          transition={{
            duration: shouldAnimate ? 0.6 : 0,
            delay: shouldAnimate ? 0.2 : 0,
          }}
          className="flex-1 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent"
        ></motion.div>
      </motion.div>
    );
  };

  // Renders small read avatars + overflow count
  const ReadAvatars = ({ reads, count }: { reads?: any[]; count?: number }) => {
    if (!reads || (count ?? 0) <= 0) return null;
    return (
      <div className="flex gap-1 items-end mb-1">
        {(reads || []).slice(0, 3).map((read_by: any) => (
          <Tooltip
            key={read_by.user.id}
            content={read_by.user.fullname || "User"}
            size="sm"
          >
            <Avatar
              src={read_by.user.avatar || undefined}
              className="w-3 h-3 ring-2 ring-white"
              name={read_by.user.fullname || "User"}
            />
          </Tooltip>
        ))}
        {(count ?? 0) > 3 && (
          <span className="text-xs text-gray-400 ml-1">
            +{Math.max((count ?? 0) - 3, 0)}
          </span>
        )}
      </div>
    );
  };

  // Avatar slot component to avoid duplicating markup
  const AvatarSlot = ({ side }: { side: "left" | "right" }) => {
    if (side === "left" && msg.isMine) return null;
    if (side === "right" && !msg.isMine) return null;
    return (
      <div className="w-8 flex-shrink-0">
        {showAvatar ? (
          <Avatar
            src={msg.sender.avatar || undefined}
            name={msg.sender.fullname || "User"}
            size="sm"
            className="w-8 h-8"
            isBordered
          />
        ) : (
          <div className="w-8 h-8"></div>
        )}
      </div>
    );
  };

  // Timestamp + resend/status UI
  const TimestampAndStatus = () => {
    if (!showAvatar) return null;
    return (
      <div
        className={`flex items-center gap-1 mt-1 ${
          msg.isMine ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {msg.status === "failed" && msg.isMine && (
          <Button
            size="sm"
            color="danger"
            variant="flat"
            startContent={<span className="text-xs">⚠️</span>}
            onPress={() => {
              messageState.resendMessage(chatId, msg.id, socket);
            }}
            className="text-xs h-6 min-w-0 px-2"
          >
            Gửi lại
          </Button>
        )}

        <span className="text-xs text-gray-400">
          {formatMessageTime(msg.createdAt)}
        </span>
        {msg.isMine && msg.status !== "failed" && (
          <span className="text-xs text-gray-400">
            {(msg.read_by_count ?? 0) > 0 ? (
              <Tooltip content="Đã xem" size="sm" placement="left-start">
                ✓✓
              </Tooltip>
            ) : (
              <Tooltip content="Đã gửi" size="sm" placement="left-start">
                ✓
              </Tooltip>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <motion.div
      key={msg.id}
      initial={
        shouldAnimateThis
          ? {
              opacity: 0,
              x: msg.isMine ? 20 : -20,
              scale: 0.95,
            }
          : false
      }
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={shouldAnimateThis ? { opacity: 0, scale: 0.95 } : undefined}
      transition={{
        duration: shouldAnimateThis ? 0.2 : 0,
        ease: "easeOut",
      }}
      className={messageSpacing}
    >
      <UnreadDivider />

      <fieldset
        ref={setMessageRef(msg.id)}
        className={`flex items-end gap-2 group ${
          msg.isMine ? "justify-end" : "justify-start"
        }`}
        data-mid={msg.id}
      >
        {/* Read avatars cho tin của mình (bên trái bubble) */}
        {isLastInGroup && msg.isMine && (
          <ReadAvatars reads={msg.read_by} count={msg.read_by_count} />
        )}

        <div
          className={`flex w-full items-end gap-2 group ${
            msg.isMine ? "justify-end" : "justify-start"
          }`}
        >
          {/* Avatar bên trái (tin người khác) */}
          <AvatarSlot side="left" />

          {/* Message bubble */}
          <div
            className={`flex flex-col max-w-md ${
              msg.isMine ? "items-end" : "items-start"
            }`}
          >
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
                <MessageActions
                  noAction={noAction}
                  msg={msg}
                  socket={socket}
                  chatId={chatId}
                  onReply={onReply}
                  onReact={onReact}
                  onDelete={onDelete}
                  onRecall={onRecall}
                  onTogglePin={onTogglePin}
                  onCopy={onCopy}
                />
              </div>

              <div
                className={`flex flex-col ${
                  msg.isMine ? "items-end" : "items-start"
                }`}
              >
                {/* Reply preview */}
                {!msg.isDeleted && msg.status !== "recalled" && msg.reply && (
                  <ReplyPreview reply={msg.reply} onJump={onJumpToMessage} />
                )}

                {/* Tên người gửi */}
                {!msg.isMine && !isSameSenderAsPrev && (
                  <span className="text-xs text-gray-500 mb-1 ml-3 font-medium">
                    {msg.sender.fullname || "User"}
                  </span>
                )}

                {/* Attachments */}
                {!msg.isDeleted &&
                  msg.attachments &&
                  msg.attachments.length > 0 && (
                    <div className="mb-2">
                      <CompactFileGallery
                        files={msg.attachments}
                        maxDisplay={2}
                        className="w-full"
                      />
                    </div>
                  )}

                {/* Content bubble */}
                <MessageBubble
                  msg={msg}
                  isSameSenderAsPrev={isSameSenderAsPrev}
                  isSameSenderAsNext={isSameSenderAsNext}
                  isExpanded={isExpanded}
                  onToggleExpanded={onToggleExpanded}
                  type={msg.type}
                  callHistory={msg.call_history ?? null}
                />

                {/* Reactions display */}
                {!msg.isDeleted &&
                  msg.status !== "recalled" &&
                  msg.reactions &&
                  msg.reactions.length > 0 && (
                    <MessageReactions reactions={msg.reactions} />
                  )}
              </div>
            </div>

            {/* Timestamp - chỉ hiện ở tin cuối nhóm */}
            <TimestampAndStatus />
          </div>

          {/* Avatar bên phải (tin của mình) */}
          <AvatarSlot side="right" />
        </div>

        {/* Read avatars for other people's last message */}
        {!msg.isMine && msg.id === lastMsgId && (
          <ReadAvatars reads={msg.read_by} count={msg.read_by_count} />
        )}
      </fieldset>
    </motion.div>
  );
}
