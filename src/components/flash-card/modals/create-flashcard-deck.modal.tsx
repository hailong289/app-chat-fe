"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  Select,
  SelectItem,
  Checkbox,
  Chip,
} from "@heroui/react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import Joi from "joi";
import { useTranslation } from "react-i18next";

interface CreateFlashcardDeckForm {
  deck_name: string;
  deck_description?: string;
  deck_image?: string;
  deck_tags?: string[];
  deck_isPublic?: boolean;
  deck_level?: "beginner" | "intermediate" | "advanced" | "expert";
  deck_language?: string;
}

interface CreateFlashcardCardForm {
  card_front: string;
  card_back: string;
  card_hint?: string;
  card_tags?: string[];
  card_image?: string;
  card_audio?: string;
  card_difficulty?: number;
  card_isPublic?: boolean;
}

interface CreateFlashcardDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSubmit?: (data: CreateFlashcardDeckForm & { deck_userId: string }) => void;
}

export const CreateFlashcardDeckModal = ({
  isOpen,
  onClose,
  userId,
  onSubmit,
}: CreateFlashcardDeckModalProps) => {
  const { t } = useTranslation();

  // Level options với translation
  const levelOptions = useMemo(
    () => [
      { value: "beginner", label: t("flashcard.levels.beginner") },
      { value: "intermediate", label: t("flashcard.levels.intermediate") },
      { value: "advanced", label: t("flashcard.levels.advanced") },
      { value: "expert", label: t("flashcard.levels.expert") },
    ],
    [t]
  );

  // Schema validation cho form flashcard deck với translation
  const flashcardDeckSchema = useMemo(
    () =>
      Joi.object({
        deck_name: Joi.string()
          .required()
          .max(255)
          .messages({
            "string.empty": t("flashcard.validation.nameRequired"),
            "any.required": t("flashcard.validation.nameRequired"),
            "string.max": t("flashcard.validation.nameMaxLength"),
          }),
        deck_description: Joi.string()
          .allow("")
          .optional()
          .max(1000)
          .messages({
            "string.max": t("flashcard.validation.descriptionMaxLength"),
          }),
        deck_image: Joi.string()
          .allow("")
          .optional()
          .custom((value, helpers) => {
            if (!value || value.trim() === "") {
              return value; // Allow empty string
            }
            try {
              new URL(value);
              return value;
            } catch {
              return helpers.error("string.uri");
            }
          })
          .messages({
            "string.uri": t("flashcard.validation.imageInvalid"),
          }),
        deck_tags: Joi.array()
          .items(Joi.string())
          .optional()
          .messages({
            "array.base": t("flashcard.validation.tagsMustBeArray"),
          }),
        deck_isPublic: Joi.boolean().optional().messages({
          "boolean.base": t("flashcard.validation.isPublicMustBeBoolean"),
        }),
        deck_level: Joi.string()
          .valid("beginner", "intermediate", "advanced", "expert")
          .optional()
          .allow(null, "")
          .messages({
            "any.only": t("flashcard.validation.levelInvalid"),
          }),
        deck_language: Joi.string().allow("").optional().messages({
          "string.base": t("flashcard.validation.languageMustBeString"),
        }),
      }),
    [t]
  );

  const [form, setForm] = useState<CreateFlashcardDeckForm>({
    deck_name: "",
    deck_description: "",
    deck_image: "",
    deck_tags: [],
    deck_isPublic: false,
    deck_level: undefined,
    deck_language: "",
  });

  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof CreateFlashcardDeckForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardForms, setCardForms] = useState<CreateFlashcardCardForm[]>([]);
  const [cardTagInputs, setCardTagInputs] = useState<Record<number, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<number, Partial<Record<keyof CreateFlashcardCardForm, string>>>>({});

  // Schema validation cho flashcard card
  const flashcardCardSchema = useMemo(
    () =>
      Joi.object({
        card_front: Joi.string()
          .required()
          .max(1000)
          .messages({
            "string.empty": t("flashcard.validation.cardFrontRequired"),
            "any.required": t("flashcard.validation.cardFrontRequired"),
            "string.max": t("flashcard.validation.cardFrontMaxLength"),
          }),
        card_back: Joi.string()
          .required()
          .max(2000)
          .messages({
            "string.empty": t("flashcard.validation.cardBackRequired"),
            "any.required": t("flashcard.validation.cardBackRequired"),
            "string.max": t("flashcard.validation.cardBackMaxLength"),
          }),
        card_hint: Joi.string()
          .allow("")
          .optional()
          .max(500)
          .messages({
            "string.max": t("flashcard.validation.cardHintMaxLength"),
          }),
        card_tags: Joi.array()
          .items(Joi.string())
          .optional()
          .messages({
            "array.base": t("flashcard.validation.tagsMustBeArray"),
          }),
        card_image: Joi.string()
          .allow("")
          .optional()
          .custom((value, helpers) => {
            if (!value || value.trim() === "") {
              return value;
            }
            try {
              new URL(value);
              return value;
            } catch {
              return helpers.error("string.uri");
            }
          })
          .messages({
            "string.uri": t("flashcard.validation.imageInvalid"),
          }),
        card_audio: Joi.string()
          .allow("")
          .optional()
          .custom((value, helpers) => {
            if (!value || value.trim() === "") {
              return value;
            }
            try {
              new URL(value);
              return value;
            } catch {
              return helpers.error("string.uri");
            }
          })
          .messages({
            "string.uri": t("flashcard.validation.audioInvalid"),
          }),
        card_difficulty: Joi.number()
          .integer()
          .min(1)
          .max(5)
          .optional()
          .allow(null, "")
          .messages({
            "number.base": t("flashcard.validation.difficultyMustBeNumber"),
            "number.min": t("flashcard.validation.difficultyMin"),
            "number.max": t("flashcard.validation.difficultyMax"),
          }),
        card_isPublic: Joi.boolean().optional().messages({
          "boolean.base": t("flashcard.validation.isPublicMustBeBoolean"),
        }),
      }),
    [t]
  );

  // Reset form khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setForm({
        deck_name: "",
        deck_description: "",
        deck_image: "",
        deck_tags: [],
        deck_isPublic: false,
        deck_level: undefined,
        deck_language: "",
      });
      setTagInput("");
      setErrors({});
      setIsSubmitting(false);
      setCardForms([]);
      setCardTagInputs({});
      setCardErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    // Chuẩn bị data để validate (chuyển empty string thành undefined cho optional fields)
    const dataToValidate = {
      deck_name: form.deck_name.trim(),
      deck_description: form.deck_description?.trim() || undefined,
      deck_image: form.deck_image?.trim() || undefined,
      deck_tags: form.deck_tags && form.deck_tags.length > 0 ? form.deck_tags : undefined,
      deck_isPublic: form.deck_isPublic,
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
    setCardForms((prev) => [
      ...prev,
      {
        card_front: "",
        card_back: "",
        card_hint: "",
        card_tags: [],
        card_image: "",
        card_audio: "",
        card_difficulty: undefined,
        card_isPublic: false,
      },
    ]);
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
        card_image: cardForm.card_image?.trim() || undefined,
        card_audio: cardForm.card_audio?.trim() || undefined,
        card_difficulty: cardForm.card_difficulty || undefined,
        card_isPublic: cardForm.card_isPublic,
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (cardForms.length > 0 && !validateCardForms()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        deck_userId: userId,
        deck_name: form.deck_name.trim(),
        ...(form.deck_description?.trim() && {
          deck_description: form.deck_description.trim(),
        }),
        ...(form.deck_image?.trim() && { deck_image: form.deck_image.trim() }),
        ...(form.deck_tags && form.deck_tags.length > 0 && { deck_tags: form.deck_tags }),
        ...(form.deck_isPublic !== undefined && { deck_isPublic: form.deck_isPublic }),
        ...(form.deck_level && { deck_level: form.deck_level }),
        ...(form.deck_language?.trim() && { deck_language: form.deck_language.trim() }),
        // Include cards data if there are any cards
        ...(cardForms.length > 0 && {
          cards: cardForms.map((cardForm) => ({
            card_userId: userId,
            card_front: cardForm.card_front.trim(),
            card_back: cardForm.card_back.trim(),
            ...(cardForm.card_hint?.trim() && { card_hint: cardForm.card_hint.trim() }),
            ...(cardForm.card_tags && cardForm.card_tags.length > 0 && { card_tags: cardForm.card_tags }),
            ...(cardForm.card_image?.trim() && { card_image: cardForm.card_image.trim() }),
            ...(cardForm.card_audio?.trim() && { card_audio: cardForm.card_audio.trim() }),
            ...(cardForm.card_difficulty && { card_difficulty: cardForm.card_difficulty }),
            ...(cardForm.card_isPublic !== undefined && { card_isPublic: cardForm.card_isPublic }),
          })),
        }),
      };

      if (onSubmit) {
        await onSubmit(submitData);
      }
      onClose();
    } catch (error) {
      console.error("Error creating flashcard deck:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="full"
      scrollBehavior="inside"
      classNames={{
        base: "m-0",
        wrapper: "items-center",
        body: "py-6",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-xl font-bold">
                {t("flashcard.modal.createDeck.title")}
              </h3>
            </ModalHeader>

            <ModalBody className="gap-4">
              {/* Tên bộ thẻ - Required */}
              <Input
                label={t("flashcard.modal.createDeck.nameLabel")}
                placeholder={t("flashcard.modal.createDeck.namePlaceholder")}
                value={form.deck_name}
                isRequired
                isInvalid={!!errors.deck_name}
                errorMessage={errors.deck_name}
                maxLength={255}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, deck_name: e.target.value }));
                  // Clear error khi user đang nhập
                  if (errors.deck_name) {
                    setErrors((prev) => ({ ...prev, deck_name: undefined }));
                  }
                }}
                onBlur={() => validateField("deck_name", form.deck_name.trim())}
              />

              {/* Mô tả - Optional */}
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
                  // Clear error khi user đang nhập
                  if (errors.deck_description) {
                    setErrors((prev) => ({ ...prev, deck_description: undefined }));
                  }
                }}
                onBlur={() =>
                  validateField("deck_description", form.deck_description?.trim() || "")
                }
              />

              {/* URL ảnh - Optional */}
              <Input
                label={t("flashcard.modal.createDeck.imageLabel")}
                placeholder={t("flashcard.modal.createDeck.imagePlaceholder")}
                value={form.deck_image || ""}
                isInvalid={!!errors.deck_image}
                errorMessage={errors.deck_image}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, deck_image: e.target.value }));
                  // Clear error khi user đang nhập
                  if (errors.deck_image) {
                    setErrors((prev) => ({ ...prev, deck_image: undefined }));
                  }
                }}
                onBlur={() => validateField("deck_image", form.deck_image?.trim() || "")}
              />

              {/* Tags - Optional */}
              <div className="space-y-2">
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

              {/* Mức độ - Optional */}
              <Select
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

              {/* Ngôn ngữ - Optional */}
              <Input
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

              {/* Công khai - Optional */}
              <Checkbox
                isSelected={form.deck_isPublic}
                onValueChange={(checked) =>
                  setForm((prev) => ({ ...prev, deck_isPublic: checked }))
                }
              >
                {t("flashcard.modal.createDeck.isPublicLabel")}
              </Checkbox>

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

                  {cardForms.map((cardForm, cardIndex) => (
                    <div
                      key={cardIndex}
                      className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-sm text-gray-600 dark:text-gray-400">
                          {t("flashcard.modal.createDeck.cardNumber", { number: cardIndex + 1 })}
                        </h5>
                        {cardForms.length > 1 && (
                          <Button
                            size="sm"
                            color="danger"
                            variant="light"
                            isIconOnly
                            onPress={() => handleRemoveCard(cardIndex)}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {/* Mặt trước - Required */}
                      <Textarea
                        label={t("flashcard.modal.createDeck.cardFrontLabel")}
                        placeholder={t("flashcard.modal.createDeck.cardFrontPlaceholder")}
                        value={cardForm.card_front}
                        isRequired
                        isInvalid={!!cardErrors[cardIndex]?.card_front}
                        errorMessage={cardErrors[cardIndex]?.card_front}
                        maxLength={1000}
                        minRows={3}
                        onChange={(e) => {
                          setCardForms((prev) => {
                            const updated = [...prev];
                            updated[cardIndex] = { ...updated[cardIndex], card_front: e.target.value };
                            return updated;
                          });
                          if (cardErrors[cardIndex]?.card_front) {
                            setCardErrors((prev) => ({
                              ...prev,
                              [cardIndex]: { ...prev[cardIndex], card_front: undefined },
                            }));
                          }
                        }}
                        onBlur={() =>
                          validateCardField(cardIndex, "card_front", cardForm.card_front.trim())
                        }
                      />

                      {/* Mặt sau - Required */}
                      <Textarea
                        label={t("flashcard.modal.createDeck.cardBackLabel")}
                        placeholder={t("flashcard.modal.createDeck.cardBackPlaceholder")}
                        value={cardForm.card_back}
                        isRequired
                        isInvalid={!!cardErrors[cardIndex]?.card_back}
                        errorMessage={cardErrors[cardIndex]?.card_back}
                        maxLength={2000}
                        minRows={3}
                        onChange={(e) => {
                          setCardForms((prev) => {
                            const updated = [...prev];
                            updated[cardIndex] = { ...updated[cardIndex], card_back: e.target.value };
                            return updated;
                          });
                          if (cardErrors[cardIndex]?.card_back) {
                            setCardErrors((prev) => ({
                              ...prev,
                              [cardIndex]: { ...prev[cardIndex], card_back: undefined },
                            }));
                          }
                        }}
                        onBlur={() =>
                          validateCardField(cardIndex, "card_back", cardForm.card_back.trim())
                        }
                      />

                      {/* Gợi ý - Optional */}
                      <Input
                        label={t("flashcard.modal.createDeck.cardHintLabel")}
                        placeholder={t("flashcard.modal.createDeck.cardHintPlaceholder")}
                        value={cardForm.card_hint || ""}
                        isInvalid={!!cardErrors[cardIndex]?.card_hint}
                        errorMessage={cardErrors[cardIndex]?.card_hint}
                        maxLength={500}
                        onChange={(e) => {
                          setCardForms((prev) => {
                            const updated = [...prev];
                            updated[cardIndex] = { ...updated[cardIndex], card_hint: e.target.value };
                            return updated;
                          });
                          if (cardErrors[cardIndex]?.card_hint) {
                            setCardErrors((prev) => ({
                              ...prev,
                              [cardIndex]: { ...prev[cardIndex], card_hint: undefined },
                            }));
                          }
                        }}
                        onBlur={() =>
                          validateCardField(
                            cardIndex,
                            "card_hint",
                            cardForm.card_hint?.trim() || ""
                          )
                        }
                      />

                      {/* Tags - Optional */}
                      <div className="space-y-2">
                        <Input
                          label={t("flashcard.modal.createDeck.cardTagsLabel")}
                          placeholder={t("flashcard.modal.createDeck.cardTagsPlaceholder")}
                          value={cardTagInputs[cardIndex] || ""}
                          onChange={(e) =>
                            setCardTagInputs((prev) => ({ ...prev, [cardIndex]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCardTag(cardIndex);
                            }
                          }}
                          endContent={
                            (cardTagInputs[cardIndex] || "").trim() && (
                              <Button
                                size="sm"
                                variant="light"
                                onPress={() => handleAddCardTag(cardIndex)}
                                className="min-w-0 px-2"
                              >
                                {t("flashcard.modal.createDeck.addTag")}
                              </Button>
                            )
                          }
                        />
                        {cardForm.card_tags && cardForm.card_tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {cardForm.card_tags.map((tag) => (
                              <Chip
                                key={tag}
                                onClose={() => handleRemoveCardTag(cardIndex, tag)}
                                variant="flat"
                                color="primary"
                              >
                                {tag}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* URL ảnh - Optional */}
                      <Input
                        label={t("flashcard.modal.createDeck.cardImageLabel")}
                        placeholder={t("flashcard.modal.createDeck.cardImagePlaceholder")}
                        value={cardForm.card_image || ""}
                        isInvalid={!!cardErrors[cardIndex]?.card_image}
                        errorMessage={cardErrors[cardIndex]?.card_image}
                        onChange={(e) => {
                          setCardForms((prev) => {
                            const updated = [...prev];
                            updated[cardIndex] = { ...updated[cardIndex], card_image: e.target.value };
                            return updated;
                          });
                          if (cardErrors[cardIndex]?.card_image) {
                            setCardErrors((prev) => ({
                              ...prev,
                              [cardIndex]: { ...prev[cardIndex], card_image: undefined },
                            }));
                          }
                        }}
                        onBlur={() =>
                          validateCardField(
                            cardIndex,
                            "card_image",
                            cardForm.card_image?.trim() || ""
                          )
                        }
                      />

                      {/* URL âm thanh - Optional */}
                      <Input
                        label={t("flashcard.modal.createDeck.cardAudioLabel")}
                        placeholder={t("flashcard.modal.createDeck.cardAudioPlaceholder")}
                        value={cardForm.card_audio || ""}
                        isInvalid={!!cardErrors[cardIndex]?.card_audio}
                        errorMessage={cardErrors[cardIndex]?.card_audio}
                        onChange={(e) => {
                          setCardForms((prev) => {
                            const updated = [...prev];
                            updated[cardIndex] = { ...updated[cardIndex], card_audio: e.target.value };
                            return updated;
                          });
                          if (cardErrors[cardIndex]?.card_audio) {
                            setCardErrors((prev) => ({
                              ...prev,
                              [cardIndex]: { ...prev[cardIndex], card_audio: undefined },
                            }));
                          }
                        }}
                        onBlur={() =>
                          validateCardField(
                            cardIndex,
                            "card_audio",
                            cardForm.card_audio?.trim() || ""
                          )
                        }
                      />

                      {/* Độ khó - Optional */}
                      <Select
                        label={t("flashcard.modal.createDeck.cardDifficultyLabel")}
                        placeholder={t("flashcard.modal.createDeck.cardDifficultyPlaceholder")}
                        selectedKeys={
                          cardForm.card_difficulty ? [cardForm.card_difficulty.toString()] : []
                        }
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as string;
                          setCardForms((prev) => {
                            const updated = [...prev];
                            updated[cardIndex] = {
                              ...updated[cardIndex],
                              card_difficulty: selected ? parseInt(selected) : undefined,
                            };
                            return updated;
                          });
                        }}
                      >
                        {[1, 2, 3, 4, 5].map((level) => (
                          <SelectItem key={level.toString()}>{level}</SelectItem>
                        ))}
                      </Select>

                      {/* Công khai thẻ - Optional */}
                      <Checkbox
                        isSelected={cardForm.card_isPublic}
                        onValueChange={(checked) => {
                          setCardForms((prev) => {
                            const updated = [...prev];
                            updated[cardIndex] = { ...updated[cardIndex], card_isPublic: checked };
                            return updated;
                          });
                        }}
                      >
                        {t("flashcard.modal.createDeck.cardIsPublicLabel")}
                      </Checkbox>
                    </div>
                  ))}
                </div>
            </ModalBody>

            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose} isDisabled={isSubmitting}>
                {t("flashcard.modal.createDeck.cancel")}
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isLoading={isSubmitting}
                isDisabled={isSubmitting || !form.deck_name.trim()}
              >
                {t("flashcard.modal.createDeck.create")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

