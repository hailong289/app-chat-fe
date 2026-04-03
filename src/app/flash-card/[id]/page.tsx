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
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
} from "@heroui/react";
import { 
  ArrowLeftIcon, 
  SpeakerWaveIcon, 
  PhotoIcon,
  AcademicCapIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { flashcardService } from "@/service/flashcard.service";
import useAuthStore from "@/store/useAuthStore";
import { Flashcard } from "@/types/flashcard.type";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

export default function FlashcardDeckViewPage() {
  const params = useParams<{ id: string }>();
  const deckId = params?.id;
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const userId = currentUser?._id || "";

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editForm, setEditForm] = useState({ card_front: "", card_back: "", card_hint: "", card_difficulty: "" });
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const handleEditCardClick = (card: Flashcard) => {
    setEditingCard(card);
    setEditForm({
      card_front: card.card_front || "",
      card_back: card.card_back || "",
      card_hint: card.card_hint || "",
      card_difficulty: card.card_difficulty?.toString() || "",
    });
    setEditTags(card.card_tags ? [...card.card_tags] : []);
    setEditTagInput("");
    onEditOpen();
  };

  const handleSaveEditCard = async () => {
    const cardId = editingCard?._id || (editingCard as any)?.card_id || editingCard?.id;
    if (!cardId) return;
    setIsSaving(true);
    try {
      await flashcardService.updateCard(cardId, {
        card_front: editForm.card_front.trim(),
        card_back: editForm.card_back.trim(),
        ...(editForm.card_hint.trim() && { card_hint: editForm.card_hint.trim() }),
        ...(editTags.length > 0 && { card_tags: editTags }),
        ...(editForm.card_difficulty && { card_difficulty: parseInt(editForm.card_difficulty) }),
      });
      await fetchCards(currentPage);
      onEditClose();
    } catch (error) {
      console.error("Lỗi khi cập nhật thẻ:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEditTag = () => {
    const trimmed = editTagInput.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags((prev) => [...prev, trimmed]);
      setEditTagInput("");
    }
  };

  const handleDeleteCardClick = (cardId: string) => {
    setCardToDelete(cardId);
    onDeleteOpen();
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardToDelete) return;
    try {
      setIsDeleting(true);
      await flashcardService.deleteCard(cardToDelete);
      await fetchCards(currentPage);
      onDeleteClose();
      setCardToDelete(null);
    } catch (error) {
      console.error("Lỗi khi xóa thẻ:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            isIconOnly
            variant="flat"
            onPress={handleBack}
            aria-label="Quay lại"
            className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex-1">
            Danh sách thẻ ghi nhớ
          </h1>
          <div className="flex items-center gap-2">
            <Button
              color="success"
              variant="flat"
              startContent={<AcademicCapIcon className="w-4 h-4" />}
              onPress={() => router.push(`/flash-card/${deckId}/study`)}
            >
              Học ngay
            </Button>
            <Button
              color="warning"
              variant="flat"
              startContent={<PencilIcon className="w-4 h-4" />}
              onPress={() => router.push(`/flash-card/${deckId}/edit`)}
            >
              Chỉnh sửa
            </Button>
          </div>
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

                    {/* Footer / Tags + Actions */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800">
                      {card.card_tags && card.card_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
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
                      <div className="flex justify-end gap-1.5">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="warning"
                          aria-label="Chỉnh sửa thẻ"
                          onPress={() => handleEditCardClick(card)}
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="danger"
                          aria-label="Xóa thẻ"
                          onPress={() => handleDeleteCardClick((card._id || card.id) as string)}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
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

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={handleConfirmDeleteCard}
        title="Xóa thẻ"
        content="Bạn có chắc chắn muốn xóa thẻ này không? Thao tác này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        color="danger"
        isLoading={isDeleting}
      />

      {/* Edit Card Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="text-lg font-bold">Chỉnh sửa thẻ</ModalHeader>
          <ModalBody className="space-y-4 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Textarea
                label="Mặt trước"
                placeholder="Nhập nội dung mặt trước..."
                value={editForm.card_front}
                isRequired
                maxLength={1000}
                minRows={3}
                onChange={(e) => setEditForm((p) => ({ ...p, card_front: e.target.value }))}
              />
              <Textarea
                label="Mặt sau"
                placeholder="Nhập nội dung mặt sau..."
                value={editForm.card_back}
                isRequired
                maxLength={2000}
                minRows={3}
                onChange={(e) => setEditForm((p) => ({ ...p, card_back: e.target.value }))}
              />
            </div>

            <Input
              label="Gợi ý"
              placeholder="Nhập gợi ý (không bắt buộc)..."
              value={editForm.card_hint}
              maxLength={500}
              onChange={(e) => setEditForm((p) => ({ ...p, card_hint: e.target.value }))}
            />

            <div className="space-y-2">
              <Input
                label="Tags"
                placeholder="Nhập tag rồi nhấn Enter hoặc Thêm..."
                value={editTagInput}
                onChange={(e) => setEditTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddEditTag(); }
                }}
                endContent={
                  editTagInput.trim() && (
                    <Button size="sm" variant="light" onPress={handleAddEditTag} className="min-w-0 px-2">
                      Thêm
                    </Button>
                  )
                }
              />
              {editTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editTags.map((tag) => (
                    <Chip key={tag} onClose={() => setEditTags((p) => p.filter((t) => t !== tag))} variant="flat" color="primary">
                      {tag}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            <Select
              label="Độ khó"
              placeholder="Chọn độ khó..."
              selectedKeys={editForm.card_difficulty ? new Set([editForm.card_difficulty]) : new Set()}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                setEditForm((p) => ({ ...p, card_difficulty: val || "" }));
              }}
            >
              {["1", "2", "3", "4", "5"].map((level) => (
                <SelectItem key={level} textValue={level}>{level}</SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" color="danger" onPress={onEditClose} isDisabled={isSaving}>
              Hủy
            </Button>
            <Button
              color="primary"
              onPress={handleSaveEditCard}
              isLoading={isSaving}
              isDisabled={isSaving || !editForm.card_front.trim() || !editForm.card_back.trim()}
            >
              Lưu
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
