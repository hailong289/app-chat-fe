"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import useAlertStore from "@/store/useAlertStore";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

export default function AlertModal() {
  const {
    isOpen,
    type,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    closeAlert,
  } = useAlertStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (onConfirm) {
      try {
        setLoading(true);
        await onConfirm();
      } catch (error) {
        console.error("Alert action failed:", error);
      } finally {
        setLoading(false);
        closeAlert();
      }
    } else {
      closeAlert();
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeAlert();
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircleIcon className="w-10 h-10 text-success" />;
      case "error":
        return <XCircleIcon className="w-10 h-10 text-danger" />;
      case "warning":
        return <ExclamationTriangleIcon className="w-10 h-10 text-warning" />;
      case "confirm":
        return <InformationCircleIcon className="w-10 h-10 text-primary" />;
      case "info":
      default:
        return <InformationCircleIcon className="w-10 h-10 text-primary" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case "success":
        return "success";
      case "error":
        return "danger";
      case "warning":
        return "warning";
      case "confirm":
        return "primary";
      case "info":
      default:
        return "primary";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleCancel()}
      hideCloseButton={loading}
      isDismissable={!loading}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 items-center text-center pt-8">
          {getIcon()}
          <span className="mt-2 text-xl">{title}</span>
        </ModalHeader>
        <ModalBody className="text-center pb-6">
          <p className="text-default-500">{message}</p>
        </ModalBody>
        <ModalFooter className="justify-center pb-8">
          {(type === "confirm" || cancelText) && (
            <Button
              variant="flat"
              color="default"
              onPress={handleCancel}
              isDisabled={loading}
            >
              {cancelText || t("common.cancel")}
            </Button>
          )}
          <Button
            color={getColor()}
            onPress={handleConfirm}
            isLoading={loading}
          >
            {confirmText || t("common.ok")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
