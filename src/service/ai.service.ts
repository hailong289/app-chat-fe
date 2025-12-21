import apiService from "./api.service";

export interface SearchResult {
  text: string;
  contextId: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface SuggestRepliesResponse {
  suggestions: string[];
  emojis: string[];
  gif_keywords: string[];
}

export const aiService = {
  search: async (
    query: string,
    roomId?: string,
    limit = 5
  ): Promise<SearchResponse> => {
    const response = await apiService.post<SearchResponse>("/ai/search", {
      query,
      limit,
      roomId,
    });
    return response.data;
  },

  suggestReplies: async (
    contextMessages: string[]
  ): Promise<SuggestRepliesResponse> => {
    const response = await apiService.post<SuggestRepliesResponse>(
      "/ai/suggest-replies",
      {
        contextMessages,
      }
    );
    return response.data;
  },
};
