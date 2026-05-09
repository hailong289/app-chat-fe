"use client";

import { BlockNoteContext, ThreadsSidebar } from "@blocknote/react";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

interface ThreadsSidebarPanelProps {
  editor: any;
}

/**
 * Word-style threads list. New comments are still composed via BlockNote's
 * `<FloatingComposerController />` (popup near selection — working after the
 * CSS scope fix in globals.css). This panel only shows the LIST of existing
 * threads on the right side of the document, so users can browse and reply
 * without the popup-only experience of the default thread controller.
 *
 * Wraps with `BlockNoteContext.Provider` because we render outside
 * `<BlockNoteView>` (which provides that context to its own descendants).
 */
export function ThreadsSidebarPanel({ editor }: ThreadsSidebarPanelProps) {
  const { t } = useTranslation();
  if (!editor) return null;

  return (
    <BlockNoteContext.Provider value={{ editor }}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-2 mb-3">
          <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("docs.comments")}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ThreadsSidebar />
        </div>
      </div>
    </BlockNoteContext.Provider>
  );
}
