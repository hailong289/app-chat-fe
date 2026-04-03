import Joi from 'joi';

// Helper Regex pattern
const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

/**
 * Các schema có nhận hàm t() (từ useTranslation) để hỗ trợ đa ngôn ngữ
 */

export const getFlashcardDeckSchema = (t: any) =>
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
  });

export const getFlashcardCardSchema = (t: any) =>
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
  });
