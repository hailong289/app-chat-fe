import { CreateFlashcardDeckPayload, FlashcardDeck, Flashcard } from "@/types/flashcard.type";
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
};
