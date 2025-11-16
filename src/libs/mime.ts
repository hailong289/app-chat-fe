// mime.ts
export function pickAudioMime() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return { mimeType: "audio/mp4", ext: "m4a" }; // Safari
  }
  return { mimeType: "", ext: "webm" };
}
