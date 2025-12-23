export type NormalizedError = {
  message: string;
  name?: string;
  stack?: string;
  statusCode?: number;
  raw?: unknown;
};

const safeStringify = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

const getProp = <T extends string | number | symbol, V>(
  source: Record<T, V> | undefined,
  key: T
): V | undefined => {
  if (!source) return undefined;
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }
  return undefined;
};

export const normalizeError = (error: unknown): NormalizedError => {
  if (error instanceof Error) {
    const statusCode =
      getProp(error as Record<string, unknown>, "statusCode") ??
      getProp(error as Record<string, unknown>, "status") ??
      getProp(getProp(error as Record<string, unknown>, "response"), "status");

    return {
      message: error.message || "Unknown error",
      name: error.name,
      stack: error.stack,
      statusCode: typeof statusCode === "number" ? statusCode : undefined,
      raw: error,
    };
  }

  if (typeof error === "string") {
    return { message: error, raw: error };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string"
        ? record.message
        : safeStringify(record) || "Unknown error";
    const statusCodeCandidate =
      getProp(record, "statusCode") ??
      getProp(record, "status") ??
      getProp(record, "code");

    return {
      message,
      statusCode:
        typeof statusCodeCandidate === "number"
          ? statusCodeCandidate
          : undefined,
      raw: error,
    };
  }

  return {
    message: String(error),
    raw: error,
  };
};

export const logError = (context: string, error: unknown) => {
  const normalized = normalizeError(error);
  const statusLabel =
    normalized.statusCode !== undefined
      ? ` (status ${normalized.statusCode})`
      : "";

  console.error(
    `${context}${statusLabel}: ${normalized.message}`,
    normalized.raw
  );
};
