"use client";

import { useState } from "react";
import {
  Button,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { MessageType } from "@/store/types/message.state";
import { flashcardService, GenerateFlashcardResponse } from "@/service/flashcard.service";
import { CreateFlashcardCardForm } from "@/components/flash-card/forms/FlashcardDeckForm";
import { FlashcardCardFormItem } from "@/components/flash-card/modals/FlashcardCardFormItem";
import useToast from "@/hooks/useToast";

interface FlashcardConfigModalProps {
  isOpen: boolean;
  msg: MessageType;
  onClose: () => void;
}

const DIFFICULTY_OPTIONS = [
  { value: "1", label: "1 – Rất dễ" },
  { value: "2", label: "2 – Dễ" },
  { value: "3", label: "3 – Trung bình" },
  { value: "4", label: "4 – Khó" },
  { value: "5", label: "5 – Rất khó" },
];

const LEVEL_OPTIONS = [
  { value: "beginner", label: "Dễ" },
  { value: "intermediate", label: "Trung bình" },
  { value: "advanced", label: "Khó" },
  { value: "expert", label: "Chuyên gia" },
];

const EMPTY_CARD: CreateFlashcardCardForm = {
  card_front: "",
  card_back: "",
  card_hint: "",
  card_tags: [],
  card_difficulty: undefined,
};

type Step = "config" | "result";

export function FlashcardConfigModal({
  isOpen,
  msg,
  onClose,
}: FlashcardConfigModalProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const [step, setStep] = useState<Step>("config");

  // --- Config step ---
  const [cardCount, setCardCount] = useState(10);
  const [difficulty, setDifficulty] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Result step ---
  const [deckName, setDeckName] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [deckLevel, setDeckLevel] = useState("beginner");
  const [deckLanguage, setDeckLanguage] = useState("vi");
  const [deckTags, setDeckTags] = useState<string[]>([]);
  const [deckTagInput, setDeckTagInput] = useState("");
  const [cards, setCards] = useState<CreateFlashcardCardForm[]>([]);
  const [cardTagInputs, setCardTagInputs] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ---------- helpers ----------

  const handleClose = () => {
    setStep("config");
    onClose();
  };

  // ---------- step: config ----------

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let payload: FormData | Record<string, unknown>;

      if (msg.type === "text") {
        payload = {
          card_count: cardCount,
          difficulty: difficulty,
          language: i18n.language || "vi",
          type: "text",
          topic: msg.content || "",
        };
      } else {
        const attachment = (msg.attachments || []).find(
          (a) => a.uploadedUrl || a.url,
        );
        if (!attachment) {
          throw new Error(
            t("chat.hooks.flashcard.noFile", "Không tìm thấy tệp đính kèm"),
          );
        }
        const fileUrl = attachment.uploadedUrl || attachment.url;
        payload = {
          card_count: cardCount,
          difficulty: difficulty,
          language: i18n.language || "vi",
          type: "file_url",
          file_url: fileUrl,
        };
      }

      const data = await flashcardService.generateFlashcard(payload);
      applyGeneratedData(data);
      setStep("result");
    } catch (error) {
      console.error("Lỗi khi tạo flashcard:", error);
      toast.error(t("chat.hooks.flashcard.error", "Không thể tạo flashcard. Vui lòng thử lại."));
    } finally {
      setIsGenerating(false);
    }
  };

  const applyGeneratedData = (data: GenerateFlashcardResponse) => {
    setDeckName(data.deck_name || "");
    setDeckDescription(data.deck_description || "");
    setDeckLevel(data.deck_level || "beginner");
    setDeckLanguage(data.deck_language || "vi");
    setDeckTags(data.deck_tags || []);
    setDeckTagInput("");
    setCards(
      (data.flashcards || []).map((c) => ({
        card_front: c.card_front,
        card_back: c.card_back,
        card_hint: c.card_hint || "",
        card_tags: c.card_tags || [],
        card_difficulty: c.card_difficulty,
      })),
    );
    setCardTagInputs({});
  };

  // ---------- step: result – deck tag ----------

  const handleAddDeckTag = () => {
    const trimmed = deckTagInput.trim();
    if (trimmed && !deckTags.includes(trimmed)) {
      setDeckTags((p) => [...p, trimmed]);
      setDeckTagInput("");
    }
  };

  // ---------- step: result – cards ----------

  const handleAddCard = () => {
    setCards((prev) => [...prev, { ...EMPTY_CARD, card_tags: [] }]);
  };

  const handleRemoveCard = (index: number) => {
    setCards((prev) => prev.filter((_, i) => i !== index));
    setCardTagInputs((prev) => {
      const updated: Record<number, string> = {};
      Object.keys(prev).forEach((k) => {
        const ki = parseInt(k);
        if (ki < index) updated[ki] = prev[ki];
        else if (ki > index) updated[ki - 1] = prev[ki];
      });
      return updated;
    });
  };

  const handleChangeCardField = (
    index: number,
    field: keyof CreateFlashcardCardForm,
    value: any,
  ) => {
    setCards((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddCardTag = (index: number) => {
    const trimmed = (cardTagInputs[index] || "").trim();
    if (trimmed && !cards[index]?.card_tags?.includes(trimmed)) {
      setCards((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          card_tags: [...(updated[index].card_tags || []), trimmed],
        };
        return updated;
      });
      setCardTagInputs((prev) => ({ ...prev, [index]: "" }));
    }
  };

  const handleRemoveCardTag = (index: number, tag: string) => {
    setCards((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        card_tags: updated[index].card_tags?.filter((t) => t !== tag) || [],
      };
      return updated;
    });
  };

  // ---------- step: result – save ----------

  const handleSave = async () => {
    if (!deckName.trim()) return;
    setIsSaving(true);
    try {
      await flashcardService.createDeck({
        deck_name: deckName.trim(),
        ...(deckDescription.trim() && { deck_description: deckDescription.trim() }),
        ...(deckLevel && { deck_level: deckLevel as any }),
        ...(deckLanguage.trim() && { deck_language: deckLanguage.trim() }),
        ...(deckTags.length > 0 && { deck_tags: deckTags }),
        flashcards: cards.map((c) => ({
          card_front: c.card_front,
          card_back: c.card_back,
          ...(c.card_hint && { card_hint: c.card_hint }),
          ...(c.card_tags?.length && { card_tags: c.card_tags }),
          ...(c.card_difficulty && { card_difficulty: c.card_difficulty }),
        })),
      });
      toast.success("Đã tạo bộ flashcard thành công!");
      handleClose();
    } catch (error) {
      console.error("Lỗi khi tạo bộ flashcard:", error);
      toast.error("Không thể tạo bộ flashcard. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- render ----------

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={step === "config" ? "sm" : "3xl"}
      scrollBehavior="inside"
      placement="center"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span className="text-base font-bold">Tạo Flashcard bằng AI</span>
          {step === "result" && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              Xem lại và chỉnh sửa trước khi lưu
            </span>
          )}
        </ModalHeader>

        <ModalBody className="space-y-4 pb-2">
          {step === "config" ? (
            <>
              <Input
                type="number"
                label="Số lượng thẻ"
                placeholder="1 – 50"
                min={1}
                max={50}
                value={String(cardCount)}
                description="Tối đa 50 thẻ"
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) setCardCount(Math.min(50, Math.max(1, v)));
                }}
              />
              <Select
                label="Độ khó"
                selectedKeys={new Set([String(difficulty)])}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val) setDifficulty(parseInt(val));
                }}
              >
                {DIFFICULTY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} textValue={o.label}>
                    {o.label}
                  </SelectItem>
                ))}
              </Select>
            </>
          ) : (
            <div className="space-y-5">
              {/* Deck Info */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Thông tin bộ thẻ
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    className="md:col-span-2"
                    label="Tên bộ thẻ"
                    placeholder="Nhập tên bộ thẻ..."
                    value={deckName}
                    isRequired
                    maxLength={255}
                    onChange={(e) => setDeckName(e.target.value)}
                  />
                  <Select
                    label="Mức độ"
                    selectedKeys={deckLevel ? new Set([deckLevel]) : new Set()}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0] as string;
                      if (val) setDeckLevel(val);
                    }}
                  >
                    {LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} textValue={o.label}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  label="Mô tả"
                  placeholder="Mô tả bộ thẻ..."
                  value={deckDescription}
                  maxLength={1000}
                  minRows={2}
                  onChange={(e) => setDeckDescription(e.target.value)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Ngôn ngữ"
                    placeholder="vi, en, ..."
                    value={deckLanguage}
                    maxLength={20}
                    onChange={(e) => setDeckLanguage(e.target.value)}
                  />
                  <div className="space-y-2">
                    <Input
                      label="Tags bộ thẻ"
                      placeholder="Nhập tag rồi nhấn Enter..."
                      value={deckTagInput}
                      onChange={(e) => setDeckTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleAddDeckTag(); }
                      }}
                      endContent={
                        deckTagInput.trim() && (
                          <Button size="sm" variant="light" onPress={handleAddDeckTag} className="min-w-0 px-2">
                            <PlusIcon className="w-4 h-4" />
                          </Button>
                        )
                      }
                    />
                    {deckTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {deckTags.map((tag) => (
                          <Chip
                            key={tag}
                            size="sm"
                            variant="flat"
                            color="primary"
                            onClose={() => setDeckTags((p) => p.filter((t) => t !== tag))}
                          >
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Divider />

              {/* Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Danh sách thẻ
                  </p>
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="flat" color="primary">
                      {cards.length} thẻ
                    </Chip>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      startContent={<PlusIcon className="w-4 h-4" />}
                      onPress={handleAddCard}
                      isDisabled={isSaving}
                    >
                      Thêm thẻ
                    </Button>
                  </div>
                </div>

                {cards.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Không có thẻ nào
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cards.map((card, index) => (
                      <FlashcardCardFormItem
                        key={index}
                        cardIndex={index}
                        cardForm={card}
                        tagInput={cardTagInputs[index] || ""}
                        totalCards={cards.length}
                        isSaving={isSaving}
                        onRemove={() => handleRemoveCard(index)}
                        onChangeField={(field, value) => handleChangeCardField(index, field, value)}
                        onBlurField={() => {}}
                        onTagInputChange={(val) =>
                          setCardTagInputs((prev) => ({ ...prev, [index]: val }))
                        }
                        onAddTag={() => handleAddCardTag(index)}
                        onRemoveTag={(tag) => handleRemoveCardTag(index, tag)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {step === "config" ? (
            <>
              <Button variant="light" color="danger" onPress={handleClose} isDisabled={isGenerating}>
                Hủy
              </Button>
              <Button color="primary" isLoading={isGenerating} isDisabled={isGenerating} onPress={handleGenerate}>
                Tạo
              </Button>
            </>
          ) : (
            <>
              <Button variant="light" onPress={() => setStep("config")} isDisabled={isSaving}>
                Quay lại
              </Button>
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={isSaving}
                isDisabled={isSaving || !deckName.trim() || cards.length === 0}
              >
                Tạo bộ thẻ ({cards.length} thẻ)
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
