import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@heroui/react";

interface ChatLoadingIndicatorProps {
  isLoadingOlder: boolean;
  isLoadingFromAPI: boolean;
  isFetchingNewMessages: boolean;
  messageStateLoading: boolean;
}

export function ChatLoadingIndicator({
  isLoadingOlder,
  isLoadingFromAPI,
  isFetchingNewMessages,
  messageStateLoading,
}: ChatLoadingIndicatorProps) {
  return (
    <>
      {/* Top loading indicator */}
      <div className="relative">
        <AnimatePresence>
          {isLoadingOlder && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-center py-2"
            >
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <span>
                  {isLoadingFromAPI
                    ? "Đang tải từ server..."
                    : "Đang tải tin nhắn cũ..."}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading indicator for new messages */}
      <AnimatePresence>
        {isFetchingNewMessages && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 py-3 mb-2"
          >
            {/* Loading banner */}
            <div className="flex justify-center">
              <div
                className="
                  flex items-center gap-2 text-xs 
                  text-blue-600 bg-blue-50 border-blue-200
                  dark:text-blue-200 dark:bg-blue-500/10 dark:border-blue-500/40
                  px-4 py-2 rounded-full shadow-sm border
                "
              >
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                <span className="font-medium">Đang tải tin nhắn mới...</span>
              </div>
            </div>

            {/* Preview skeleton cho tin nhắn sẽ tới */}
            <div className="flex gap-3 justify-start px-4">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex flex-col">
                <Skeleton className="h-3 w-16 rounded mb-2" />
                <Skeleton className="h-8 w-32 rounded-2xl rounded-tl-md" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating loading indicator */}
      <AnimatePresence>
        {(isFetchingNewMessages || messageStateLoading) && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-6 z-50"
          >
            <div
              className="
                flex items-center gap-2 
                bg-white/90 text-blue-600 border-blue-200
                dark:bg-gray-900/90 dark:text-blue-200 dark:border-blue-500/40
                backdrop-blur-sm text-xs px-3 py-2 rounded-full shadow-lg border
              "
            >
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
              <span className="font-medium whitespace-nowrap">
                {isFetchingNewMessages
                  ? "Đang tải tin nhắn mới"
                  : "Đang tải..."}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
