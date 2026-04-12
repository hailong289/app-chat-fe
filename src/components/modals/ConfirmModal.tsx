"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { ReactNode } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  content: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  content,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  isLoading = false,
  color = "danger",
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">{title}</ModalHeader>
            <ModalBody>
              {typeof content === "string" ? <p>{content}</p> : content}
            </ModalBody>
            <ModalFooter>
              <Button color="default" variant="light" onPress={onClose} isDisabled={isLoading}>
                {cancelText}
              </Button>
              <Button color={color} onPress={onConfirm} isLoading={isLoading}>
                {confirmText}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
