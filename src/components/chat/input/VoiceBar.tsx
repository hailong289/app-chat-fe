// VoiceBar.tsx
"use client";
import { Button } from "@heroui/react"; // hoặc lib button bạn đang dùng
import {
  PlayIcon,
  PauseCircleIcon,
  StopCircleIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/solid";
import WaveformCanvas from "../message/WaveformCanvas"; // bản có prop height
import { useVoiceRecorder } from "@/libs/useVoiceRecorder";
import { useTranslation } from "react-i18next";

function formatMMSS(ms: number) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceBar({
  micro, // boolean: bật/tắt khu vực voice
  onReady, // optional: callback khi đã có preview (FilePreview)
  height = 56, // chiều cao waveform (px)
  centerRatio = 0.62, // vị trí đường giữa (0..1) – 0.62 để sóng nằm thấp xuống
  gain = 0.9, // biên độ sóng
}: Readonly<{
  micro: boolean;
  onReady?: (fp: any) => void;
  height?: number;
  centerRatio?: number;
  gain?: number;
}>) {
  const { t } = useTranslation();
  const {
    state,
    durationMs,
    preview,
    start,
    pause,
    resume,
    stop,
    cancel,
    attachCanvas,
  } = useVoiceRecorder();

  if (!micro) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Thanh điều khiển */}
      <div className="flex items-center gap-2">
        {state === "idle" && (
          <Button
            onPress={start}
            color="primary"
            startContent={<MicrophoneIcon className="w-5 h-5" />}
          >
            {t("chat.voice.record")}
          </Button>
        )}

        {state === "recording" && (
          <>
            <Button
              onPress={pause}
              color="warning"
              startContent={<PauseCircleIcon className="w-5 h-5" />}
            >
              {t("chat.voice.pause")}
            </Button>
            <Button
              onPress={stop}
              color="danger"
              startContent={<StopCircleIcon className="w-5 h-5" />}
            >
              {t("chat.voice.stop")}
            </Button>
          </>
        )}

        {state === "paused" && (
          <>
            <Button
              onPress={resume}
              color="success"
              startContent={<PlayIcon className="w-5 h-5" />}
            >
              {t("chat.voice.resume")}
            </Button>
            <Button
              onPress={stop}
              color="danger"
              startContent={<StopCircleIcon className="w-5 h-5" />}
            >
              {t("chat.voice.stop")}
            </Button>
          </>
        )}

        <span className="ml-auto text-sm tabular-nums">
          {formatMMSS(durationMs)}
        </span>
      </div>

      {/* Waveform realtime */}
      <WaveformCanvas
        // height={height}
        attach={(el) => attachCanvas(el, { height, centerRatio, gain })}
      />

      {/* Preview sau khi dừng */}
      {preview && (
        <div className="flex items-center gap-3">
          <audio controls src={preview.url} className="w-64" />
          <span className="text-xs text-gray-500">
            {(preview.duration! / 1000).toFixed(1)}s
          </span>

          {/* Tuỳ chọn: confirm dùng file này / huỷ */}
          {onReady && (
            <Button onPress={() => onReady(preview)} color="secondary">
              {t("chat.voice.useFile")}
            </Button>
          )}
          <Button onPress={cancel} variant="flat">
            {t("chat.voice.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
