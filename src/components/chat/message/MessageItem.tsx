import { Avatar, Button, Spinner, Tooltip } from "@heroui/react";
import { motion } from "framer-motion";
import { formatMessageTime } from "@/libs/timeline-helpers";
import { CompactFileGallery } from "../file/CompactFileGallery";
import { MessageBubble } from "./MessageBubble";
import { MessageActions } from "./MessageActions";
import { MessageReactions } from "./MessageReactions";
import { ReplyPreview } from "./ReplyPreview";
import { QuizMessageCard } from "./QuizMessageCard";
import { SystemMessageBubble } from "./SystemMessageBubble";
import { MessageType } from "@/store/types/message.state";
import { ArrowPathIcon, EyeDropperIcon } from "@heroicons/react/16/solid";
import { useTranslation } from "react-i18next";
import useAuthStore from "@/store/useAuthStore";

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
  renderedMessageIds?: React.MutableRefObject<Set<string>>;
  onToggleExpanded: (id: string) => void;
  onReply: (msg: MessageType) => void;
  onReact: (msg: MessageType, emoji: string) => void;
  onDelete: (msg: MessageType) => void;
  onRecall: (msg: MessageType) => void;
  onTogglePin: (msg: MessageType) => void;
  onCopy: (content: string) => void;
  onTranslate: (msg: MessageType) => void;
  onSummarize: (msg: MessageType) => void;
  onJumpToMessage: (id: string) => void;
  setMessageRef: (id: string) => (el: HTMLElement | null) => void;
  messageState: any;
}

import { memo, useEffect } from "react";
import isEqual from "react-fast-compare";

