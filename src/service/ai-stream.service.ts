import { getCookie } from "cookies-next";

type StreamEnvelope = {
  event?: "start" | "chunk" | "progress" | "done" | "error";
  requestId?: string;
  route?: string;
  chunk?: string;
  metadata?: unknown;
  error?: string;
};

function isEnvelope(payload: unknown): payload is StreamEnvelope {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    "event" in p ||
    "chunk" in p ||
    "metadata" in p ||
    "error" in p ||
    "requestId" in p ||
    "route" in p
  );
}

type ConsumeOptions = {
  method?: "GET" | "POST";
  body?: BodyInit;
  onChunk?: (chunk: string) => void;
};

function buildUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  return `${base}${path}`;
}

function buildHeaders(body?: BodyInit): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  };

  if (!(body instanceof FormData) && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const tokens = getCookie("tokens")?.toString();
  if (tokens) {
    try {
      const { accessToken } = JSON.parse(tokens);
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    } catch {
      // Ignore malformed cookies; backend will return auth error.
    }
  }
  return headers;
}

function readEventChunk(rawEvent: string): { event?: string; data?: string } {
  const lines = rawEvent.split("\n");
  let eventName: string | undefined;
  const dataLines: string[] = [];
  let seenData = false;

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      const rawData = line.slice(5);
      // SSE spec allows one optional leading space after `data:`.
      // Remove only that single separator, keep remaining spaces intact.
      dataLines.push(rawData.startsWith(" ") ? rawData.slice(1) : rawData);
      seenData = true;
      continue;
    }
    // Be tolerant with non-standard SSE producers that send multiline payload
    // without repeating `data:` on each line.
    if (seenData) dataLines.push(line);
  }

  return { event: eventName, data: dataLines.join("\n") };
}

export async function consumeAiSse(
  path: string,
  options?: ConsumeOptions,
): Promise<{ metadata?: unknown; chunks: string[] }> {
  const method = options?.method ?? "POST";
  const response = await fetch(buildUrl(path), {
    method,
    headers: buildHeaders(options?.body),
    credentials: "include",
    body: options?.body,
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let metadata: unknown;
  const chunks: string[] = [];
  const processBufferedEvents = (flushAll = false) => {
    const events = buffer.split("\n\n");
    buffer = flushAll ? "" : events.pop() ?? "";
    const toProcess = flushAll ? events.filter(Boolean) : events;

    for (const rawEvent of toProcess) {
      const { event, data } = readEventChunk(rawEvent);
      if (!data) continue;

      let parsed: StreamEnvelope | null = null;
      let parsedAny: unknown;
      try {
        parsedAny = JSON.parse(data);
        if (isEnvelope(parsedAny)) {
          parsed = parsedAny;
        } else {
          // Some endpoints stream plain JSON payload (not wrapped in envelope).
          metadata = parsedAny;
          chunks.push(typeof parsedAny === "string" ? parsedAny : JSON.stringify(parsedAny));
          continue;
        }
      } catch {
        // Legacy SSE format from backend: plain text chunk in `data: ...`
        if (event === "error") {
          throw new Error(data || "SSE stream returned error");
        }
        chunks.push(data);
        options?.onChunk?.(data);
        continue;
      }

      if (!parsed) continue;

      if (parsed.event === "error" || event === "error") {
        throw new Error(parsed.error || "SSE stream returned error");
      }

      if (parsed.metadata !== undefined) {
        metadata = parsed.metadata;
      }

      if (parsed.chunk) {
        chunks.push(parsed.chunk);
        options?.onChunk?.(parsed.chunk);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      // Flush decoder and process the tail in case stream ends without `\n\n`.
      buffer += decoder.decode();
      processBufferedEvents(true);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    processBufferedEvents(false);
  }

  return { metadata, chunks };
}

