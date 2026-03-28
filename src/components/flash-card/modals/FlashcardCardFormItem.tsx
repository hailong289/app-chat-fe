import React from "react";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import { TrashIcon, CheckIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { CreateFlashcardCardForm } from "../forms/FlashcardDeckForm";

interface Props {
  cardIndex: number;
  cardForm: CreateFlashcardCardForm;
  error?: Partial<Record<keyof CreateFlashcardCardForm, string>>;
  tagInput: string;
  totalCards: number;
  isExisting?: boolean;
  isSaving?: boolean;
  isUpdating?: boolean;
  isDeleting?: boolean;
  onRemove: () => void;
  onSave?: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
  onChangeField: (field: keyof CreateFlashcardCardForm, value: any) => void;
  onBlurField: (field: keyof CreateFlashcardCardForm, value: any) => void;
  onTagInputChange: (val: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
}

export const FlashcardCardFormItem = ({
  cardIndex,
  cardForm,
  error,
  tagInput,
  totalCards,
  isExisting,
  isSaving,
  isUpdating,
  isDeleting,
  onRemove,
  onSave,
  onUpdate,
  onDelete,
  onChangeField,
  onBlurField,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}: Props) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-medium text-sm text-gray-600 dark:text-gray-400">
          {t("flashcard.modal.createDeck.cardNumber", { number: cardIndex + 1 })}
        </h5>

        <div className="flex items-center gap-2">
          {isExisting ? (
            <>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                isLoading={isUpdating}
                isDisabled={isUpdating || isDeleting}
                startContent={!isUpdating && <PencilSquareIcon className="w-4 h-4" />}
                onPress={onUpdate}
              >
                Cập nhật
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                isLoading={isDeleting}
                isDisabled={isUpdating || isDeleting}
                startContent={!isDeleting && <TrashIcon className="w-4 h-4" />}
                onPress={onDelete}
              >
                Xóa
              </Button>
            </>
          ) : (
            <>
              {onSave && (
                <Button
                  size="sm"
                  color="success"
                  variant="flat"
                  isLoading={isSaving}
                  isDisabled={isSaving}
                  startContent={!isSaving && <CheckIcon className="w-4 h-4" />}
                  onPress={onSave}
                >
                  Lưu
                </Button>
              )}
              {totalCards > 1 && (
                <Button
                  size="sm"
                  color="danger"
                  variant="light"
                  isIconOnly
                  isDisabled={isSaving}
                  onPress={onRemove}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Front & Back */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          label={t("flashcard.modal.createDeck.cardFrontLabel")}
          placeholder={t("flashcard.modal.createDeck.cardFrontPlaceholder")}
          value={cardForm.card_front}
          isRequired
          isInvalid={!!error?.card_front}
          errorMessage={error?.card_front}
          maxLength={1000}
          minRows={3}
          onChange={(e) => onChangeField("card_front", e.target.value)}
          onBlur={() => onBlurField("card_front", cardForm.card_front.trim())}
        />

        <Textarea
          label={t("flashcard.modal.createDeck.cardBackLabel")}
          placeholder={t("flashcard.modal.createDeck.cardBackPlaceholder")}
          value={cardForm.card_back}
          isRequired
          isInvalid={!!error?.card_back}
          errorMessage={error?.card_back}
          maxLength={2000}
          minRows={3}
          onChange={(e) => onChangeField("card_back", e.target.value)}
          onBlur={() => onBlurField("card_back", cardForm.card_back.trim())}
        />
      </div>

      {/* Hint & Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t("flashcard.modal.createDeck.cardHintLabel")}
          placeholder={t("flashcard.modal.createDeck.cardHintPlaceholder")}
          value={cardForm.card_hint || ""}
          isInvalid={!!error?.card_hint}
          errorMessage={error?.card_hint}
          maxLength={500}
          onChange={(e) => onChangeField("card_hint", e.target.value)}
          onBlur={() => onBlurField("card_hint", cardForm.card_hint?.trim() || "")}
        />

        <div className="space-y-2">
          <Input
            label={t("flashcard.modal.createDeck.cardTagsLabel")}
            placeholder={t("flashcard.modal.createDeck.cardTagsPlaceholder")}
            value={tagInput || ""}
            onChange={(e) => onTagInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddTag();
              }
            }}
            endContent={
              (tagInput || "").trim() && (
                <Button
                  size="sm"
                  variant="light"
                  onPress={onAddTag}
                  className="min-w-0 px-2"
                >
                  {t("flashcard.modal.createDeck.addTag")}
                </Button>
              )
            }
          />
          {cardForm.card_tags && cardForm.card_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {cardForm.card_tags.map((tag: string) => (
                <Chip
                  key={tag}
                  onClose={() => onRemoveTag(tag)}
                  variant="flat"
                  color="primary"
                >
                  {tag}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings: Difficulty */}
      <div className="grid grid-cols-1 gap-4 items-center">
        <Select
          label={t("flashcard.modal.createDeck.cardDifficultyLabel")}
          placeholder={t("flashcard.modal.createDeck.cardDifficultyPlaceholder")}
          selectedKeys={
            cardForm.card_difficulty ? new Set([cardForm.card_difficulty.toString()]) : new Set()
          }
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            onChangeField("card_difficulty", selected ? parseInt(selected) : undefined);
          }}
        >
          {["1", "2", "3", "4", "5"].map((level) => (
            <SelectItem key={level} textValue={level}>
              {level}
            </SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
};
