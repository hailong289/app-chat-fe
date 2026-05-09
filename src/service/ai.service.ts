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

export interface TranscribeAttachmentResponse {
  transcript: string;
  detectedLanguage?: string;
  attachmentId: string;
  messageId: string;
  /** True when BE returned a previously-saved transcript without re-running AI. */
  cached?: boolean;
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

  /**
   * Speech-to-Text on an existing voice-message audio attachment.
   *
   * The audio is already on S3 (uploaded as part of the voice message),
   * so we only send the IDs — BE fetches the file server-side and persists
   * the transcript onto the Attachment record. Subsequent calls for the
   * same attachment return the cached transcript without re-running AI
   * (`response.cached === true`).
   */
  transcribeAttachment: async (
    attachmentId: string,
    messageId: string,
    language: "vi" | "en" = "vi"
  ): Promise<TranscribeAttachmentResponse> => {
    const response = await apiService.post<{
      metadata: TranscribeAttachmentResponse;
    }>("/ai/transcribe-attachment", {
      attachmentId,
      messageId,
      language,
    });
    const m = response.data?.metadata;
    return {
      transcript: m?.transcript ?? "",
      detectedLanguage: m?.detectedLanguage,
      attachmentId: m?.attachmentId ?? attachmentId,
      messageId: m?.messageId ?? messageId,
      cached: m?.cached ?? false,
    };
  },
};
