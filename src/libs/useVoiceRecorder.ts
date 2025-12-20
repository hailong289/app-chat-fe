// useVoiceRecorder.ts
"use client";
import { useEffect, useRef, useState } from "react";
import { pickAudioMime } from "./mime";

/** Kiểu file preview bạn đưa ra */
export type FilePreview = {
  _id: string;
  kind: string; // gợi ý: "voice"
  url: string; // blob URL
  name: string;
  size: number;
  mimeType: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  duration?: number | null;
  status?: string; // "pending" | "recording" | "uploaded" | "failed" | ...
  uploadProgress?: number;
  uploadedUrl?: string;
  file?: File;
};

type RecorderState = "idle" | "recording" | "paused";

/** Tuỳ chọn vẽ waveform */
type WaveOptions = {
  /** px, mặc định 56 */
  height?: number;
  /** màu vẽ (CSS color). Mặc định dùng #fff để hợp bubble xanh; đổi '#000' nếu nền sáng */
  color?: string;
  /** "bars" = cột (giống MiniAudioBubble), "line" = đường; mặc định "bars" */
  render?: "line" | "bars";

  // LINE mode:
  /** 0..1: vị trí đường giữa theo chiều cao (mặc định 0.5) */
  centerRatio?: number;
  /** 0.1..3: khuếch đại biên độ (mặc định 1.0) */
  gain?: number;

  // BARS mode:
  /** số cột (mặc định 18) */
  barCount?: number;
  /** px: chiều cao tối thiểu mỗi cột (mặc định 6) */
  barMinPx?: number;
  /** px: chiều cao tối đa mỗi cột (<= height, mặc định height-10) */
  barMaxPx?: number;
  /** 0..1: smoothing EMA (0 = nhảy nhanh, 1 = siêu mượt). Mặc định 0.8 */
  smoothing?: number;
};

