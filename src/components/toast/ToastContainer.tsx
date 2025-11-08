"use client";

import { useToastStore } from "@/store/useToastStore";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const getToastStyles = (type: string) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-green-50 dark:bg-green-900/20",
          border: "border-green-200 dark:border-green-800",
          icon: CheckCircleIcon,
          iconColor: "text-green-500",
          textColor: "text-green-900 dark:text-green-100",
        };
      case "error":
        return {
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-200 dark:border-red-800",
          icon: ExclamationCircleIcon,
          iconColor: "text-red-500",
          textColor: "text-red-900 dark:text-red-100",
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-900/20",
          border: "border-amber-200 dark:border-amber-800",
          icon: ExclamationTriangleIcon,
          iconColor: "text-amber-500",
          textColor: "text-amber-900 dark:text-amber-100",
        };
      case "info":
        return {
          bg: "bg-blue-50 dark:bg-blue-900/20",
          border: "border-blue-200 dark:border-blue-800",
          icon: InformationCircleIcon,
          iconColor: "text-blue-500",
          textColor: "text-blue-900 dark:text-blue-100",
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-800",
          border: "border-gray-200 dark:border-gray-700",
          icon: InformationCircleIcon,
          iconColor: "text-gray-500",
          textColor: "text-gray-900 dark:text-gray-100",
        };
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type);
          const Icon = styles.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto"
            >
              <div
                className={`
                  ${styles.bg} ${styles.border} ${styles.textColor}
                  border rounded-lg shadow-lg p-4 min-w-[320px] max-w-md
                  backdrop-blur-sm
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.iconColor}`}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {toast.title && (
                      <h4 className="font-semibold text-sm mb-1">
                        {toast.title}
                      </h4>
                    )}
                    <p className="text-sm opacity-90 break-words">
                      {toast.message}
                    </p>

                    {/* Action button */}
                    {toast.action && (
                      <Button
                        size="sm"
                        variant="flat"
                        className="mt-2"
                        onClick={() => {
                          toast.action?.onClick();
                          removeToast(toast.id);
                        }}
                      >
                        {toast.action.label}
                      </Button>
                    )}
                  </div>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