export const MessageItem = memo(
  function MessageItem({
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
    renderedMessageIds,
    onToggleExpanded,
    onReply,
    onReact,
    onDelete,
    onRecall,
    onTogglePin,
    onCopy,
    onTranslate,
    onSummarize,
    onJumpToMessage,
    setMessageRef,
    messageState,
  }: Readonly<MessageItemProps>) {
    const { t } = useTranslation();
    const currentUser = useAuthStore((state) => state.user);
    const currentUserId = currentUser?.id;
    console.log("🚀 ~ currentUser:", currentUser);
    const isMine = currentUserId ? msg.sender?.id === currentUserId : false;
    const hiddenByMe = currentUserId
      ? (msg.hiddenBy?.includes(currentUserId) ?? false)
      : false;

    useEffect(() => {
      if (renderedMessageIds && !renderedMessageIds.current.has(msg.id)) {
        renderedMessageIds.current.add(msg.id);
      }
    }, [msg.id, renderedMessageIds]);

    const isSameSenderAsPrev = prevMsg?.sender._id === msg.sender._id;
    const isSameSenderAsNext = nextMsg?.sender._id === msg.sender._id;
    const shouldAnimateThis =
      shouldAnimate && isNewMessage && !renderedMessageIds?.current.has(msg.id);

    const PinnedIcon = () => {
      return (
        <button
          className={`absolute top-2 ${
            isMine ? "right-4" : "left-4"
          } bg-blue-500 dark:bg-blue-400 rounded-full p-1 shadow-md hover:bg-blue-600 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-300 z-10`}
          onDoubleClick={() => onTogglePin(msg)}
        >
          <Tooltip content={t("chat.messages.item.pinned")} size="sm">
            <EyeDropperIcon className="w-3 h-3 text-white" />
          </Tooltip>
        </button>
      );
    };

    // Custom pinned icon if needed logic check uses isMine which is available in scope
    // The PinnedIcon component was accessing isMine correctly as long as it's defined in outer scope

    // Small helper that renders the "Tin chưa đọc" divider
    const UnreadDivider = () => {
      if (!isUnreadDivider) return null;
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
            className="flex-1 h-px bg-linear-to-r from-transparent via-red-400 dark:via-red-500 to-transparent"
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
            className="bg-linear-to-r from-red-500 to-pink-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg"
          >
            ✨ {t("chat.messages.item.unread")}
          </motion.span>
          <motion.div
            initial={shouldAnimate ? { width: 0 } : false}
            animate={{ width: "100%" }}
            transition={{
              duration: shouldAnimate ? 0.6 : 0,
              delay: shouldAnimate ? 0.2 : 0,
            }}
            className="flex-1 h-px bg-linear-to-r from-transparent via-red-400 dark:via-red-500 to-transparent"
          ></motion.div>
        </motion.div>
      );
    };

    // Renders small read avatars + overflow count
    const ReadAvatars = ({
      reads,
      count,
    }: {
      reads?: any[];
      count?: number;
    }) => {
      console.log("🚀 ~ ReadAvatars ~ reads:", reads);
      if (!reads || (count ?? 0) <= 0) return null;
      return (
        <div className="flex gap-1 items-end mb-1">
          {(reads || []).slice(0, 3).map((read_by: any) => (
            <Tooltip
              key={read_by.user.id}
              content={`${read_by.user.fullname || "User"} • ${formatMessageTime(read_by.readAt)}`}
              size="sm"
            >
              <Avatar
                src={read_by.user.avatar || undefined}
                className="w-3 h-3 ring-2 ring-white dark:ring-gray-800"
                name={read_by.user.fullname || "User"}
              />
            </Tooltip>
          ))}
          {(count ?? 0) > 3 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
              +{Math.max((count ?? 0) - 3, 0)}
            </span>
          )}
        </div>
      );
    };

    // Avatar slot component to avoid duplicating markup
    const AvatarSlot = ({ side }: { side: "left" | "right" }) => {
      if (side === "left" && isMine) return null;
      if (side === "right" && !isMine) return null;
      return (
        <div className="w-8 shrink-0">
          {showAvatar ? (
            <Avatar
              src={msg.sender.avatar || undefined}
              name={msg.sender.fullname || "User"}
              size="sm"
              className="w-8 h-8"
              isBordered
            />
          ) : (
            <div className="w-8 h-8" />
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
            isMine ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {msg.status === "failed" && isMine && (
            <Button
              size="sm"
              color="danger"
              variant="flat"
              startContent={<ArrowPathIcon className="w-4 h-4" />}
              onPress={() => {
                messageState.resendMessage(chatId, msg.id, socket);
              }}
              className="text-xs h-6 min-w-0 px-2"
            >
              {t("chat.messages.item.resend")}
            </Button>
          )}

          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatMessageTime(msg.createdAt)}
          </span>
          {isMine && msg.status === "sent" && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {/* Prefer read_by array length if available, fallback to count or 0 */}
              {(msg.read_by?.length ?? msg.read_by_count ?? 0) > 0 ? (
                <Tooltip
                  content={t("chat.messages.item.seen")}
                  size="sm"
                  placement="left-start"
                >
                  ✓✓
                </Tooltip>
              ) : (
                <Tooltip
                  content={t("chat.messages.item.sent")}
                  size="sm"
                  placement="left-start"
                >
                  ✓
                </Tooltip>
              )}
            </span>
          )}
          {isMine &&
            (msg.status === "pending" || msg.status === "uploading") && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center">
                <Tooltip
                  content={
                    msg.status === "pending"
                      ? ` ${t("chat.messages.item.sending")}`
                      : t("chat.messages.item.uploading")
                  }
                  size="sm"
                  placement="left-start"
                >
                  <span className="inline-flex items-center gap-1">
                    <Spinner size="sm" color="default" />
                  </span>
                </Tooltip>
              </span>
            )}
        </div>
      );
    };

    // System message — căn giữa, không avatar / không reactions / không actions.
    // Render trực tiếp thay vì đi qua wrapper (avatar slot, alignment) bên dưới.
    if (msg.type === "system" && !msg.isDeleted) {
      return (
        <div className={messageSpacing}>
          <motion.div
            layout
            key={`msg-box-${msg.id}`}
            initial={shouldAnimateThis ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldAnimateThis ? { opacity: 0 } : undefined}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <UnreadDivider />
            <div ref={setMessageRef(msg.id)} data-mid={msg.id}>
              <SystemMessageBubble msg={msg} />
            </div>
          </motion.div>
        </div>
      );
    }

    // Quiz message — layout riêng, căn giữa
    if (msg.type === "quiz" && msg.quiz && !msg.isDeleted) {
      return (
        <div className={messageSpacing}>
          <motion.div
            layout
            key={`msg-box-${msg.id}`}
            initial={shouldAnimateThis ? { opacity: 0, y: 10, scale: 0.95 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldAnimateThis ? { opacity: 0, scale: 0.95 } : undefined}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <UnreadDivider />
            <div
              ref={setMessageRef(msg.id)}
              data-mid={msg.id}
              className="flex flex-col items-center gap-1.5 px-4 py-1"
            >
              <QuizMessageCard quiz={msg.quiz} currentUser={currentUser} isSender={isMine} roomId={chatId} />
              <span className="text-[11px] text-default-400">
                {msg.sender.fullname} • {formatMessageTime(msg.createdAt)}
              </span>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className={messageSpacing}>
        <motion.div
          layout
          key={`msg-box-${msg.id}`}
          initial={
            shouldAnimateThis
              ? {
                  opacity: 0,
                  x: isMine ? 20 : -20,
                  scale: 0.95,
                }
              : false
          }
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={shouldAnimateThis ? { opacity: 0, scale: 0.95 } : undefined}
          transition={{
            layout: { duration: 0.2, ease: "easeOut" },
            opacity: { duration: 0.2 },
            default: { duration: 0.2, ease: "easeOut" },
          }}
        >
          <UnreadDivider />

          <fieldset
            ref={setMessageRef(msg.id)}
            className={`relative flex items-end gap-2 group ${
              isMine ? "justify-end" : "justify-start"
            }`}
            data-mid={msg.id}
          >
            {/* Pinned icon */}
            {!(currentUserId && msg.hiddenBy?.includes(currentUserId)) &&
              !msg.isDeleted &&
              msg.pinned && <PinnedIcon />}

            {/* Read avatars cho tin của mình (bên trái bubble) */}
            {isLastInGroup && isMine && (
              <ReadAvatars reads={msg.read_by} count={msg.read_by_count} />
            )}

            <div
              className={`flex w-full items-end gap-2 group ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >
              {/* Avatar bên trái (tin người khác) */}
              <AvatarSlot side="left" />

              {/* Message bubble */}
              <div
                className={`flex flex-col max-w-md ${
                  isMine ? "items-end" : "items-start"
                }`}
              >
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
                      onTranslate={onTranslate}
                      onSummarize={onSummarize}
                      isMine={isMine}
                      hiddenByMe={hiddenByMe}
                    />
                  </div>

                  <div
                    className={`flex flex-col ${
                      isMine ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Reply preview */}
                    {!msg.isDeleted &&
                      msg.status !== "recalled" &&
                      msg.reply && (
                        <ReplyPreview
                          reply={msg.reply}
                          onJump={onJumpToMessage}
                        />
                      )}

                    {/* Tên người gửi */}
                    {!isMine && !isSameSenderAsPrev && (
                      <span className="text-xs text-gray-500 dark:text-gray-300 mb-1 ml-3 font-medium">
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
                      type={msg.type as any}
                      callHistory={msg.call_history ?? null}
                      isMine={isMine}
                      hiddenByMe={hiddenByMe}
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
            {!isMine && msg.id === lastMsgId && (
              <ReadAvatars reads={msg.read_by} count={msg.read_by_count} />
            )}
          </fieldset>
        </motion.div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    // We ignore handlers and refs as they should be stable or don't affect render output directly

    if (
      prevProps.isFirstInGroup !== nextProps.isFirstInGroup ||
      prevProps.isLastInGroup !== nextProps.isLastInGroup ||
      prevProps.showAvatar !== nextProps.showAvatar ||
      prevProps.messageSpacing !== nextProps.messageSpacing ||
      prevProps.shouldAnimate !== nextProps.shouldAnimate ||
      prevProps.isNewMessage !== nextProps.isNewMessage ||
      prevProps.isExpanded !== nextProps.isExpanded ||
      prevProps.isUnreadDivider !== nextProps.isUnreadDivider ||
      prevProps.lastMsgId !== nextProps.lastMsgId ||
      prevProps.chatId !== nextProps.chatId ||
      prevProps.noAction !== nextProps.noAction
    ) {
      return false;
    }

    // Compare message content deeply if references change
    if (prevProps.msg !== nextProps.msg) {
      if (!isEqual(prevProps.msg, nextProps.msg)) return false;
    }

    // Check neighbors context (only sender ID matters for rendering groups)
    if (prevProps.prevMsg?.sender._id !== nextProps.prevMsg?.sender._id)
      return false;
    if (prevProps.nextMsg?.sender._id !== nextProps.nextMsg?.sender._id)
      return false;

    return true;
  },
);
