"use client";
import { useEffect, useRef } from "react";

type Props = {
  attach: (el: HTMLCanvasElement | null) => void | (() => void);
  height?: number; // px, default 56
  className?: string; // optional tailwind bổ sung
};

export default function WaveformCanvas({
  attach,
  height = 56,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = containerRef.current;
    if (!canvas || !wrap) return;

    // ensure canvas fits container width exactly (account for DPR)
    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      // lấy bề rộng thật của container (đÃ trừ padding nhờ clientWidth)
      const cssW = Math.max(0, wrap.clientWidth);
      const cssH = height;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
    };

    applySize();

    // quan sát thay đổi kích thước container
    const ro = new ResizeObserver(applySize);
    ro.observe(wrap);

    // gắn cho hook vẽ
    const detach = attach(canvas);

    return () => {
      ro.disconnect();
      if (typeof detach === "function") detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attach, height]);

  return (
    <div
      ref={containerRef}
      className={
        // min-w-0 là chìa khóa khi đặt trong flex để KHÔNG tràn ngang
        `min-w-0 w-full overflow-hidden rounded-xl 
          ${className}`
      }
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        // block + w-full + h-full để không sinh scrollbar
        className="block w-full h-full"
      />
    </div>
  );
}
