"use client";

import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const newToast = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        useToastStore.getState().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}));

// Helper functions for easy usage
export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({
      type: "success",
      title,
      message,
      duration,
    }),

  error: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({
      type: "error",
      title,
      message,
      duration,
    }),

  warning: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({
      type: "warning",
      title,
      message,
      duration,
    }),

  info: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast({
      type: "info",
      title,
      message,
      duration,
    }),

  custom: (toast: Omit<Toast, "id">) =>
    useToastStore.getState().addToast(toast),
};
