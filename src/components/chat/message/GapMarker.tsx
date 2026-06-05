"use client";

import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { Spinner } from "@heroui/react";
import { motion } from "framer-motion";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import useMessageStore from "@/store/useMessageStore";

interface GapMarkerProps {
  /** Local room id the gap belongs to (the messages-table roomId key). */
  chatId: string;
  shouldAnimate?: boolean;
}

/**
 * Gap-marker timeline affordance (catch-up sync engine).
 *
 * Rendered in place of a `__gap` placeholder row. A centered pill/button —
 * visually distinct from a normal bubble or a system message — that lazy-
 * loads the missing window of messages when clicked. On success the gap
 * marker is removed (IDB + state) and the real messages appear here. On
 * error the pill stays so the user can retry.
 */
export const GapMarker = memo(function GapMarker({
  chatId,
  shouldAnimate,
}: Readonly<GapMarkerProps>) {
  const { t } = useTranslation();
  const loadGap = useMessageStore((state) => state.loadGap);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const ok = await loadGap(chatId, 50);
      // `loadGap` returns false on a fetch error (marker kept). Surface a
      // brief error hint so the user knows to retry.
      if (!ok) setHasError(true);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldAnimate ? 0.25 : 0 }}
      className="flex items-center justify-center my-3"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        aria-busy={isLoading}
        className="
          inline-flex items-center gap-2
          px-4 py-1.5 rounded-full
          text-xs font-medium
          border border-dashed
          border-blue-400/60 dark:border-blue-500/50
          text-blue-600 dark:text-blue-300
          bg-blue-50/70 dark:bg-blue-950/40
          hover:bg-blue-100 dark:hover:bg-blue-900/60
          transition-colors cursor-pointer
          disabled:opacity-70 disabled:cursor-wait
        "
      >
        {isLoading ? (
          <Spinner size="sm" color="primary" className="scale-75" />
        ) : (
          <ArrowPathIcon className="w-4 h-4" />
        )}
        <span>
          {isLoading
            ? t("chat.messages.gap.loading", "Đang tải tin nhắn…")
            : hasError
              ? t("chat.messages.gap.retry", "Tải lại tin nhắn")
              : t("chat.messages.gap.loadMore", "Tải thêm tin nhắn")}
        </span>
      </button>
    </motion.div>
  );
});

export default GapMarker;
