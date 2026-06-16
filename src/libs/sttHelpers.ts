/** Gemini inlineData expects base mime without codec params */
export function normalizeAudioMimeType(mimeType: string): string {
  const base = (mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
  return base.startsWith("audio/") ? base : "audio/webm";
}

export function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.readAsDataURL(blob);
  });
}

export function sttNowTimestamp() {
  return new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function parseRemoteStreamUserId(
  streamKey: string,
  roomId: string | null,
): string {
  if (roomId && streamKey.startsWith(`${roomId}-`)) {
    return streamKey.slice(roomId.length + 1);
  }
  return streamKey;
}
