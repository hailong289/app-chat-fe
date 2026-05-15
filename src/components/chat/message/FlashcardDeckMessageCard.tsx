"use client";

import { useState } from "react";
import { Chip, Spinner } from "@heroui/react";
import {
  Square3Stack3DIcon,
  ArrowDownTrayIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { FlashcardDeck } from "@/types/flashcard.type";
import { flashcardService } from "@/service/flashcard.service";
import { toast } from "@/store/useToastStore";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

interface FlashcardDeckMessageCardProps {
  deck: FlashcardDeck;
  isSender?: boolean;
}

export function FlashcardDeckMessageCard({ deck, isSender = false }: FlashcardDeckMessageCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCloning, setIsCloning] = useState(false);
  const [hasCloned, setHasCloned] = useState(false);

  const handleClone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCloning || hasCloned || isSender) return;

    try {
      setIsCloning(true);
      await flashcardService.cloneDeck(deck.deck_id);
      setHasCloned(true);
      toast.success(t("flashcard.messages.cloneSuccess", "Đã lưu bộ thẻ thành công!"));
    } catch (error) {
      console.error("Lỗi khi lưu bộ thẻ:", error);
      toast.error(t("flashcard.messages.cloneError", "Không thể lưu bộ thẻ. Vui lòng thử lại."));
    } finally {
      setIsCloning(false);
    }
  };

  const handleOpenDeck = () => {
    // If it's already cloned or user is the sender, they can view their own deck page
    // For now we just open the general flashcard page or a specific route if desired
    router.push(`/flash-card/${deck.deck_id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenDeck}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpenDeck();
        }
      }}
      className={`group w-80 rounded-2xl border-2 text-left transition-all select-none outline-none
        bg-gradient-to-br from-secondary/10 via-content1 to-primary/10
        border-secondary/25 hover:border-secondary/50
        cursor-pointer hover:shadow-lg active:scale-[0.98]
      `}
      aria-label={`Bộ thẻ: ${deck.deck_name}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-secondary/15">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-secondary/15">
          <Square3Stack3DIcon className="w-5 h-5 text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-secondary">
            Bộ Thẻ Ghi Nhớ
          </p>
          <p className="text-sm font-bold truncate text-default-900 leading-tight">
            {deck.deck_name}
          </p>
        </div>
        <Chip size="sm" color="secondary" variant="flat" className="shrink-0 text-[10px] font-semibold">
          {deck.deck_level || "beginner"}
        </Chip>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <p className="text-xs text-default-600 line-clamp-2">
          {deck.deck_description || "Không có mô tả"}
        </p>

        <div className="flex items-center gap-2.5 pt-0.5">
          <span className="inline-flex items-center gap-1 text-xs bg-default-100 px-2 py-1 rounded-full">
            <span className="font-bold text-default-700">{deck.total_cards || 0}</span>
            <span className="text-default-500">thẻ</span>
          </span>
          {deck.deck_tags && deck.deck_tags.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-secondary/10 px-2 py-1 rounded-full max-w-[120px] truncate">
              <span className="text-secondary/80 truncate">{deck.deck_tags[0]}</span>
              {deck.deck_tags.length > 1 && (
                <span className="text-secondary/60">+{deck.deck_tags.length - 1}</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-b-2xl border-t transition-colors border-secondary/15 bg-secondary/5 group-hover:bg-secondary/10">
        {!isSender ? (
          <button
            type="button"
            onClick={handleClone}
            disabled={isCloning || hasCloned}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold outline-none transition-all ${
              hasCloned
                ? "bg-success/20 text-success"
                : "bg-secondary text-white hover:bg-secondary/90 shadow-sm hover:shadow active:scale-95"
            }`}
            aria-label="Lưu bộ thẻ"
          >
            {isCloning ? (
              <Spinner size="sm" color="current" />
            ) : hasCloned ? (
              <CheckBadgeIcon className="w-4 h-4" />
            ) : (
              <ArrowDownTrayIcon className="w-4 h-4" />
            )}
            {isCloning ? "Đang lưu..." : hasCloned ? "Đã lưu" : "Lưu bộ thẻ"}
          </button>
        ) : (
          <span className="text-xs font-semibold text-secondary px-1">
            Bộ thẻ của bạn
          </span>
        )}
      </div>
    </div>
  );
}
