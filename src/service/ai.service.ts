import apiService from "./api.service";
import { consumeAiSse } from "./ai-stream.service";

export interface SearchResult {
  text: string;
  contextId: string;
  contextType?: string;
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

export interface UsageReportItem {
  group: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  totalTokenInput: number;
  totalTokenOutput: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  uniqueUserCount: number;
}

export interface UsageReportResponse {
  groupBy: string;
  total: number;
  items: UsageReportItem[];
}

type SummaryDocumentRequest =
  | { type: "document"; file: File }
  | { type: "file_url"; file_url: string };

type ApiEnvelope<T> = {
  metadata?: T;
};

const normalizeTextWhitespace = (text: string): string =>
  text
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

function extractFromBrokenSummaryJson(raw: string): SummaryDocumentResponse | undefined {
  const source = raw.replace(/\r/g, "");

  const readStringField = (field: string): string | undefined => {
    const pattern = new RegExp(
      `["']?\\s*${field}\\s*["']?\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|\\n|\\})`,
      "i",
    );
    const match = source.match(pattern);
    if (!match?.[1]) return undefined;
    return normalizeTextWhitespace(match[1]);
  };

  const title = readStringField("title");
  const summary = readStringField("summary");
  const language = readStringField("language");

  const keyPointsMatch = source.match(
    /["']?\s*key_points\s*["']?\s*:\s*\[([\s\S]*?)\]\s*(?:,|\})?/i,
  );
  let keyPoints: string[] | undefined;
  if (keyPointsMatch?.[1]) {
    const items = [...keyPointsMatch[1].matchAll(/"([\s\S]*?)"/g)]
      .map((m) => normalizeTextWhitespace(m[1] || ""))
      .filter(Boolean);
    if (items.length > 0) keyPoints = items;
  }

  if (!title && !summary && !language && !keyPoints?.length) return undefined;
  return {
    summary: summary || "",
    title,
    keyPoints,
    language,
  };
}

function normalizeSummaryPayload(value: unknown): SummaryDocumentResponse | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return normalizeSummaryPayload(parsed);
    } catch {
      const extracted = extractFromBrokenSummaryJson(trimmed);
      if (extracted) return extracted;
      return { summary: trimmed };
    }
  }

  if (typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;

  if (obj.metadata !== undefined) {
    return normalizeSummaryPayload(obj.metadata);
  }

  const summary =
    typeof obj.summary === "string"
      ? obj.summary
      : typeof obj.translated === "string"
        ? obj.translated
        : "";

  const title = typeof obj.title === "string" ? obj.title : undefined;
  const rawKeyPoints = Array.isArray(obj.keyPoints)
    ? obj.keyPoints
    : Array.isArray(obj.key_points)
      ? obj.key_points
      : undefined;
  const keyPoints = rawKeyPoints
    ? rawKeyPoints
      .filter((x): x is string => typeof x === "string")
      .map((x) => normalizeTextWhitespace(x))
    : undefined;
  const language = typeof obj.language === "string" ? obj.language : undefined;

  if (!summary && !title && !keyPoints?.length && !language) return undefined;

  return { summary, title, keyPoints, language };
}

function cleanupStreamedSummaryText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Try extracting JSON object first, in case chunks form a full JSON payload.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    const fromJson = normalizeSummaryPayload(jsonCandidate)?.summary;
    if (fromJson?.trim()) return fromJson.trim();
  }

  // Fallback: backend streams string fragments line-by-line (often wrapped as `"text",`).
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^"([\s\S]*)"[,]?$/, "$1"))
    .map((line) => line.replace(/^['"]|['"]$/g, ""))
    .map((line) => line.replace(/\\"/g, '"'))
    .map((line) => line.replace(/\\n/g, "\n"))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Join lines while preserving likely missing boundary spaces.
  const merged = lines.join(" ");
  return merged
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const aiService = {
  search: async (
    query: string,
    roomId?: string,
    limit = 5
  ): Promise<SearchResponse> => {
    const response = await apiService.post<
      ApiEnvelope<SearchResponse> & Partial<SearchResponse>
    >("/ai/search", {
      query,
      limit,
      roomId,
    });
    // The /ai/search gateway endpoint returns the raw gRPC result `{ results }`
    // (no `metadata` envelope, unlike Response.success endpoints — same as
    // /ai/usage/report). Accept both shapes so we render results whether or not
    // the backend later wraps the payload.
    const data = response.data;
    if (data?.metadata) return data.metadata;
    if (Array.isArray(data?.results)) return { results: data.results };
    return { results: [] };
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

  summaryDocument: async (
    payload: SummaryDocumentRequest,
  ): Promise<SummaryDocumentResponse> => {
    const body =
      payload.type === "document"
        ? (() => {
          const form = new FormData();
          form.append("file", payload.file);
          form.append("type", "document");
          return form;
        })()
        : JSON.stringify({
          type: "file_url",
          file_url: payload.file_url,
        });

    const { metadata, chunks } = await consumeAiSse("/ai/stream/summary-document", {
      method: "POST",
      body,
    });
    const metadataData = normalizeSummaryPayload(metadata);
    const streamedText = chunks.join("\n").trim();
    const chunkData = normalizeSummaryPayload(streamedText);
    const data = metadataData || chunkData;
    const cleanedStreamedSummary = cleanupStreamedSummaryText(streamedText);
    return {
      summary: data?.summary || cleanedStreamedSummary || streamedText || "",
      title: data?.title,
      keyPoints: data?.keyPoints,
      language: data?.language,
    };
  },

  /**
   * Translate text using AI.
   * @param model Pass `null` to use the cheapest/free model (model 0). Omit to use default.
   */
  translate: async (
    text: string,
    from: string,
    to: string,
    model?: string | null,
  ): Promise<TranslationResponse> => {
    const { metadata } = await consumeAiSse("/ai/stream/translation", {
      method: "POST",
      body: JSON.stringify({ text, from, to, model: model ?? null }),
    });

    const result = metadata as { translated?: string; metadata?: { translated?: string } } | string | null;
    let translated = "";
    if (typeof result === "string") translated = result;
    else if (result && typeof result === "object") {
      translated = (result as any).translated ?? (result as any).metadata?.translated ?? "";
    }

    return { translated, from, to };
  },

  /**
   * Lấy báo cáo thống kê sử dụng AI.
   * Query params:
   *   - service : lọc theo service (moderation, translation, suggest-replies, ...)
   *   - userId  : lọc theo user
   *   - from    : ngày bắt đầu (ISO string)
   *   - to      : ngày kết thúc (ISO string)
   *   - groupBy : 'service' | 'userId' | 'day' (mặc định: 'service')
   */
  getUsageReport: async (params?: {
    service?: string;
    userId?: string;
    from?: string;
    to?: string;
    groupBy?: 'service' | 'userId' | 'day';
  }): Promise<UsageReportResponse> => {
    const response = await apiService.get("/ai/usage/report", params);
    const fallback: UsageReportResponse = {
      groupBy: params?.groupBy || 'service',
      total: 0,
      items: [],
    };
    const data = response.data;
    // response.data is the raw gRPC response (no metadata wrapper)
    if (!data || typeof data !== "object" || !("groupBy" in data)) {
      return fallback;
    }
    return data as UsageReportResponse;
  },
};
