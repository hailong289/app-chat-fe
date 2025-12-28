import { motion, AnimatePresence } from "framer-motion";
import { MessageItem } from "./MessageItem";
import { MessageType } from "@/store/types/message.state";

interface MessageGroupProps {
  group: {
    dateLabel: string;
    messages: MessageType[];
    newMessageIndex?: number;
  };
  shouldAnimate: boolean;
  expandedMessages: Set<string>;
  lastMsgId: string;
  chatId: string;
  socket: any;
  noAction?: boolean;
  renderedMessageIds: React.MutableRefObject<Set<string>>;
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

import { memo } from "react";

export const MessageGroup = memo(
  function MessageGroup({
    group,
    shouldAnimate,
    expandedMessages,
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
  }: Readonly<Omit<MessageGroupProps, "groupIdx">>) {
    return (
      <div className="space-y-4">
        {/* Date divider */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldAnimate ? 0.3 : 0 }}
          className="flex items-center justify-center my-4"
        >
          <div
            className="
            bg-gray-200 text-gray-600 
            dark:bg-gray-700 dark:text-gray-200 
            text-xs font-medium px-3 py-1 rounded-full
          "
          >
            {group.dateLabel}
          </div>
        </motion.div>

        {/* Messages in this date group */}
        <AnimatePresence initial={false}>
          {group.messages.map((msg, msgIdx) => {
            const isFirstInGroup = msgIdx === 0;
            const isLastInGroup = msgIdx === group.messages.length - 1;
            const prevMsg = msgIdx > 0 ? group.messages[msgIdx - 1] : null;
            const nextMsg =
              msgIdx < group.messages.length - 1
                ? group.messages[msgIdx + 1]
                : null;

            const isSameSenderAsPrev = prevMsg?.sender._id === msg.sender._id;
            const isSameSenderAsNext = nextMsg?.sender._id === msg.sender._id;

            const showAvatar = !isSameSenderAsNext || isLastInGroup;
            const messageSpacing = isSameSenderAsPrev ? "mt-1" : "mt-4";

            const isNewMessage = !renderedMessageIds.current.has(msg.id);
            // Side-effect in render is removed here. It should be handled in useEffect or similar if strictly needed,
            // but for "isNewMessage" calculation, checking the ref is fine.
            // Updating the ref should happen elsewhere if possible, but if it's just for tracking "first render of this ID",
            // we might need a different approach or accept it's a bit "unsafe".
            // However, to fix the "mutate ref in render" warning/issue:
            // We can defer the update or use a layout effect.
            // For now, let's keep the check but move the update to a useEffect in the Item or parent.
            // Actually, for this specific logic (animation trigger), it's often done this way in simple cases.
            // But to be strict:
            // We will NOT mutate here. We will let the parent or a generic effect handle "marking as rendered".
            // But wait, `renderedMessageIds` is passed from parent.

            // Let's just remove the mutation from render phase.
            // The parent `useChatMessagesEffects` clears it on chat switch.
            // We need a way to mark it as rendered.
            // A `useEffect` inside MessageItem is a better place.

            const isExpanded = expandedMessages.has(msg.id);
            const isUnreadDivider =
              group.newMessageIndex === msgIdx && !msg.isRead && !msg.isMine;

            return (
              <MessageItem
                key={msg.id}
                msg={msg}
                prevMsg={prevMsg}
                nextMsg={nextMsg}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                showAvatar={showAvatar}
                messageSpacing={messageSpacing}
                shouldAnimate={shouldAnimate}
                isNewMessage={isNewMessage}
                isExpanded={isExpanded}
                isUnreadDivider={isUnreadDivider}
                lastMsgId={lastMsgId}
                chatId={chatId}
                socket={socket}
                noAction={noAction}
                renderedMessageIds={renderedMessageIds}
                onToggleExpanded={onToggleExpanded}
                onReply={onReply}
                onReact={onReact}
                onDelete={onDelete}
                onRecall={onRecall}
                onTogglePin={onTogglePin}
                onCopy={onCopy}
                onTranslate={onTranslate}
                onSummarize={onSummarize}
                onJumpToMessage={onJumpToMessage}
                setMessageRef={setMessageRef}
                messageState={messageState}
              />
            );
          })}
        </AnimatePresence>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    // caused by unstable 'group' object reference

    // 1. Check simple props
    if (
      prevProps.shouldAnimate !== nextProps.shouldAnimate ||
      prevProps.lastMsgId !== nextProps.lastMsgId ||
      prevProps.chatId !== nextProps.chatId ||
      prevProps.noAction !== nextProps.noAction ||
      prevProps.socket !== nextProps.socket
    ) {
      return false;
    }

    // Check if any message in this group has changed its expanded state
    const hasExpandedChange = prevProps.group.messages.some(
      (msg) =>
        prevProps.expandedMessages.has(msg.id) !==
        nextProps.expandedMessages.has(msg.id)
    );
    if (hasExpandedChange) return false;

    // 2. Check handlers (assuming they are memoized in parent)
    if (
      prevProps.onReply !== nextProps.onReply ||
      prevProps.onReact !== nextProps.onReact ||
      prevProps.onDelete !== nextProps.onDelete ||
      prevProps.onRecall !== nextProps.onRecall ||
      prevProps.onTogglePin !== nextProps.onTogglePin ||
      prevProps.onCopy !== nextProps.onCopy ||
      prevProps.onTranslate !== nextProps.onTranslate ||
      prevProps.onSummarize !== nextProps.onSummarize ||
      prevProps.onJumpToMessage !== nextProps.onJumpToMessage
    ) {
      return false;
    }

    // 3. Check group content
    const prevGroup = prevProps.group;
    const nextGroup = nextProps.group;

    if (
      prevGroup.dateLabel !== nextGroup.dateLabel ||
      prevGroup.newMessageIndex !== nextGroup.newMessageIndex ||
      prevGroup.messages.length !== nextGroup.messages.length
    ) {
      return false;
    }

    // Check if messages are referentially equal or have changed status/content
    return prevGroup.messages.every((msg, idx) => {
      const nextMsg = nextGroup.messages[idx];
      return (
        msg.id === nextMsg.id &&
        msg.status === nextMsg.status &&
        msg.read_by_count === nextMsg.read_by_count &&
        msg.editedAt === nextMsg.editedAt &&
        msg.isRead === nextMsg.isRead
      );
    });

    return true;
  }
);
