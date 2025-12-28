import { Avatar, Button, Spinner, Tooltip } from "@heroui/react";
import { motion } from "framer-motion";
import { formatMessageTime } from "@/libs/timeline-helpers";
import { CompactFileGallery } from "../file/CompactFileGallery";
import { MessageBubble } from "./MessageBubble";
import { MessageActions } from "./MessageActions";
import { MessageReactions } from "./MessageReactions";
import { ReplyPreview } from "./ReplyPreview";
import { MessageType } from "@/store/types/message.state";
import { ArrowPathIcon, EyeDropperIcon } from "@heroicons/react/16/solid";
import { useTranslation } from "react-i18next";

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

import { memo, useEffect, useState } from "react";

export const MessageItem = memo(function MessageItem({
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
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<string>>(
    () => new Set()
  );

  const toggleSummaryExpanded = (id: string) => {
    setExpandedSummaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (renderedMessageIds && !renderedMessageIds.current.has(msg.id)) {
      renderedMessageIds.current.add(msg.id);
    }
  }, [msg.id, renderedMessageIds]);

  const isSameSenderAsPrev = prevMsg?.sender._id === msg.sender._id;
  const isSameSenderAsNext = nextMsg?.sender._id === msg.sender._id;
  const shouldAnimateThis = shouldAnimate && isNewMessage;
  const isAiProcessing = !!msg.aiProcessing;

  const PinnedIcon = () => {
    return (
      <button
        className={`absolute top-2 ${
          msg.isMine ? "right-4" : "left-4"
        } bg-blue-500 dark:bg-blue-400 rounded-full p-1 shadow-md hover:bg-blue-600 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-300 z-10`}
        onDoubleClick={() => onTogglePin(msg)}
      >
        <Tooltip content={t("chat.messages.item.pinned")} size="sm">
          <EyeDropperIcon className="w-3 h-3 text-white" />
        </Tooltip>
      </button>
    );
  };

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
          className="flex-1 h-px bg-gradient-to-r from-transparent via-red-400 dark:via-red-500 to-transparent"
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
          ✨ {t("chat.messages.item.unread")}
        </motion.span>
        <motion.div
          initial={shouldAnimate ? { width: 0 } : false}
          animate={{ width: "100%" }}
          transition={{
            duration: shouldAnimate ? 0.6 : 0,
            delay: shouldAnimate ? 0.2 : 0,
          }}
          className="flex-1 h-px bg-gradient-to-r from-transparent via-red-400 dark:via-red-500 to-transparent"
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
          msg.isMine ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {msg.status === "failed" && msg.isMine && (
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
        {msg.isMine && msg.status === "sent" && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {(msg.read_by_count ?? 0) > 0 ? (
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
        {msg.isMine &&
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
        className={`relative flex items-end gap-2 group ${
          msg.isMine ? "justify-end" : "justify-start"
        }`}
        data-mid={msg.id}
      >
        {/* Pinned icon */}
        {!msg.hiddenByMe && !msg.isDeleted && msg.pinned && <PinnedIcon />}

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
          <div className="relative">
            {isAiProcessing ? (
              <div
                className={`pointer-events-none absolute -top-5 ${msg.isMine ? "right-10" : "left-10"} z-20 flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-blue-600 text-white shadow-md shadow-blue-500/30 animate-pulse`}
              >
                <span className="h-2 w-2 rounded-full bg-white animate-ping" aria-hidden />
                <span>{t("chat.messages.bubble.aiProcessing", "Đang xử lý AI")}</span>
              </div>
            ) : null}

            <div
              className={`relative flex flex-col max-w-md ${
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
                  onTranslate={onTranslate}
                  onSummarize={onSummarize}
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
                />

                {msg.summary && msg.type !== "document" ? (
                  <div className="mt-3 w-full max-w-md">
                    <div className="relative rounded-2xl bg-gradient-to-r from-fuchsia-500 via-blue-500 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
                      {(() => {
                        const maxChars = 120;
                        const isExpanded = expandedSummaryIds.has(msg.id);
                        const needsClamp = (msg.summary?.text?.length || 0) > maxChars;
                        const displayText =
                          isExpanded || !needsClamp
                            ? msg.summary.text
                            : msg.summary.text.slice(0, maxChars) + "...";
                        const keyPoints = msg.summary.keyPoints || [];
                        const visibleKeyPoints = isExpanded
                          ? keyPoints
                          : keyPoints.slice(0, 2);

                        return (
                          <div
                            className={`relative flex flex-col gap-2 rounded-[14px] px-4 py-3 text-sm backdrop-blur-sm ${
                              msg.isMine
                                ? "bg-blue-50/90 text-blue-900 dark:bg-blue-900/40 dark:text-blue-50"
                                : "bg-white text-gray-800 dark:bg-gray-900/80 dark:text-gray-100"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-fuchsia-500 via-blue-500 to-cyan-400" />
                                <span className="font-semibold text-xs uppercase tracking-wide">
                                  {t(
                                    "chat.messages.bubble.summaryTitle",
                                    "Tóm tắt tài liệu"
                                  )}
                                </span>
                              </div>
                              {msg.summary.language ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-200">
                                  {msg.summary.language}
                                </span>
                              ) : null}
                            </div>

                            {msg.summary.title ? (
                              <div className="text-sm font-semibold leading-snug">
                                {msg.summary.title}
                              </div>
                            ) : null}

                            <p className="leading-relaxed whitespace-pre-wrap">
                              {displayText}
                            </p>

                            {needsClamp ? (
                              <button
                                onClick={() => toggleSummaryExpanded(msg.id)}
                                className={`self-start text-xs font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                                  msg.isMine
                                    ? "text-blue-900 bg-blue-100 hover:bg-blue-200 dark:text-blue-50 dark:bg-blue-800/60 dark:hover:bg-blue-800"
                                    : "text-blue-800 bg-blue-100 hover:bg-blue-200 dark:text-blue-100 dark:bg-blue-800/40 dark:hover:bg-blue-800/60"
                                }`}
                              >
                                {isExpanded
                                  ? t("chat.messages.bubble.collapse")
                                  : t("chat.messages.bubble.seeMore")}
                              </button>
                            ) : null}

                            {visibleKeyPoints.length > 0 ? (
                              <ul className="list-disc ml-5 space-y-1 text-sm marker:text-blue-500 dark:marker:text-blue-300">
                                {visibleKeyPoints.map((point, idx) => (
                                  <li key={`${msg.id}-kp-${idx}`}>{point}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}

                {/* Reactions display */}
                {!msg.isDeleted &&
                  msg.status !== "recalled" &&
                  msg.reactions &&
                  msg.reactions.length > 0 && (
                    <MessageReactions reactions={msg.reactions} />
                  )}
              </div>
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
});