export function useVoiceRecorder() {
  // ===== Public state
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [preview, setPreview] = useState<FilePreview | null>(null);

  // ===== Recorder & timing
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const carriedMsRef = useRef<number>(0);

  // ===== Waveform infra
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // ===== Waveform options (runtime)
  const waveHeightRef = useRef<number>(56);
  const waveColorRef = useRef<string>("#ffffff");
  const renderModeRef = useRef<"line" | "bars">("bars");

  // LINE:
  const waveCenterRatioRef = useRef<number>(0.5);
  const waveGainRef = useRef<number>(1.0);

  // BARS:
  const barCountRef = useRef<number>(18);
  const barMinPxRef = useRef<number>(6);
  const barMaxPxRef = useRef<number>(46);
  const smoothingRef = useRef<number>(0.8);
  const prevHeightsRef = useRef<number[] | null>(null);

  // ===== Cancel guard & blob URL
  const canceledRef = useRef<boolean>(false);
  const objectUrlRef = useRef<string | null>(null);

  // ===== Timer helpers
  const startTimer = () => {
    startedAtRef.current = performance.now();
    stopTimer();
    timerRef.current = window.setInterval(() => {
      const now = performance.now();
      setDurationMs(carriedMsRef.current + (now - startedAtRef.current));
    }, 100);
  };
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  /** attach canvas + cấu hình options */
  const attachCanvas = (
    el: HTMLCanvasElement | null,
    options?: WaveOptions
  ) => {
    canvasRef.current = el;
    if (!el) return;
    // áp tuỳ chọn
    if (options?.height) waveHeightRef.current = options.height;
    if (options?.color) waveColorRef.current = options.color;
    if (options?.render) renderModeRef.current = options.render;

    if (options?.centerRatio !== undefined)
      waveCenterRatioRef.current = options.centerRatio;
    if (options?.gain !== undefined) waveGainRef.current = options.gain;

    if (options?.barCount) barCountRef.current = options.barCount;
    if (options?.barMinPx) barMinPxRef.current = options.barMinPx;
    if (options?.barMaxPx) barMaxPxRef.current = options.barMaxPx;
    if (options?.smoothing !== undefined)
      smoothingRef.current = Math.min(0.99, Math.max(0, options.smoothing));

    // resize theo DPR + container width (dùng chính el.clientWidth)
    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.max(0, el.clientWidth || 480);
      const cssH = waveHeightRef.current;
      el.width = Math.floor(cssW * dpr);
      el.height = Math.floor(cssH * dpr);
      el.style.width = cssW + "px";
      el.style.height = cssH + "px";
    };
    applySize();

    // theo dõi thay đổi kích thước
    const ro = new ResizeObserver(applySize);
    ro.observe(el);

    // nếu đang ghi thì bắt đầu vẽ
    if (state === "recording" && !rafRef.current) {
      rafRef.current = requestAnimationFrame(drawWave);
    }

    return () => {
      ro.disconnect();
    };
  };

  // ===== Drawing: line
  const drawLine = (
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode,
    canvas: HTMLCanvasElement
  ) => {
    const len = analyser.fftSize;
    const buf = new Uint8Array(len);
    analyser.getByteTimeDomainData(buf);

    const gain = Math.max(0.1, Math.min(3, waveGainRef.current));
    const center =
      Math.max(0, Math.min(1, waveCenterRatioRef.current)) * canvas.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = waveColorRef.current;
    ctx.beginPath();

    const slice = canvas.width / len;
    let x = 0;
    for (let i = 0; i < len; i++) {
      const v = (buf[i] - 128) / 128; // -1..1
      const y = center + v * (canvas.height / 2) * gain;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.lineTo(canvas.width, center);
    ctx.stroke();
  };

  // ===== Drawing: bars
  const drawBars = (
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode,
    canvas: HTMLCanvasElement
  ) => {
    const fftSize = 2048;
    if (analyser.fftSize !== fftSize) analyser.fftSize = fftSize;

    const binCount = analyser.frequencyBinCount; // fftSize/2
    const data = new Uint8Array(binCount);
    analyser.getByteFrequencyData(data); // 0..255

    const barCount = Math.max(6, barCountRef.current);
    const minH = Math.max(0, barMinPxRef.current);
    const maxH = Math.min(
      canvas.height,
      barMaxPxRef.current || canvas.height - 10
    );
    const smooth = smoothingRef.current;

    // log mapping các bin -> bar
    const heights: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const t = i / (barCount - 1 || 1); // 0..1
      const idx = Math.floor(Math.pow(t, 1.7) * (binCount - 1));
      const val = data[idx] / 255; // 0..1
      const h = minH + val * (maxH - minH);
      heights.push(h);
    }

    if (!prevHeightsRef.current || prevHeightsRef.current.length !== barCount) {
      prevHeightsRef.current = heights.slice();
    } else {
      for (let i = 0; i < barCount; i++) {
        prevHeightsRef.current[i] =
          prevHeightsRef.current[i] * smooth + heights[i] * (1 - smooth);
      }
    }
    const smoothed = prevHeightsRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = waveColorRef.current;

    const gap = Math.max(2, Math.floor(canvas.width * 0.006));
    const totalGap = gap * (barCount - 1);
    const bw = Math.max(2, Math.floor((canvas.width - totalGap) / barCount));
    const baseline = Math.floor(canvas.height * 0.8);

    for (let i = 0; i < barCount; i++) {
      const x = i * (bw + gap);
      const h = Math.min(maxH, Math.max(minH, smoothed[i]));
      const y = baseline - h;
      ctx.fillRect(x, y, bw, h);
    }
  };

  const drawWave = () => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext("2d")!;
    if (renderModeRef.current === "bars") drawBars(ctx, analyser, canvas);
    else drawLine(ctx, analyser, canvas);

    rafRef.current = requestAnimationFrame(drawWave);
  };

  // ===== Start recording
  const start = async () => {
    if (state === "recording") return;
    try {
      const { mimeType } = pickAudioMime();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      canceledRef.current = false;
      chunksRef.current = [];
      carriedMsRef.current = 0;
      setDurationMs(0);

      // Web Audio
      const AC = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext;
      audioCtxRef.current = new AC();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      if (canvasRef.current && !rafRef.current) {
        rafRef.current = requestAnimationFrame(drawWave);
      }

      // MediaRecorder
      const rec = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      rec.ondataavailable = (e) =>
        e.data.size && chunksRef.current.push(e.data);

      rec.onstop = () => {
        // Cleanup audio graph + tracks trước
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioCtxRef.current?.close().catch(() => {});
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        // Nếu bị cancel thì không tạo preview
        if (canceledRef.current) return;

        const type = mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File(
          [blob],
          `voice-${Date.now()}.${type.includes("mp4") ? "m4a" : "webm"}`,
          { type }
        );

        if (objectUrlRef.current) {
          try {
            URL.revokeObjectURL(objectUrlRef.current);
          } catch {}
        }
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        setPreview({
          _id: crypto.randomUUID(),
          kind: "voice",
          url,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          duration: durationMs,
          status: "pending",
          file,
        });
      };

      recorderRef.current = rec;
      rec.start(); // rec.start(250) nếu muốn chunk định kỳ
      setState("recording");
      startTimer();
    } catch (e) {
      console.error("getUserMedia error:", e);
      setState("idle");
    }
  };

  const pause = () => {
    const r = recorderRef.current;
    if (!r || r.state !== "recording") return;
    r.pause();
    carriedMsRef.current = durationMs;
    stopTimer();
    setState("paused");
  };

  const resume = () => {
    const r = recorderRef.current;
    if (!r || r.state !== "paused") return;
    r.resume();
    startTimer();
    setState("recording");
  };

  const stop = () => {
    const r = recorderRef.current;
    if (!r) return;
    stopTimer();
    setState("idle");
    try {
      r.stop();
    } finally {
      recorderRef.current = null;
    }
  };

  /** Hủy hoàn toàn: không tạo preview, dọn mọi tài nguyên */
  const cancel = () => {
    canceledRef.current = true;

    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop(); // sẽ kích hoạt onstop (đã guard)
      }
    } catch {}

    stopTimer();

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // dừng stream nếu còn
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // dọn audio graph
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});

    // revoke URL hiện tại (nếu có)
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {}
      objectUrlRef.current = null;
    }
    if (preview?.url) {
      try {
        URL.revokeObjectURL(preview.url);
      } catch {}
    }

    setPreview(null);
    setDurationMs(0);
    carriedMsRef.current = 0;
    setState("idle");
    chunksRef.current = [];
  };

  // unmount cleanup
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {}
      stopTimer();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (objectUrlRef.current) {
        try {
          URL.revokeObjectURL(objectUrlRef.current);
        } catch {}
        objectUrlRef.current = null;
      }
    };
  }, []);

  return {
    // state
    state,
    durationMs,
    preview,

    // actions
    start,
    pause,
    resume,
    stop,
    cancel,

    // waveform canvas
    attachCanvas, // attach(el, { render:"bars", height:56, color:"#fff", ... })
  };
}
