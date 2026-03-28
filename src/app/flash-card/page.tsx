"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  Progress,
  useDisclosure,
  Spinner,
  Pagination,
} from "@heroui/react";
import {
  TrashIcon,
  RectangleStackIcon,
  ClockIcon,
  PlusIcon,
  PencilIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import useAuthStore from "@/store/useAuthStore";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { flashcardService } from "@/service/flashcard.service";
import { FlashcardDeck } from "@/types/flashcard.type";

export default function FlashCardPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const userId = currentUser?._id || "";

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose
  } = useDisclosure();
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = useMemo(() => Math.ceil(decks.length / pageSize) || 1, [decks.length]);

  const currentDecks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return decks.slice(start, start + pageSize);
  }, [decks, currentPage]);

  const fetchDecks = async () => {
    try {
      setIsLoading(true);
      const data = await flashcardService.getListDeck();
      setDecks(data || []);
    } catch (error) {
      console.error("Error fetching decks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleDeleteClick = (id: string) => {
    setDeckToDelete(id);
    onDeleteOpen();
  };

  const handleConfirmDelete = async () => {
    if (!deckToDelete) return;
    try {
      setIsDeleting(true);
      await flashcardService.deleteDeck(deckToDelete);
      await fetchDecks();
      onDeleteClose();
      setDeckToDelete(null);
    } catch (error) {
      console.error("Lỗi khi xóa bộ flashcard:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreate = () => {
    router.push("/flash-card/create");
  };

  const handleEdit = (id: string) => {
    router.push(`/flash-card/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/flash-card/${id}`);
  };

  const handleSubmitDeck = async (data: any) => {
    console.log("Tạo bộ flashcard mới thành công hoặc đóng modal:", data);
    await fetchDecks();
  };

  const formatLastUsed = (dateString?: string) => {
    if (!dateString) return "Chưa sử dụng";
    try {
      return `Sử dụng lần cuối ${format(new Date(dateString), "d/M/yyyy")}`;
    } catch (e) {
      return "Chưa sử dụng";
    }
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

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" aria-label="Đang tải danh sách bộ thẻ..." color="primary" />
          </div>
        ) : currentDecks.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentDecks.map((set) => {
              const setId = set.deck_id;
              const totalCards = set.process?.total_cards;
              const memorizedCards = set.process?.mastered_cards;
              const memorizedPercentage = set.process?.mastered_cards;

              return (
                <Card
                  key={setId}
                  className="border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
                >
                  <CardBody className="p-6 space-y-4">
                    {/* Header */}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 line-clamp-2 pr-8">
                        {set.deck_name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 min-h-[40px]">
                        {set.deck_description || "Không có mô tả"}
                      </p>
                    </div>

                    {/* Progress Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Thẻ đã ghi nhớ
                        </span>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {memorizedCards}/{totalCards}
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
                          {totalCards} {totalCards === 1 ? "thẻ" : "thẻ"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <ClockIcon className="w-4 h-4" />
                        <span className="text-xs">{formatLastUsed(set.updatedAt || set.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        isIconOnly
                        variant="flat"
                        size="sm"
                        color="primary"
                        onPress={() => handleView(setId)}
                        aria-label="Xem bộ flashcard"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        isIconOnly
                        variant="flat"
                        size="sm"
                        color="warning"
                        onPress={() => handleEdit(setId)}
                        aria-label="Sửa bộ flashcard"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        isIconOnly
                        variant="flat"
                        size="sm"
                        color="danger"
                        onPress={() => handleDeleteClick(setId)}
                        aria-label="Xóa bộ flashcard"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
            </div>
            
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
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
          <div className="text-center py-12">
            <RectangleStackIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Chưa có bộ flashcard nào. Hãy tạo bộ đầu tiên!
            </p>
          </div>
        )}
      </div>


      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={handleConfirmDelete}
        title="Xóa bộ flashcard"
        content="Bạn có chắc chắn muốn xóa bộ flashcard này không? Thao tác này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        color="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

