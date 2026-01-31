"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Progress,
  useDisclosure,
} from "@heroui/react";
import {
  TrashIcon,
  RectangleStackIcon,
  ClockIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import useAuthStore from "@/store/useAuthStore";
import { CreateFlashcardDeckModal } from "@/components/flash-card/modals/create-flashcard-deck.modal";

interface FlashCardDesk {
  id: string;
  title: string;
  description: string;
  totalCards: number;
  memorizedCards: number;
  lastUsed?: Date;
}

export default function FlashCardPage() {
  const currentUser = useAuthStore((state) => state.user);
  const userId = currentUser?.id || "";
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Mock data - sẽ thay thế bằng API call sau
  const [flashCardDesk] = useState<FlashCardDesk[]>([
    {
      id: "1",
      title: "Bộ chưa đặt tên",
      description: "Không có mô tả",
      totalCards: 0,
      memorizedCards: 0,
    },
    {
      id: "2",
      title: "hihi",
      description: "dsa",
      totalCards: 2,
      memorizedCards: 0,
      lastUsed: new Date("2026-01-31"),
    },
    {
      id: "3",
      title: "Sustainable Development Goals",
      description:
        "Framework of 17 interconnected global objectives designed to address global challenges and promote sustainable development",
      totalCards: 53,
      memorizedCards: 20,
      lastUsed: new Date("2026-01-31"),
    },
  ]);

  const handleDelete = (id: string) => {
    // TODO: Implement delete functionality
    console.log("Xóa bộ flashcard:", id);
  };

  const handleCreate = () => {
    onOpen();
  };

  const handleSubmitDeck = async (data: any) => {
    // TODO: Implement API call to create flashcard deck
    console.log("Tạo bộ flashcard mới:", data);
    // Sau khi tạo thành công, refresh danh sách flashcard
  };

  const formatLastUsed = (date?: Date) => {
    if (!date) return "Chưa sử dụng";
    return `Sử dụng lần cuối ${format(date, "d/M/yyyy")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Thẻ Ghi Nhớ
          </h1>
          <Button
            color="primary"
            startContent={<PlusIcon className="w-5 h-5" />}
            onPress={handleCreate}
          >
            Tạo bộ
          </Button>
        </div>

        {/* Lưới bộ flashcard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flashCardDesk.map((set) => {
            const memorizedPercentage =
              set.totalCards > 0
                ? (set.memorizedCards / set.totalCards) * 100
                : 0;

            return (
              <Card
                key={set.id}
                className="border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
              >
                <CardBody className="p-6 space-y-4 relative">
                  {/* Delete button - top left */}
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    color="danger"
                    className="absolute top-2 left-2 z-10"
                    onPress={() => handleDelete(set.id)}
                    aria-label="Xóa bộ flashcard"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </Button>

                  {/* Header */}
                  <div className="pt-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 line-clamp-2 pr-8">
                      {set.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {set.description}
                    </p>
                  </div>

                  {/* Progress Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                        Thẻ đã ghi nhớ
                      </span>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {set.memorizedCards}/{set.totalCards}
                      </span>
                    </div>
                    <Progress
                      value={memorizedPercentage}
                      className="w-full"
                      color="primary"
                      aria-label="Tiến độ ghi nhớ"
                    />
                  </div>

                  {/* Footer Info */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <RectangleStackIcon className="w-4 h-4" />
                      <span>
                        {set.totalCards} {set.totalCards === 1 ? "thẻ" : "thẻ"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <ClockIcon className="w-4 h-4" />
                      <span>{formatLastUsed(set.lastUsed)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {flashCardDesk.length === 0 && (
          <div className="text-center py-12">
            <RectangleStackIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Chưa có bộ flashcard nào. Hãy tạo bộ đầu tiên!
            </p>
          </div>
        )}
      </div>

      {/* Create Flashcard Deck Modal */}
      <CreateFlashcardDeckModal
        isOpen={isOpen}
        onClose={onClose}
        userId={userId}
        onSubmit={handleSubmitDeck}
      />
    </div>
  );
}

