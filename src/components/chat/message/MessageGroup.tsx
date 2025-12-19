import { motion, AnimatePresence } from "framer-motion";
import { MessageItem } from "./MessageItem";
import { MessageType } from "@/store/types/message.state";

interface MessageGroupProps {
  group: {
    dateLabel: string;
    messages: MessageType[];
    newMessageIndex?: number;
  };
  groupIdx: number;
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
  onJumpToMessage: (id: string) => void;
  setMessageRef: (id: string) => (el: HTMLElement | null) => void;
  messageState: any;
}

export function MessageGroup({
  group,
  groupIdx,
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
  onJumpToMessage,
  setMessageRef,
  messageState,
}: Readonly<MessageGroupProps>) {
  return (
    <div
      key={`message-group-${group.dateLabel}-${groupIdx}`}
      className="space-y-4"
      style={{ contentVisibility: "auto", containIntrinsicSize: "1000px" }}
    >
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
          if (!renderedMessageIds.current.has(msg.id)) {
            renderedMessageIds.current.add(msg.id);
          }

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
              onToggleExpanded={onToggleExpanded}
              onReply={onReply}
              onReact={onReact}
              onDelete={onDelete}
              onRecall={onRecall}
              onTogglePin={onTogglePin}
              onCopy={onCopy}
              onJumpToMessage={onJumpToMessage}
              setMessageRef={setMessageRef}
              messageState={messageState}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
