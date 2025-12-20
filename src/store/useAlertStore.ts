import { create } from "zustand";

type AlertType = "info" | "success" | "warning" | "error" | "confirm";

interface AlertOptions {
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface AlertState {
  isOpen: boolean;
  type: AlertType;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  isLoading: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;

  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: AlertOptions) => void;
  closeAlert: () => void;
}

const useAlertStore = create<AlertState>((set, get) => ({
  isOpen: false,
  type: "info",
  title: "",
  message: "",
  confirmText: "OK",
  cancelText: "Cancel",
  isLoading: false,
  onConfirm: undefined,
  onCancel: undefined,

  showAlert: ({
    title,
    message,
    type = "info",
    confirmText = "OK",
    onConfirm,
  }) => {
    set({
      isOpen: true,
      type,
      title: title || type.charAt(0).toUpperCase() + type.slice(1),
      message,
      confirmText,
      onConfirm,
      // Reset others
      cancelText: "",
      onCancel: undefined,
    });
  },

  showConfirm: ({
    title,
    message,
    type = "confirm",
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
  }) => {
    set({
      isOpen: true,
      type,
      title: title || "Confirm",
      message,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
    });
  },

  closeAlert: () => {
    set({ isOpen: false, isLoading: false });
  },
}));

export default useAlertStore;
