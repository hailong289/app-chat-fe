import apiService from "./api.service";

export interface SearchResult {
  text: string;
  contextId: string;
  score: number;
  messageId: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface SuggestRepliesResponse {
  suggestions: string[];
  emojis: string[];
  gif_keywords: string[];
}

export interface SummaryDocumentResponse {
  summary: string;
  title?: string;
  keyPoints?: string[];
  language?: string;
}

export interface TranslationResponse {
  translated: string;
  from: string;
  to: string;
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

  summaryDocument: async (file: File): Promise<SummaryDocumentResponse> => {
    const form = new FormData();
    form.append("file", file);

    const response = await apiService.post<{ metadata: SummaryDocumentResponse }>(
      "/ai/summary-document",
      form
    );

    const data = response.data?.metadata;
    return {
      summary: data?.summary || "",
      title: data?.title,
      keyPoints: data?.keyPoints,
      language: data?.language,
    };
  },

  translate: async (
    text: string,
    from: string,
    to: string
  ): Promise<TranslationResponse> => {
    const response = await apiService.post<{ metadata: string }>(
      "/ai/translation",
      {
        text,
        from,
        to,
      }
    );

    return {
      translated: response.data?.metadata ?? "",
      from,
      to,
    };
  },
};
