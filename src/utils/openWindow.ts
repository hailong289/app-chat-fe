"use client";

import { isTauriRuntime } from "@/libs/helpers";

function sanitizeLabel(input: string): string {
  return input.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120);
}

export async function openWindowWithTauri(
  url: string,
  target = "_blank",
  features?: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  if (!isTauriRuntime()) {
    window.open(url, target, features);
    return;
  }

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label =
      target && target !== "_blank"
        ? sanitizeLabel(target)
        : sanitizeLabel(`external_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    new WebviewWindow(label, {
      url,
      title: "Window",
      width: 1100,
      height: 800,
      center: true,
      focus: true,
      resizable: true,
    });
  } catch {
    window.open(url, target, features);
  }
}

