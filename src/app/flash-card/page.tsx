"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  useDisclosure,
  Spinner,
  Pagination,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Input,
  Select,
  SelectItem,
  Avatar,
  Chip,
} from "@heroui/react";
import {
  TrashIcon,
  RectangleStackIcon,
  ClockIcon,
  PlusIcon,
  PencilIcon,
  EyeIcon,
  AcademicCapIcon,
  SparklesIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import useAuthStore from "@/store/useAuthStore";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { flashcardService } from "@/service/flashcard.service";
import { FlashcardDeck } from "@/types/flashcard.type";
import useToast from "@/hooks/useToast";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";
import { useSocket } from "@/components/providers/SocketProvider";
import { roomType } from "@/store/types/room.state";

export default function FlashCardPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { success, error: showError } = useToast();

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose
  } = useDisclosure();
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInputType, setAiInputType] = useState<"text" | "document">("text");
  const [aiTopic, setAiTopic] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiCardCount, setAiCardCount] = useState("10");
  const [aiDifficulty, setAiDifficulty] = useState("3");
  const [aiStreamText, setAiStreamText] = useState("");
  const [aiGeneratedCards, setAiGeneratedCards] = useState(0);

  // Share state
  const { isOpen: isShareOpen, onOpen: onShareOpen, onClose: onShareClose } = useDisclosure();
  const [sharingDeckId, setSharingDeckId] = useState<string | null>(null);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [sharingRoomId, setSharingRoomId] = useState<string | null>(null);
  const [sharedRoomIds, setSharedRoomIds] = useState<Set<string>>(new Set());

  const rooms = useRoomStore((s) => s.rooms);
  const getRooms = useRoomStore((s) => s.getRooms);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const { socket, connect } = useSocket("/chat");

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

  useEffect(() => {
    getRooms();
  }, [getRooms]);

  const filteredRooms = useMemo(() => {
    const q = shareSearchQuery.trim().toLowerCase();
    const sorted = [...rooms].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!q) return sorted.slice(0, 10);
    return sorted.filter((r) => (r.name ?? "").toLowerCase().includes(q));
  }, [rooms, shareSearchQuery]);

  const handleShareClick = (id: string) => {
    setSharingDeckId(id);
    setShareSearchQuery("");
    setSharedRoomIds(new Set());
    onShareOpen();
  };

  const handleShareToRoom = async (room: roomType) => {
    if (!sharingDeckId || !socket || sharingRoomId === room.id) return;
    setSharingRoomId(room.id);
    
    if (!socket.connected) {
      connect();
    }

    try {
      const deck = decks.find(d => d.deck_id === sharingDeckId);
      const shareContent = `${currentUser?.fullname ?? "Bạn"} đã chia sẻ một bộ thẻ ghi nhớ: ${deck?.deck_name ?? "Flashcard Deck"}`;
      await sendMessage({
        roomId: room.id,
        content: shareContent,
        attachments: [],
        type: "flashcard",
        desk_id: deck?._id || sharingDeckId,
        desk: deck,
        socket,
        userId: currentUser?._id || "",
        userFullname: currentUser?.fullname ?? "",
        userAvatar: currentUser?.avatar ?? "",
      });
      setSharedRoomIds((prev) => new Set([...prev, room.id]));
      success("Chia sẻ bộ thẻ thành công");
    } catch {
      showError("Lỗi khi chia sẻ bộ thẻ");
    } finally {
      setSharingRoomId(null);
    }
  };

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

  const {
    isOpen: isAiOpen,
    onOpen: onAiOpen,
    onClose: onAiClose,
  } = useDisclosure();

  const handleCloseAiModal = () => {
    if (isGeneratingAi) return;
    onAiClose();
    setAiInputType("text");
    setAiTopic("");
    setAiFile(null);
    setAiCardCount("10");
    setAiDifficulty("3");
    setAiStreamText("");
    setAiGeneratedCards(0);
  };

  const handleCreateWithAi = async () => {
    const cardCount = Math.min(50, Math.max(1, parseInt(aiCardCount) || 10));
    const difficulty = Math.min(5, Math.max(1, parseInt(aiDifficulty) || 3));
    const topic = aiTopic.trim();

    if (aiInputType === "text" && !topic) {
      showError("Vui lòng nhập chủ đề để tạo flashcard bằng AI.");
      return;
    }

    if (aiInputType === "document" && !aiFile) {
      showError("Vui lòng chọn tài liệu để tạo flashcard bằng AI.");
      return;
    }

    try {
      setIsGeneratingAi(true);
      setAiStreamText("");
      setAiGeneratedCards(0);
      const payload =
        aiInputType === "document" && aiFile
          ? (() => {
              const formData = new FormData();
              formData.append("type", "document");
              formData.append("topic", topic);
              formData.append("card_count", String(cardCount));
              formData.append("difficulty", String(difficulty));
              formData.append("language", "vi");
              formData.append("file", aiFile);
              return formData;
            })()
          : {
              topic,
              type: "text",
              card_count: cardCount,
              difficulty,
              language: "vi",
            };

      const generated = await flashcardService.generateFlashcard(payload, {
        onChunk: (chunk) => {
          setAiStreamText((prev) => {
            const next = `${prev}${chunk}`;
            const tail = next.length > 12000 ? next.slice(-12000) : next;
            const count = tail.match(/"card_front"\s*:/g)?.length ?? 0;
            setAiGeneratedCards(count);
            return tail;
          });
        },
      });

      await flashcardService.createDeck({
        deck_name: generated.deck_name || `Bộ thẻ: ${topic || aiFile?.name || "AI"}`,
        ...(generated.deck_description && {
          deck_description: generated.deck_description,
        }),
        ...(generated.deck_level && { deck_level: generated.deck_level as any }),
        ...(generated.deck_language && { deck_language: generated.deck_language }),
        ...(generated.deck_tags?.length ? { deck_tags: generated.deck_tags } : {}),
        flashcards: (generated.flashcards || []).map((card) => ({
          card_front: card.card_front,
          card_back: card.card_back,
          ...(card.card_hint ? { card_hint: card.card_hint } : {}),
          ...(card.card_tags?.length ? { card_tags: card.card_tags } : {}),
          ...(card.card_difficulty ? { card_difficulty: card.card_difficulty } : {}),
        })),
      });

      await fetchDecks();
      success("Đã tạo bộ flashcard với AI thành công.");
      handleCloseAiModal();
    } catch (error) {
      console.error("Error creating flashcard with AI:", error);
      showError("Không thể tạo flashcard với AI. Vui lòng thử lại.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const aiTargetCards = Math.min(50, Math.max(1, parseInt(aiCardCount) || 10));
  const aiCurrentCards = Math.min(aiGeneratedCards, aiTargetCards);
  const aiPercent = Math.min(100, Math.round((aiCurrentCards / aiTargetCards) * 100));
  const aiStatusText =
    aiGeneratedCards > 0
      ? `AI đang tạo ${aiCurrentCards}/${aiTargetCards} thẻ (${aiPercent}%)`
      : "AI đang phân tích nội dung và lên cấu trúc flashcard...";

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
          <div className="flex items-center gap-2">
            <Button
              variant="flat"
              color="secondary"
              startContent={<SparklesIcon className="w-5 h-5" />}
              onPress={onAiOpen}
            >
              Tạo với AI
            </Button>
            <Button
              color="primary"
              startContent={<PlusIcon className="w-5 h-5" />}
              onPress={handleCreate}
            >
              Tạo bộ
            </Button>
          </div>
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
                        color="secondary"
                        onPress={() => handleShareClick(setId)}
                        aria-label="Chia sẻ bộ flashcard"
                      >
                        <ShareIcon className="w-4 h-4" />
                      </Button>
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

      <Modal isOpen={isAiOpen} onClose={handleCloseAiModal} placement="center">
        <ModalContent>
          <ModalHeader>Tạo flashcard với AI</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Nguồn dữ liệu"
              value={aiInputType === "text" ? "Text chủ đề" : "Tài liệu file"}
              isReadOnly
              className="hidden"
            />
            <Select
              label="Nguồn dữ liệu"
              selectedKeys={new Set([aiInputType])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as "text" | "document";
                if (!selected) return;
                setAiInputType(selected);
                setAiFile(null);
              }}
            >
              <SelectItem key="text">Text chủ đề</SelectItem>
              <SelectItem key="document">Tài liệu file</SelectItem>
            </Select>
            {aiInputType === "text" ? (
              <Input
                label="Chủ đề"
                placeholder="VD: React hooks, TOEIC vocabulary, Giải tích 2..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                isRequired
              />
            ) : (
              <Input
                type="file"
                label="Tài liệu"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                description={aiFile ? `Đã chọn: ${aiFile.name}` : "Hỗ trợ PDF, DOC, DOCX, TXT"}
                isRequired
              />
            )}
            <Input
              type="number"
              label="Số lượng thẻ"
              min={1}
              max={50}
              value={aiCardCount}
              onChange={(e) => setAiCardCount(e.target.value)}
            />
            <Select
              label="Độ khó"
              selectedKeys={new Set([aiDifficulty])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) setAiDifficulty(selected);
              }}
            >
              <SelectItem key="1">1 - Rất dễ</SelectItem>
              <SelectItem key="2">2 - Dễ</SelectItem>
              <SelectItem key="3">3 - Trung bình</SelectItem>
              <SelectItem key="4">4 - Khó</SelectItem>
              <SelectItem key="5">5 - Rất khó</SelectItem>
            </Select>
            {isGeneratingAi && (
              <div className="w-full p-3 rounded-lg bg-default-100/60 border border-default-200">
                <p className="text-xs uppercase tracking-wide text-default-500 mb-2">
                  Tiến trình AI
                </p>
                <p className="text-sm text-default-600/90">{aiStatusText}</p>
                <p className="text-xs text-default-500/80 mt-1 line-clamp-2">
                  {aiStreamText
                    ? "AI đang suy nghĩ và tổng hợp dữ liệu..."
                    : "Đang chờ dữ liệu stream từ AI..."}
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseAiModal} isDisabled={isGeneratingAi}>
              Hủy
            </Button>
            <Button
              color="secondary"
              onPress={handleCreateWithAi}
              isLoading={isGeneratingAi}
              isDisabled={
                isGeneratingAi ||
                (aiInputType === "text" ? !aiTopic.trim() : !aiFile)
              }
            >
              Tạo với AI
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Share Modal */}
      <Modal isOpen={isShareOpen} onClose={onShareClose} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-bold">Chia sẻ bộ thẻ ghi nhớ</h3>
          </ModalHeader>
          <ModalBody className="pb-6">
            <Input
              placeholder="Tìm kiếm phòng chat..."
              value={shareSearchQuery}
              onChange={(e) => setShareSearchQuery(e.target.value)}
              className="mb-4"
              size="sm"
            />
            {filteredRooms.length === 0 ? (
              <p className="text-sm text-center text-gray-400 py-6">Không tìm thấy phòng chat nào</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {filteredRooms.map((room) => {
                  const isShared = sharedRoomIds.has(room.id);
                  const isSharing = sharingRoomId === room.id;
                  const roomName = room.name ?? "Phòng chưa đặt tên";
                  return (
                    <div
                      key={room.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer border
                        ${isShared
                          ? "bg-success/10 border-success/30 dark:bg-success/10"
                          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      onClick={() => !isShared && !isSharing && handleShareToRoom(room)}
                    >
                      <Avatar
                        src={room.avatar ?? undefined}
                        name={roomName}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {roomName}
                        </p>
                        <p className="text-[11px] text-gray-400 capitalize">{room.type}</p>
                      </div>
                      {isShared ? (
                        <Chip size="sm" color="success" variant="flat" className="text-[11px] h-5 shrink-0">
                          Đã gửi
                        </Chip>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isLoading={isSharing}
                          isDisabled={!!sharingRoomId}
                          className="h-7 text-xs shrink-0"
                          onPress={() => handleShareToRoom(room)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Gửi
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onShareClose}>
              Đóng
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

