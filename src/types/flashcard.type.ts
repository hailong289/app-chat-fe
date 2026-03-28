export interface Flashcard {
  _id?: string;
  id?: string;
  card_userId: string;
  card_deckId?: string; // Tùy chọn nếu thẻ chưa được gán vào bộ nào
  card_front: string;
  card_back: string;
  card_hint?: string;
  card_tags?: string[];
  card_image?: string;
  card_audio?: string;
  card_difficulty?: number; // 1-5
  card_isPublic?: boolean;

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFlashcardPayload {
  card_id?: string;
  card_deckId?: string;
  card_front: string;
  card_back: string;
  card_hint?: string;
  card_tags?: string[];
  card_image?: string;
  card_audio?: string;
  card_difficulty?: number;
  card_isPublic?: boolean;
}

export interface UpdateFlashcardPayload {
  card_deckId?: string;
  card_front?: string;
  card_back?: string;
  card_hint?: string;
  card_tags?: string[];
  card_image?: string;
  card_audio?: string;
  card_difficulty?: number;
  card_isPublic?: boolean;
}

export type DeckLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Cấu trúc cho Bộ thẻ (Deck)
export interface FlashcardDeck {
  _id?: string;
  id?: string;
  deck_id: string;
  deck_userId: string;
  deck_name: string;
  deck_description?: string;
  deck_image?: string;
  deck_tags?: string[];
  deck_isPublic?: boolean;
  deck_level?: DeckLevel;
  deck_language?: string;
  total_cards?: number;
  process?: {
    new_cards: number,
    learning_cards: number,
    review_cards: number,
    mastered_cards: number,
    total_cards: number
  }
  // Khi populate từ backend trả về danh sách thẻ
  flashcards?: Flashcard[];

  createdAt?: string;
  updatedAt?: string;
}

// Payload khi tạo bộ thẻ mới
export interface CreateFlashcardDeckPayload {
  deck_userId?: string;
  deck_name: string;
  deck_description?: string;
  deck_image?: string;
  deck_tags?: string[];
  deck_isPublic?: boolean;
  deck_level?: DeckLevel;
  deck_language?: string;

  // Tùy chọn: Có thể tạo bộ thẻ kèm theo danh sách các thẻ bên trong luôn
  flashcards?: CreateFlashcardPayload[];
}

export interface UpdateFlashcardDeckPayload {
  deck_name?: string;
  deck_description?: string;
  deck_image?: string;
  deck_tags?: string[];
  deck_isPublic?: boolean;
  deck_level?: DeckLevel;
  deck_language?: string;
}
