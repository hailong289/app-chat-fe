"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import {
  confirmGuestCallWithName,
  getGuestCallPending,
  hasGuestSfuCallPending,
} from "@/libs/guest-call-auth";

const MAX_NAME_LENGTH = 50;

export function GuestNameModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const syncPending = () => {
    const pending = hasGuestSfuCallPending();
    setOpen(pending);
    if (!pending) {
      setName("");
      setError(null);
    }
  };

  useEffect(() => {
    syncPending();
    window.addEventListener("guest-call-session-changed", syncPending);
    return () =>
      window.removeEventListener("guest-call-session-changed", syncPending);
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên của bạn");
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Tên tối đa ${MAX_NAME_LENGTH} ký tự`);
      return;
    }

    setSubmitting(true);
    const ok = confirmGuestCallWithName(trimmed);
    setSubmitting(false);

    if (!ok) {
      setError("Không thể tham gia cuộc gọi. Vui lòng mở lại link mời.");
      return;
    }

    setOpen(false);
    setError(null);
  };

  const pending = getGuestCallPending();
  const callLabel =
    pending?.callType === "video" ? "cuộc gọi video" : "cuộc gọi thoại";

  return (
    <Modal
      isOpen={open}
      isDismissable={false}
      hideCloseButton
      placement="center"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Tham gia {callLabel}
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500">
            Nhập tên hiển thị để mọi người trong cuộc gọi nhận biết bạn.
          </p>
          <Input
            autoFocus
            label="Tên của bạn"
            placeholder="Ví dụ: Minh Anh"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            isInvalid={!!error}
            errorMessage={error ?? undefined}
            onValueChange={(value) => {
              setName(value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            color="primary"
            isLoading={submitting}
            onPress={handleSubmit}
          >
            Tham gia cuộc gọi
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
