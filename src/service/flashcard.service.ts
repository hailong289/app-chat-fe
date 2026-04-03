import { CreateFlashcardDeckPayload, CreateFlashcardPayload, UpdateFlashcardPayload, FlashcardDeck, Flashcard } from "@/types/flashcard.type";
import apiService from "./api.service";

export interface APIDeckResponse {
  message?: string;
  statusCode?: number;
  metadata: FlashcardDeck;
}

export interface APIListDeckResponse {
  message?: string;
  statusCode?: number;
  metadata: FlashcardDeck[];
}

export interface APIListFlashcardResponse {
  message?: string;
  statusCode?: number;
  metadata: any; // could be array or paginated object
}

export interface APIFlashcardResponse {
  message?: string;
  statusCode?: number;
  metadata: Flashcard;
}

export interface GenerateFlashcardResponse {
  deck_name: string;
  deck_description: string;
  deck_level: string;
  deck_language: string;
  deck_tags: string[];
  flashcards: Array<{
    card_front: string;
    card_back: string;
    card_hint: string;
    card_tags: string[];
    card_difficulty: number;
  }>;
}

export interface FlashcardProgressPayload {
  mastery_level?: number;
  review_count?: number;
  correct_count?: number;
  incorrect_count?: number;
  is_mastered?: boolean;
  is_favorite?: boolean;
  status?: 'new' | 'learning' | 'review' | 'mastered';
  next_review?: string;
}

export const flashcardService = {
  /**
   * Tạo một Bộ thẻ mới (kèm theo danh sách thẻ nếu có)
   * @param payload Dữ liệu tạo Bộ thẻ
   * @returns FlashcardDeck (Bộ thẻ vừa được tạo)
   */
  createDeck: async (payload: CreateFlashcardDeckPayload): Promise<FlashcardDeck> => {
    const response = await apiService.post<APIDeckResponse>("/ai/flashcard/deck/create", payload);
    return response.data?.metadata;
  },

  getListDeck: async (): Promise<FlashcardDeck[]> => {
    const response = await apiService.get<APIListDeckResponse>("/ai/flashcard/deck/list");
    return response.data?.metadata || [];
  },

  getListFlashcard: async (params: { page?: number; limit?: number; userId?: string; deckId?: string }): Promise<any> => {
    const response = await apiService.get<APIListFlashcardResponse>("/ai/flashcard/list", params);
    return response.data?.metadata;
  },

  deleteDeck: async (id: string): Promise<any> => {
    const response = await apiService.delete(`/ai/flashcard/deck/delete/${id}`);
    return response.data;
  },

  updateDeck: async (id: string, payload: Partial<CreateFlashcardDeckPayload>): Promise<FlashcardDeck> => {
    const response = await apiService.patch<APIDeckResponse>(`/ai/flashcard/deck/update/${id}`, payload);
    return response.data?.metadata;
  },

  createCard: async (payload: CreateFlashcardPayload): Promise<Flashcard> => {
    const response = await apiService.post<APIFlashcardResponse>("/ai/flashcard/create", payload);
    return response.data?.metadata;
  },

  updateCard: async (cardId: string, payload: UpdateFlashcardPayload): Promise<Flashcard> => {
    const response = await apiService.patch<APIFlashcardResponse>(`/ai/flashcard/update/${cardId}`, payload);
    return response.data?.metadata;
  },

  deleteCard: async (cardId: string): Promise<any> => {
    const response = await apiService.delete(`/ai/flashcard/delete/${cardId}`);
    return response.data;
  },

  generateFlashcard: async (payload: FormData | Record<string, unknown>): Promise<GenerateFlashcardResponse> => {
    const response = await apiService.post<{ metadata: GenerateFlashcardResponse }>(
      "/ai/generate-flashcard",
      payload
    );
    return response.data?.metadata;
  },

  updateProgress: async (cardId: string, payload: FlashcardProgressPayload): Promise<any> => {
    const response = await apiService.patch(`/ai/flashcard/progress/${cardId}`, payload);
    return response.data;
  },
};
