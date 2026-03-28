"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Progress, Spinner, Card, CardBody, Chip } from "@heroui/react";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import { flashcardService } from "@/service/flashcard.service";
import useAuthStore from "@/store/useAuthStore";
import { Flashcard } from "@/types/flashcard.type";

type AnswerResult = "unknown" | "partial" | "mastered";

interface CardResult {
  card: Flashcard;
  result: AnswerResult;
}

export default function FlashcardStudyPage() {
  const params = useParams<{ id: string }>();
  const deckId = params?.id;
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const userId = currentUser?._id || "";

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [deckName, setDeckName] = useState("");

  const fetchCards = useCallback(async () => {
    if (!deckId) return;
    try {
      setIsLoading(true);
      const res = await flashcardService.getListFlashcard({
        deckId,
        userId,
        limit: 1000,
      });

      let cardList: Flashcard[] = [];
      if (Array.isArray(res)) {
        cardList = res;
      } else if (res?.data && Array.isArray(res.data)) {
        cardList = res.data;
      } else if (res?.flashcards && Array.isArray(res.flashcards)) {
        cardList = res.flashcards;
      }

      setCards(cardList);

      const decks = await flashcardService.getListDeck();
      const deck = decks.find((d) => d.deck_id === deckId);
      if (deck) setDeckName(deck.deck_name);
    } catch (error) {
      console.error("Lỗi khi tải flashcard:", error);
    } finally {
      setIsLoading(false);
    }
  }, [deckId, userId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0;

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleAnswer = async (result: AnswerResult) => {
    if (!currentCard || isSubmitting) return;

    const cardId = currentCard._id || (currentCard as any).card_id || (currentCard as any).id;
    if (!cardId) {
      console.error("Không tìm thấy card_id");
      moveToNext(result);
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadMap = {
        unknown: {
          incorrect_count: 1,
          review_count: 1,
          status: "learning" as const,
          mastery_level: 0,
        },
        partial: {
          correct_count: 1,
          review_count: 1,
          status: "review" as const,
          mastery_level: 50,
        },
        mastered: {
          correct_count: 1,
          review_count: 1,
          status: "mastered" as const,
          is_mastered: true,
          mastery_level: 100,
        },
      };

      await flashcardService.updateProgress(cardId, payloadMap[result]);
    } catch (error) {
      console.error("Lỗi khi cập nhật tiến độ:", error);
    } finally {
      setIsSubmitting(false);
      moveToNext(result);
    }
  };

  const moveToNext = (result: AnswerResult) => {
    setResults((prev) => [...prev, { card: currentCard, result }]);

    if (currentIndex + 1 >= cards.length) {
      setIsFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setIsFlipped(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults([]);
    setIsFinished(false);
  };

  const masteredCount = results.filter((r) => r.result === "mastered").length;
  const partialCount = results.filter((r) => r.result === "partial").length;
  const unknownCount = results.filter((r) => r.result === "unknown").length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner size="lg" color="primary" aria-label="Đang tải flashcard..." />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8 flex flex-col items-center justify-center gap-4">
        <AcademicCapIcon className="w-16 h-16 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Bộ flashcard này chưa có thẻ nào.
        </p>
        <Button
          color="primary"
          startContent={<ArrowLeftIcon className="w-4 h-4" />}
          onPress={() => router.push("/flash-card")}
        >
          Quay lại
        </Button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              onPress={() => router.push("/flash-card")}
              aria-label="Quay lại"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Kết quả học tập
            </h1>
          </div>

          <Card className="border border-gray-200 dark:border-gray-800">
            <CardBody className="p-8 space-y-6 text-center">
              <AcademicCapIcon className="w-16 h-16 mx-auto text-primary" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">
                  {deckName}
                </p>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Hoàn thành!
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  Bạn đã học xong {cards.length} thẻ
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-4">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {masteredCount}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Đã thuộc
                  </p>
                </div>
                <div className="rounded-xl bg-yellow-50 dark:bg-yellow-950/30 p-4">
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                    {partialCount}
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Còn nhớ
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4">
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {unknownCount}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Không nhớ
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button
                  color="primary"
                  startContent={<ArrowPathIcon className="w-4 h-4" />}
                  onPress={handleRestart}
                >
                  Học lại
                </Button>
                <Button
                  variant="flat"
                  startContent={<ArrowLeftIcon className="w-4 h-4" />}
                  onPress={() => router.push("/flash-card")}
                >
                  Về trang chủ
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            onPress={() => router.push("/flash-card")}
            aria-label="Quay lại"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {deckName}
            </p>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Học flashcard
            </h1>
          </div>
          <Chip variant="flat" color="primary" size="sm">
            {currentIndex + 1} / {cards.length}
          </Chip>
        </div>

        {/* Progress bar */}
        <Progress
          value={progress}
          color="primary"
          aria-label="Tiến độ học"
          className="w-full"
          size="sm"
        />

        {/* Card */}
        <div className="relative" style={{ perspective: "1200px" }}>
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              minHeight: "280px",
            }}
          >
            {/* Front */}
            <Card
              className="absolute inset-0 border border-gray-200 dark:border-gray-800 cursor-pointer select-none"
              style={{ backfaceVisibility: "hidden" }}
              isPressable={!isFlipped}
              onPress={!isFlipped ? handleFlip : undefined}
            >
              <CardBody className="flex flex-col items-center justify-center p-8 text-center gap-4 min-h-[280px]">
                <Chip variant="flat" color="default" size="sm">
                  Mặt trước
                </Chip>
                <p className="text-xl font-semibold text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                  {currentCard?.card_front}
                </p>
                {currentCard?.card_hint && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Gợi ý: {currentCard.card_hint}
                  </p>
                )}
                {!isFlipped && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Nhấn vào thẻ để lật
                  </p>
                )}
              </CardBody>
            </Card>

            {/* Back */}
            <Card
              className="absolute inset-0 border border-primary-200 dark:border-primary-800"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <CardBody className="flex flex-col items-center justify-center p-8 text-center gap-4 min-h-[280px]">
                <Chip variant="flat" color="primary" size="sm">
                  Mặt sau
                </Chip>
                <p className="text-xl font-semibold text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                  {currentCard?.card_back}
                </p>
                {currentCard?.card_tags && currentCard.card_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {currentCard.card_tags.map((tag) => (
                      <Chip key={tag} size="sm" variant="flat" color="default">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Action buttons */}
        {!isFlipped ? (
          <Button
            color="primary"
            size="lg"
            className="w-full"
            onPress={handleFlip}
          >
            Lật thẻ
          </Button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Button
              color="danger"
              variant="flat"
              size="lg"
              className="flex flex-col h-auto py-4 gap-1"
              isDisabled={isSubmitting}
              onPress={() => handleAnswer("unknown")}
            >
              <XCircleIcon className="w-6 h-6" />
              <span className="text-xs font-medium">Không nhớ</span>
            </Button>
            <Button
              color="warning"
              variant="flat"
              size="lg"
              className="flex flex-col h-auto py-4 gap-1"
              isDisabled={isSubmitting}
              onPress={() => handleAnswer("partial")}
            >
              <ArrowPathIcon className="w-6 h-6" />
              <span className="text-xs font-medium">Còn nhớ</span>
            </Button>
            <Button
              color="success"
              variant="flat"
              size="lg"
              className="flex flex-col h-auto py-4 gap-1"
              isDisabled={isSubmitting}
              onPress={() => handleAnswer("mastered")}
            >
              <CheckCircleIcon className="w-6 h-6" />
              <span className="text-xs font-medium">Đã thuộc</span>
            </Button>
          </div>
        )}

        {/* Session stats */}
        {results.length > 0 && (
          <div className="flex justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="text-green-600 dark:text-green-400 font-medium">
              ✓ {masteredCount + partialCount} nhớ
            </span>
            <span className="text-red-600 dark:text-red-400 font-medium">
              ✗ {unknownCount} không nhớ
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
