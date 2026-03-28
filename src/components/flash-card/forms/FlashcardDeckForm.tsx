"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Checkbox,
  Chip,
  Pagination,
} from "@heroui/react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import Joi from "joi";
import { useTranslation } from "react-i18next";
import { flashcardService } from "@/service/flashcard.service";
import UploadService from "@/service/uploadfile.service";
import { CreateFlashcardDeckPayload, FlashcardDeck } from "@/types/flashcard.type";
import { getFlashcardDeckSchema, getFlashcardCardSchema } from "@/forms/flashcard.schema";
import { FlashcardCardFormItem } from "../modals/FlashcardCardFormItem";
import useAuthStore from "@/store/useAuthStore";
import { useRouter } from "next/navigation";

interface CreateFlashcardDeckForm {
  deck_name: string;
  deck_description?: string;
  deck_image?: string;
  deck_tags?: string[];
  deck_level?: "beginner" | "intermediate" | "advanced" | "expert";
  deck_language?: string;
}

export interface CreateFlashcardCardForm {
  card_id?: string;
  card_front: string;
  card_back: string;
  card_hint?: string;
  card_tags?: string[];
  card_difficulty?: number;
}

interface FlashcardDeckFormProps {
  initialData?: FlashcardDeck;
}

export default function FlashcardDeckForm({ initialData }: FlashcardDeckFormProps) {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const userId = currentUser?._id || "";
  const { t } = useTranslation();

  // Level options với translation
  const levelOptions = useMemo(
    () => [
      { value: "beginner", label: "Dễ" },
      { value: "intermediate", label: t("flashcard.levels.intermediate") },
      { value: "advanced", label: t("flashcard.levels.advanced") },
      { value: "expert", label: t("flashcard.levels.expert") },
    ],
    [t]
  );

  // Schema validation cho form flashcard deck với translation
  const flashcardDeckSchema = useMemo(() => getFlashcardDeckSchema(t), [t]);

  const [deckImageFile, setDeckImageFile] = useState<File | null>(null);

  const [form, setForm] = useState<CreateFlashcardDeckForm>({
    deck_name: "",
    deck_description: "",
    deck_image: "",
    deck_tags: [],
    deck_level: "beginner",
    deck_language: "",
  });

  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof CreateFlashcardDeckForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardForms, setCardForms] = useState<CreateFlashcardCardForm[]>([]);
  const [cardTagInputs, setCardTagInputs] = useState<Record<number, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<number, Partial<Record<keyof CreateFlashcardCardForm, string>>>>({});
  const [cardLoadingStates, setCardLoadingStates] = useState<
    Record<number, { saving?: boolean; updating?: boolean; deleting?: boolean }>
  >({});

  // Pagination for cards
  const [cardPage, setCardPage] = useState(1);
  const cardPageSize = 10;
  const cardTotalPages = useMemo(() => Math.ceil(cardForms.length / cardPageSize) || 1, [cardForms.length]);

  const currentCardForms = useMemo(() => {
    const start = (cardPage - 1) * cardPageSize;
    return cardForms.slice(start, start + cardPageSize);
  }, [cardForms, cardPage]);

  // Handle page out of bounds when removing cards
  useEffect(() => {
    if (cardPage > cardTotalPages) {
      setCardPage(cardTotalPages);
    }
  }, [cardTotalPages, cardPage]);

  // Schema validation cho flashcard card
  const flashcardCardSchema = useMemo(() => getFlashcardCardSchema(t), [t]);

  // Init khi update
  useEffect(() => {
    if (initialData) {
      setForm({
        deck_name: initialData.deck_name || "",
        deck_description: initialData.deck_description || "",
        deck_image: initialData.deck_image || "",
        deck_tags: initialData.deck_tags || [],
        deck_level: initialData.deck_level || "beginner",
        deck_language: initialData.deck_language || "",
      });

      const fetchCards = async () => {
        if (!initialData.deck_id) return;
        try {
          const res = await flashcardService.getListFlashcard({
            page: 1,
            limit: 1000,
            userId: userId,
            deckId: initialData.deck_id
          });

          let cards: any[] = [];
          if (res && res.data) {
            cards = res.data;
          } else if (Array.isArray(res)) {
            cards = res;
          }

          if (cards.length > 0) {
            const mappedCards = cards.map((card: any) => ({
              card_id: card.card_id,
              card_front: card.card_front || "",
              card_back: card.card_back || "",
              card_hint: card.card_hint || "",
              card_tags: card.card_tags || [],
              card_difficulty: card.card_difficulty,
            }));
            setCardForms(mappedCards);
          } else {
            setCardForms([]);
          }
        } catch (error) {
          console.error("Error fetching flashcards for deck update:", error);
        }
      };

      fetchCards();
    } else {
      setForm({
        deck_name: "",
        deck_description: "",
        deck_image: "",
        deck_tags: [],
        deck_level: "beginner",
        deck_language: "",
      });
      setCardForms([]);
    }
    setTagInput("");
    setErrors({});
    setIsSubmitting(false);
    setCardTagInputs({});
    setCardErrors({});
    setDeckImageFile(null);
  }, [initialData, userId]);

  const validateForm = (): boolean => {
    // Chuẩn bị data để validate (chuyển empty string thành undefined cho optional fields)
    const dataToValidate = {
      deck_name: form.deck_name.trim(),
      deck_description: form.deck_description?.trim() || undefined,
      deck_image: form.deck_image?.trim() || undefined,
      deck_tags: form.deck_tags && form.deck_tags.length > 0 ? form.deck_tags : undefined,
      deck_level: form.deck_level || undefined,
      deck_language: form.deck_language?.trim() || undefined,
    };

    const { error } = flashcardDeckSchema.validate(dataToValidate, {
      abortEarly: false,
    });

    if (error) {
      const newErrors: Partial<Record<keyof CreateFlashcardDeckForm, string>> = {};
      error.details.forEach((detail) => {
        const field = detail.path[0] as keyof CreateFlashcardDeckForm;
        newErrors[field] = detail.message;
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !form.deck_tags?.includes(trimmedTag)) {
      setForm((prev) => ({
        ...prev,
        deck_tags: [...(prev.deck_tags || []), trimmedTag],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      deck_tags: prev.deck_tags?.filter((tag) => tag !== tagToRemove) || [],
    }));
  };

  const handleAddCard = () => {
    setCardForms((prev) => {
      const newForms = [
        ...prev,
        {
          card_front: "",
          card_back: "",
          card_hint: "",
          card_tags: [],
          card_difficulty: undefined,
        },
      ];
      setCardPage(Math.ceil(newForms.length / cardPageSize) || 1);
      return newForms;
    });
  };

  const handleRemoveCard = (index: number) => {
    setCardForms((prev) => prev.filter((_, i) => i !== index));
    setCardTagInputs((prev) => {
      const newInputs = { ...prev };
      delete newInputs[index];
      // Reindex remaining inputs
      const reindexed: Record<number, string> = {};
      Object.keys(newInputs).forEach((key) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newInputs[oldIndex];
        } else {
          reindexed[oldIndex] = newInputs[oldIndex];
        }
      });
      return reindexed;
    });
    setCardErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[index];
      // Reindex remaining errors
      const reindexed: Record<number, Partial<Record<keyof CreateFlashcardCardForm, string>>> = {};
      Object.keys(newErrors).forEach((key) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newErrors[oldIndex];
        } else {
          reindexed[oldIndex] = newErrors[oldIndex];
        }
      });
      return reindexed;
    });
  };

  const handleAddCardTag = (cardIndex: number) => {
    const trimmedTag = (cardTagInputs[cardIndex] || "").trim();
    if (trimmedTag && !cardForms[cardIndex]?.card_tags?.includes(trimmedTag)) {
      setCardForms((prev) => {
        const updated = [...prev];
        updated[cardIndex] = {
          ...updated[cardIndex],
          card_tags: [...(updated[cardIndex].card_tags || []), trimmedTag],
        };
        return updated;
      });
      setCardTagInputs((prev) => ({ ...prev, [cardIndex]: "" }));
    }
  };

  const handleRemoveCardTag = (cardIndex: number, tagToRemove: string) => {
    setCardForms((prev) => {
      const updated = [...prev];
      updated[cardIndex] = {
        ...updated[cardIndex],
        card_tags: updated[cardIndex].card_tags?.filter((tag) => tag !== tagToRemove) || [],
      };
      return updated;
    });
  };

  const validateCardForms = (): boolean => {
    if (cardForms.length === 0) return true;

    let isValid = true;
    const newErrors: Record<number, Partial<Record<keyof CreateFlashcardCardForm, string>>> = {};

    cardForms.forEach((cardForm, index) => {
      const dataToValidate = {
        card_front: cardForm.card_front.trim(),
        card_back: cardForm.card_back.trim(),
        card_hint: cardForm.card_hint?.trim() || undefined,
        card_tags: cardForm.card_tags && cardForm.card_tags.length > 0 ? cardForm.card_tags : undefined,
        card_difficulty: cardForm.card_difficulty || undefined,
      };

      const { error } = flashcardCardSchema.validate(dataToValidate, {
        abortEarly: false,
      });

      if (error) {
        isValid = false;
        const cardErrors: Partial<Record<keyof CreateFlashcardCardForm, string>> = {};
        error.details.forEach((detail) => {
          const field = detail.path[0] as keyof CreateFlashcardCardForm;
          cardErrors[field] = detail.message;
        });
        newErrors[index] = cardErrors;
      }
    });

    setCardErrors(newErrors);
    return isValid;
  };

  const validateCardField = (cardIndex: number, field: keyof CreateFlashcardCardForm, value: any) => {
    const cardForm = cardForms[cardIndex];
    const dataToValidate: Partial<CreateFlashcardCardForm> = {
      ...cardForm,
      [field]: value,
    };

    const fieldSchema = flashcardCardSchema.extract(field);
    const { error } = fieldSchema.validate(dataToValidate[field], {
      abortEarly: true,
    });

    setCardErrors((prev) => ({
      ...prev,
      [cardIndex]: {
        ...prev[cardIndex],
        [field]: error ? error.details[0].message : undefined,
      },
    }));
  };

  // Validate từng field khi blur
  const validateField = (field: keyof CreateFlashcardDeckForm, value: any) => {
    // Tạo object với chỉ field cần validate
    const dataToValidate: Partial<CreateFlashcardDeckForm> = {
      ...form,
      [field]: value,
    };

    // Validate chỉ field đó
    const fieldSchema = flashcardDeckSchema.extract(field);
    const { error } = fieldSchema.validate(dataToValidate[field], {
      abortEarly: true,
    });

    setErrors((prev) => ({
      ...prev,
      [field]: error ? error.details[0].message : undefined,
    }));
  };

  const setCardLoading = (index: number, key: "saving" | "updating" | "deleting", value: boolean) => {
    setCardLoadingStates((prev) => ({
      ...prev,
      [index]: { ...prev[index], [key]: value },
    }));
  };

  const validateSingleCard = (cardIndex: number): boolean => {
    const cardForm = cardForms[cardIndex];
    const dataToValidate = {
      card_front: cardForm.card_front.trim(),
      card_back: cardForm.card_back.trim(),
      card_hint: cardForm.card_hint?.trim() || undefined,
      card_tags: cardForm.card_tags && cardForm.card_tags.length > 0 ? cardForm.card_tags : undefined,
      card_difficulty: cardForm.card_difficulty || undefined,
    };
    const { error } = flashcardCardSchema.validate(dataToValidate, { abortEarly: false });
    if (error) {
      const errs: Partial<Record<keyof CreateFlashcardCardForm, string>> = {};
      error.details.forEach((d) => {
        const field = d.path[0] as keyof CreateFlashcardCardForm;
        errs[field] = d.message;
      });
      setCardErrors((prev) => ({ ...prev, [cardIndex]: errs }));
      return false;
    }
    setCardErrors((prev) => ({ ...prev, [cardIndex]: {} }));
    return true;
  };

  const handleSaveCard = async (cardIndex: number) => {
    if (!initialData?.deck_id) return;
    if (!validateSingleCard(cardIndex)) return;
    const cardForm = cardForms[cardIndex];
    setCardLoading(cardIndex, "saving", true);
    try {
      const created = await flashcardService.createCard({
        card_deckId: initialData.deck_id,
        card_front: cardForm.card_front.trim(),
        card_back: cardForm.card_back.trim(),
        ...(cardForm.card_hint?.trim() && { card_hint: cardForm.card_hint.trim() }),
        ...(cardForm.card_tags && cardForm.card_tags.length > 0 && { card_tags: cardForm.card_tags }),
        ...(cardForm.card_difficulty && { card_difficulty: cardForm.card_difficulty }),
      });
      const savedId = (created as any)?.card_id || (created as any)?._id || (created as any)?.id;
      if (savedId) {
        setCardForms((prev) => {
          const updated = [...prev];
          updated[cardIndex] = { ...updated[cardIndex], card_id: savedId };
          return updated;
        });
      }
    } catch (error) {
      console.error("Lỗi khi tạo thẻ:", error);
    } finally {
      setCardLoading(cardIndex, "saving", false);
    }
  };

  const handleUpdateCard = async (cardIndex: number) => {
    const cardForm = cardForms[cardIndex];
    if (!cardForm.card_id) return;
    if (!validateSingleCard(cardIndex)) return;
    setCardLoading(cardIndex, "updating", true);
    try {
      await flashcardService.updateCard(cardForm.card_id, {
        card_front: cardForm.card_front.trim(),
        card_back: cardForm.card_back.trim(),
        ...(cardForm.card_hint?.trim() && { card_hint: cardForm.card_hint.trim() }),
        ...(cardForm.card_tags && cardForm.card_tags.length > 0 && { card_tags: cardForm.card_tags }),
        ...(cardForm.card_difficulty && { card_difficulty: cardForm.card_difficulty }),
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật thẻ:", error);
    } finally {
      setCardLoading(cardIndex, "updating", false);
    }
  };

  const handleDeleteCard = async (cardIndex: number) => {
    const cardForm = cardForms[cardIndex];
    if (!cardForm.card_id) return;
    setCardLoading(cardIndex, "deleting", true);
    try {
      await flashcardService.deleteCard(cardForm.card_id);
      handleRemoveCard(cardIndex);
    } catch (error) {
      console.error("Lỗi khi xóa thẻ:", error);
      setCardLoading(cardIndex, "deleting", false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (cardForms.length > 0 && !validateCardForms()) {
      return;
    }

    setIsSubmitting(true);
    try {
      let deckImageUrl = form.deck_image?.trim() || undefined;
      if (deckImageFile) {
        const res = await UploadService.uploadSingle(deckImageFile, "flashcard");
        if (res.data?.metadata?.url) {
          deckImageUrl = res.data.metadata.url;
        }
      }

      const uploadedCards = await Promise.all(
        cardForms.map(async (cardForm) => {
          return {
            ...(cardForm.card_id ? { card_id: cardForm.card_id } : {}),
            card_deckId: "", // Will be assigned by backend
            card_front: cardForm.card_front.trim(),
            card_back: cardForm.card_back.trim(),
            ...(cardForm.card_hint?.trim() && { card_hint: cardForm.card_hint.trim() }),
            ...(cardForm.card_tags && cardForm.card_tags.length > 0 && { card_tags: cardForm.card_tags }),
            ...(cardForm.card_difficulty && { card_difficulty: cardForm.card_difficulty }),
          };
        })
      );

      const deckPayload: CreateFlashcardDeckPayload = {
        deck_name: form.deck_name.trim(),
        ...(form.deck_description?.trim() && {
          deck_description: form.deck_description.trim(),
        }),
        ...(deckImageUrl && { deck_image: deckImageUrl }),
        ...(form.deck_tags && form.deck_tags.length > 0 && { deck_tags: form.deck_tags }),
        ...(form.deck_level && { deck_level: form.deck_level }),
        ...(form.deck_language?.trim() && { deck_language: form.deck_language.trim() }),
      };

      // Call API
      if (initialData?.deck_id) {
        // When editing: update deck info only; cards are managed individually via per-card buttons
        const updatedDeck = await flashcardService.updateDeck(initialData.deck_id, deckPayload);
        console.log("Deck updated successfully:", updatedDeck);
      } else {
        // When creating: bundle all cards in one request
        const submitData: CreateFlashcardDeckPayload = {
          ...deckPayload,
          ...(uploadedCards.length > 0 && { flashcards: uploadedCards }),
        };
        const newDeck = await flashcardService.createDeck(submitData);
        console.log("Deck created successfully:", newDeck);
      }

      router.push("/flash-card");
    } catch (error) {
      console.error("Error creating flashcard deck:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h3 className="text-2xl font-bold">
          {initialData ? t("flashcard.modal.updateDeck.title", "Cập nhật bộ thẻ") : t("flashcard.modal.createDeck.title")}
        </h3>
      </div>

      <div className="gap-6 flex flex-col">
        {/* Tên bộ thẻ & Mức độ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input
            className="md:col-span-2"
            label={t("flashcard.modal.createDeck.nameLabel")}
            placeholder={t("flashcard.modal.createDeck.namePlaceholder")}
            value={form.deck_name}
            isRequired
            isInvalid={!!errors.deck_name}
            errorMessage={errors.deck_name}
            maxLength={255}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, deck_name: e.target.value }));
              if (errors.deck_name) {
                setErrors((prev) => ({ ...prev, deck_name: undefined }));
              }
            }}
            onBlur={() => validateField("deck_name", form.deck_name.trim())}
          />
          <Select
            className="md:col-span-1"
            label={t("flashcard.modal.createDeck.levelLabel")}
            placeholder={t("flashcard.modal.createDeck.levelPlaceholder")}
            selectedKeys={form.deck_level ? [form.deck_level] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setForm((prev) => ({
                ...prev,
                deck_level: selected
                  ? (selected as "beginner" | "intermediate" | "advanced" | "expert")
                  : undefined,
              }));
            }}
          >
            {levelOptions.map((option) => (
              <SelectItem key={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        {/* Mô tả */}
        <Textarea
          label={t("flashcard.modal.createDeck.descriptionLabel")}
          placeholder={t("flashcard.modal.createDeck.descriptionPlaceholder")}
          value={form.deck_description || ""}
          isInvalid={!!errors.deck_description}
          errorMessage={errors.deck_description}
          maxLength={1000}
          minRows={3}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, deck_description: e.target.value }));
            if (errors.deck_description) {
              setErrors((prev) => ({ ...prev, deck_description: undefined }));
            }
          }}
          onBlur={() =>
            validateField("deck_description", form.deck_description?.trim() || "")
          }
        />

        {/* Tags & Ngôn ngữ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-2">
            <Input
              label={t("flashcard.modal.createDeck.tagsLabel")}
              placeholder={t("flashcard.modal.createDeck.tagsPlaceholder")}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              endContent={
                tagInput.trim() && (
                  <Button
                    size="sm"
                    variant="light"
                    onPress={handleAddTag}
                    className="min-w-0 px-2"
                  >
                    {t("flashcard.modal.createDeck.addTag")}
                  </Button>
                )
              }
            />
            {form.deck_tags && form.deck_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.deck_tags.map((tag) => (
                  <Chip
                    key={tag}
                    onClose={() => handleRemoveTag(tag)}
                    variant="flat"
                    color="primary"
                  >
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          <Input
            className="md:col-span-1"
            label={t("flashcard.modal.createDeck.languageLabel")}
            placeholder={t("flashcard.modal.createDeck.languagePlaceholder")}
            value={form.deck_language || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, deck_language: e.target.value }))
            }
            onBlur={() =>
              validateField("deck_language", form.deck_language?.trim() || "")
            }
          />
        </div>

        {/* Hình ảnh Bộ thẻ (File) */}
        <div className="grid grid-cols-1 gap-6 items-center">
          <Input
            type="file"
            accept="image/*"
            label={t("flashcard.modal.createDeck.imageLabel")}
            placeholder={t("flashcard.modal.createDeck.imagePlaceholder")}
            isInvalid={!!errors.deck_image}
            errorMessage={errors.deck_image}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setDeckImageFile(file);
              if (errors.deck_image) {
                setErrors((prev) => ({ ...prev, deck_image: undefined }));
              }
            }}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

        {/* Card Forms */}
        <div className="space-y-6 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">
              {t("flashcard.modal.createDeck.cardFormTitle")}
            </h4>
            <Button
              size="sm"
              color="primary"
              variant="flat"
              startContent={<PlusIcon className="w-4 h-4" />}
              onPress={handleAddCard}
            >
              {t("flashcard.modal.createDeck.addCard")}
            </Button>
          </div>

          {currentCardForms.map((cardForm, indexInPage) => {
            const cardIndex = (cardPage - 1) * cardPageSize + indexInPage;
            return (
              <FlashcardCardFormItem
                key={cardIndex}
                cardIndex={cardIndex}
                cardForm={cardForm}
                error={cardErrors[cardIndex]}
                tagInput={cardTagInputs[cardIndex] || ""}
                totalCards={cardForms.length}
                isExisting={!!cardForm.card_id}
                isSaving={cardLoadingStates[cardIndex]?.saving}
                isUpdating={cardLoadingStates[cardIndex]?.updating}
                isDeleting={cardLoadingStates[cardIndex]?.deleting}
                onRemove={() => handleRemoveCard(cardIndex)}
                onSave={initialData ? () => handleSaveCard(cardIndex) : undefined}
                onUpdate={initialData ? () => handleUpdateCard(cardIndex) : undefined}
                onDelete={initialData ? () => handleDeleteCard(cardIndex) : undefined}
                onChangeField={(field: keyof CreateFlashcardCardForm, value: any) => {
                  setCardForms((prev) => {
                    const updated = [...prev];
                    updated[cardIndex] = { ...updated[cardIndex], [field]: value };
                    return updated;
                  });
                  if (cardErrors[cardIndex]?.[field]) {
                    setCardErrors((prev) => ({
                      ...prev,
                      [cardIndex]: { ...prev[cardIndex], [field]: undefined },
                    }));
                  }
                }}
                onBlurField={(field: keyof CreateFlashcardCardForm, value: any) => validateCardField(cardIndex, field, value)}
                onTagInputChange={(val) => setCardTagInputs((prev) => ({ ...prev, [cardIndex]: val }))}
                onAddTag={() => handleAddCardTag(cardIndex)}
                onRemoveTag={(tag) => handleRemoveCardTag(cardIndex, tag)}
              />
            );
          })}

          {cardTotalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                showControls
                total={cardTotalPages}
                page={cardPage}
                onChange={setCardPage}
                color="primary"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button color="danger" variant="light" onPress={() => router.back()} isDisabled={isSubmitting}>
          {t("flashcard.modal.createDeck.cancel")}
        </Button>
        <Button
          color="primary"
          onPress={handleSubmit}
          isLoading={isSubmitting}
          isDisabled={isSubmitting || !form.deck_name.trim()}
          className="px-8"
        >
          {initialData ? t("common.ok", "Cập nhật") : t("flashcard.modal.createDeck.create")}
        </Button>
      </div>
    </div>
  );
}

