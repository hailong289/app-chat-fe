import { roomType } from "@/store/types/room.state";
import useRoomStore from "@/store/useRoomStore";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfirmLeavingModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const roomState = useRoomStore((state) => state);
  const handleChange = async () => {
    if (!roomState.room?.id) return;
    const result = await roomState.leavingRoom();
    if (result) {
      router.push(`/chat?chatId=${roomState.room.id}`);
    }
  };
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col items-center gap-1">
              {t("chat.modal.leaveGroup.title")}
            </ModalHeader>
            <ModalBody>
              <span className="text-sm">
                {t("chat.modal.leaveGroup.description")}
              </span>
            </ModalBody>
            <ModalFooter className="flex justify-center gap-5">
              <Button color="danger" variant="light" onPress={onClose}>
                {t("chat.modal.leaveGroup.cancel")}
              </Button>
              <Button
                color="default"
                onPress={() => {
                  handleChange();
                  onClose();
                }}
              >
                {t("chat.modal.leaveGroup.confirm")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
