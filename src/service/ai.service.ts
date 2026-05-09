import apiService from "./api.service";
import { consumeAiSse } from "./ai-stream.service";

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
    const { metadata } = await consumeAiSse("/ai/stream/search", {
      method: "POST",
      body: JSON.stringify({ query, limit, roomId }),
    });
    return (metadata as SearchResponse) || { results: [] };
  },

  suggestReplies: async (
    contextMessages: string[]
  ): Promise<SuggestRepliesResponse> => {
    const { metadata } = await consumeAiSse("/ai/stream/suggest-replies", {
      method: "POST",
      body: JSON.stringify({ contextMessages }),
    });
    return (
      (metadata as SuggestRepliesResponse) || {
        suggestions: [],
        emojis: [],
        gif_keywords: [],
      }
    );
  },

  summaryDocument: async (file: File): Promise<SummaryDocumentResponse> => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", "document");
    const { metadata, chunks } = await consumeAiSse("/ai/stream/summary-document", {
      method: "POST",
      body: form,
    });
    const data = metadata as SummaryDocumentResponse | undefined;
    const streamedText = chunks.join("").trim();
    return {
      summary: data?.summary || streamedText || "",
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
    const { metadata } = await consumeAiSse("/ai/stream/translation", {
      method: "POST",
      body: JSON.stringify({ text, from, to }),
    });

    return {
      translated: (metadata as string) ?? "",
      from,
      to,
    };
  },
};
