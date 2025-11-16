import { motion } from "framer-motion";
import { Skeleton } from "@heroui/react";

interface ChatLoadingSkeletonProps {
  chatId: string;
}

export function ChatLoadingSkeleton({ chatId }: ChatLoadingSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col"
    >
      {/* Skeleton messages */}
      <div className="flex-1 p-4 space-y-6 overflow-hidden">
        {/* Date divider skeleton */}
        <div className="flex items-center justify-center">
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        {/* Message skeletons */}
        {Array.from({ length: 5 }, (_, idx) => {
          const isMyMessage = idx % 2 === 1;
          const messageWidth = `${Math.floor(Math.random() * 40) + 60}%`;
          const uniqueKey = `chat-switch-skeleton-${chatId}-${idx}`;

          return (
            <div
              key={uniqueKey}
              className={`flex gap-3 ${
                isMyMessage ? "justify-end" : "justify-start"
              }`}
            >
              {/* Avatar skeleton cho tin người khác */}
              {!isMyMessage && (
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              )}

              {/* Message bubble skeleton */}
              <div
                className={`flex flex-col ${
                  isMyMessage ? "items-end" : "items-start"
                } max-w-xs`}
              >
                {/* Sender name skeleton cho tin người khác */}
                {!isMyMessage && idx === 0 && (
                  <Skeleton className="h-3 w-20 rounded mb-1" />
                )}

                {/* Content skeleton */}
                <Skeleton
                  className={`h-10 rounded-2xl ${
                    isMyMessage ? "rounded-tr-md" : "rounded-tl-md"
                  }`}
                  style={{ width: messageWidth }}
                />

                {/* Timestamp skeleton */}
                <Skeleton className="h-3 w-12 rounded mt-1" />
              </div>

              {/* Avatar skeleton cho tin của mình */}
              {isMyMessage && (
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Loading indicator */}
      <div className="flex items-center justify-center py-6 bg-gradient-to-t from-white/50 to-transparent">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      </div>
    </motion.div>
  );
}

