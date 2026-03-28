"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
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
  AcademicCapIcon,
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

  const handleStudy = (id: string) => {
    router.push(`/flash-card/${id}/study`);
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
              const proc = set.progress;
              const totalCards = proc?.total_cards ?? 0;
              const newCards = proc?.new_cards ?? 0;
              const learningCards = proc?.learning_cards ?? 0;
              const reviewCards = proc?.review_cards ?? 0;
              const masteredCards = proc?.mastered_cards ?? 0;

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
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Tiến độ
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {masteredCards}/{totalCards} đã thuộc
                        </span>
                      </div>

                      {/* Stacked progress bar */}
                      {totalCards > 0 ? (
                        <div className="flex w-full h-2 rounded-full overflow-hidden gap-px bg-gray-200 dark:bg-gray-700">
                          {masteredCards > 0 && (
                            <div
                              className="bg-green-500 rounded-l-full transition-all"
                              style={{ width: `${(masteredCards / totalCards) * 100}%` }}
                              title={`Đã thuộc: ${masteredCards}`}
                            />
                          )}
                          {reviewCards > 0 && (
                            <div
                              className="bg-blue-500 transition-all"
                              style={{ width: `${(reviewCards / totalCards) * 100}%` }}
                              title={`Ôn tập: ${reviewCards}`}
                            />
                          )}
                          {learningCards > 0 && (
                            <div
                              className="bg-amber-400 transition-all"
                              style={{ width: `${(learningCards / totalCards) * 100}%` }}
                              title={`Đang học: ${learningCards}`}
                            />
                          )}
                          {newCards > 0 && (
                            <div
                              className="bg-gray-400 dark:bg-gray-500 rounded-r-full transition-all"
                              style={{ width: `${(newCards / totalCards) * 100}%` }}
                              title={`Mới: ${newCards}`}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
                      )}

                      {/* Stat pills */}
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div className="rounded-lg bg-green-50 dark:bg-green-950/40 py-1.5 px-1">
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">{masteredCards}</p>
                          <p className="text-[10px] text-green-700 dark:text-green-300 leading-tight">Thuộc</p>
                        </div>
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 py-1.5 px-1">
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{reviewCards}</p>
                          <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-tight">Ôn tập</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 py-1.5 px-1">
                          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{learningCards}</p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">Học</p>
                        </div>
                        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 py-1.5 px-1">
                          <p className="text-sm font-bold text-gray-600 dark:text-gray-400">{newCards}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">Mới</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <RectangleStackIcon className="w-4 h-4" />
                        <span>{totalCards} thẻ</span>
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
                        color="success"
                        onPress={() => handleStudy(setId)}
                        aria-label="Học bộ flashcard"
                      >
                        <AcademicCapIcon className="w-4 h-4" />
                      </Button>
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

