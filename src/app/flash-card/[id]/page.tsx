"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  Pagination,
  Spinner,
  Chip,
} from "@heroui/react";
import { 
  ArrowLeftIcon, 
  SpeakerWaveIcon, 
  PhotoIcon 
} from "@heroicons/react/24/outline";
import { flashcardService } from "@/service/flashcard.service";
import useAuthStore from "@/store/useAuthStore";
import { Flashcard } from "@/types/flashcard.type";

export default function FlashcardDeckViewPage() {
  const params = useParams<{ id: string }>();
  const deckId = params?.id;
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const userId = currentUser?._id || "";

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const totalPages = useMemo(() => Math.ceil(totalCards / pageSize) || 1, [totalCards]);

  const fetchCards = async (page: number) => {
    if (!deckId) return;
    try {
      setIsLoading(true);
      const res = await flashcardService.getListFlashcard({
        page: page,
        limit: pageSize,
        userId: userId,
        deckId: deckId,
      });

      // Based on typical API behavior where metadata wraps data & pagination meta
      if (res && res.data) {
        setCards(res.data);
        setTotalCards(res.meta?.totalItems || res.meta?.total || (res.data.length >= pageSize ? page * pageSize + 1 : (page - 1) * pageSize + res.data.length));
      } else if (Array.isArray(res)) {
        // Fallback for flat array response
        setCards(res);
        setTotalCards(res.length);
      } else {
        setCards([]);
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId && deckId) {
      fetchCards(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, deckId, currentPage]);

  const handleBack = () => {
    router.push("/flash-card");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            isIconOnly
            variant="flat"
            onPress={handleBack}
            aria-label="Quay lại"
            className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Danh sách thẻ ghi nhớ
          </h1>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner size="lg" aria-label="Đang tải thẻ..." color="primary" />
          </div>
        ) : cards.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {cards.map((card, index) => (
                <Card 
                  key={card._id || card.id || index}
                  className="border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all h-full"
                >
                  <CardBody className="p-0 flex flex-col h-full bg-white dark:bg-gray-900">
                    
                    {/* Front of Card */}
                    <div className="p-5 flex flex-col justify-center items-center text-center min-h-[140px] border-b border-gray-100 dark:border-gray-800 relative bg-primary-50/50 dark:bg-primary-900/10">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                        {card.card_front}
                      </h4>
                      {/* Media indicators */}
                      <div className="absolute top-3 right-3 flex gap-1">
                        {card.card_image && (
                          <div className="p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm" title="Có đính kèm hình ảnh">
                            <PhotoIcon className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        {card.card_audio && (
                          <div className="p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm" title="Có đính kèm âm thanh">
                            <SpeakerWaveIcon className="w-3.5 h-3.5 text-secondary" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Back of Card */}
                    <div className="p-5 flex-1 flex flex-col justify-center items-center text-center">
                      <p className="text-md text-gray-700 dark:text-gray-300 font-medium">
                        {card.card_back}
                      </p>
                      
                      {card.card_hint && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-3 italic line-clamp-2">
                          Gợi ý: {card.card_hint}
                        </p>
                      )}
                    </div>

                    {/* Footer / Tags */}
                    {card.card_tags && card.card_tags.length > 0 && (
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
                        {card.card_tags.slice(0, 3).map((tag, tagIndex) => (
                          <Chip key={tagIndex} size="sm" variant="flat" color="primary" className="text-[10px] h-6">
                            {tag}
                          </Chip>
                        ))}
                        {card.card_tags.length > 3 && (
                          <Chip size="sm" variant="flat" color="default" className="text-[10px] h-6">
                            +{card.card_tags.length - 3}
                          </Chip>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center pt-4">
                <Pagination
                  showControls
                  total={totalPages}
                  page={currentPage}
                  onChange={setCurrentPage}
                  color="primary"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800">
            <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-2">
              Bộ thẻ này chưa có thẻ nào
            </h3>
            <p className="text-gray-500 dark:text-gray-500 mb-6 max-w-md mx-auto">
              Hãy bấm vào "Chỉnh sửa bộ thẻ" hoặc "Review" thêm thẻ ghi nhớ mới nhé!
            </p>
            <Button color="primary" variant="flat" onPress={() => router.push(`/flash-card/${deckId}/edit`)}>
              Thêm thẻ mới
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
