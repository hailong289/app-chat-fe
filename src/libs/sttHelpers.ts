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

// Gemini chỉ nhận audio: wav/mp3/aiff/aac/ogg(vorbis)/flac — KHÔNG nhận
// webm/opus (Chrome) hay mp4/aac (Safari) mà MediaRecorder xuất ra. Gửi
// thẳng các format đó → Gemini reject → STT_FAILED. Giải pháp: decode blob
// ghi âm rồi re-encode sang WAV 16kHz mono (chuẩn cho speech) ngay trên FE,
// không cần ffmpeg/transcode ở BE.
const STT_TARGET_RATE = 16000;

let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  sharedAudioCtx ??= new Ctor();
  return sharedAudioCtx;
}

// Trung bình cộng theo cửa sổ để hạ sample rate về 16kHz (đủ tốt cho voice).
function downsampleMono(input: Float32Array, srcRate: number): Float32Array {
  if (srcRate <= STT_TARGET_RATE) return input;
  const ratio = srcRate / STT_TARGET_RATE;
  const outLen = Math.round(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count += 1;
    }
    out[i] = count ? sum / count : input[start] || 0;
  }
  return out;
}

// Float32 PCM [-1,1] → WAV 16-bit PCM mono (header chuẩn RIFF/WAVE).
function encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audioFormat = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byteRate = rate * channels * 2
  view.setUint16(32, 2, true); // blockAlign = channels * 2
  view.setUint16(34, 16, true); // bitsPerSample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

/**
 * Decode blob ghi âm (webm/opus, mp4/aac, ...) → WAV 16kHz mono mà Gemini
 * nhận. Trả `{ base64, mimeType: 'audio/wav' }`, hoặc `null` nếu không
 * decode được (caller nên bỏ qua chunk — gửi format gốc cũng chỉ fail).
 */
export async function blobToGeminiWav(
  blob: Blob,
): Promise<{ base64: string; mimeType: string } | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    // slice(0): decodeAudioData "detach" ArrayBuffer gốc, copy để an toàn.
    const arr = (await blob.arrayBuffer()).slice(0);
    const audioBuf = await ctx.decodeAudioData(arr);
    const channels = audioBuf.numberOfChannels;
    const len = audioBuf.length;
    if (!len) return null;
    // Mixdown về mono.
    const mono = new Float32Array(len);
    for (let c = 0; c < channels; c++) {
      const data = audioBuf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
    }
    const down = downsampleMono(mono, audioBuf.sampleRate);
    const base64 = await readBlobAsBase64(encodeWavPcm16(down, STT_TARGET_RATE));
    if (!base64) return null;
    return { base64, mimeType: "audio/wav" };
  } catch {
    return null;
  }
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

/** Skip empty transcripts and timestamp-only noise from STT models */
export function isGarbageSttText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // Timestamp-only text like "00:00", "00:00 00:01", "00:00, 00:01, 00:02"
  if (/^(\d{1,2}:\d{2})([,;\s]+\d{1,2}:\d{2})*$/.test(t)) return true;
  if (/^[\d:\s.,;]+$/.test(t) && t.includes(":")) return true;
  // Single timestamp wrapped in noise like "00:00." or ".00:00."
  if (/^[\s.,;]*\d{1,2}:\d{2}[\s.,;]*$/.test(t)) return true;
  return false;
}
