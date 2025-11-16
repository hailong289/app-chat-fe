import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@heroui/react";
import { ChevronDoubleDownIcon } from "@heroicons/react/16/solid";

interface ScrollToBottomButtonProps {
  isVisible: boolean;
  unreadCount?: number;
  isRead?: boolean;
  onScrollToBottom: () => void;
}

export function ScrollToBottomButton({
  isVisible,
  unreadCount = 0,
  isRead = true,
  onScrollToBottom,
}: ScrollToBottomButtonProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-40 right-40 z-40"
        >
          <Button
            onPress={onScrollToBottom}
            color="primary"
            variant="shadow"
            isIconOnly
            className="shadow-lg hover:shadow-xl transition-shadow"
            size="lg"
          >
            <ChevronDoubleDownIcon className="w-5 h-5" />
          </Button>

          {/* Badge hiển thị số tin nhắn chưa đọc */}
          {!isRead && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

