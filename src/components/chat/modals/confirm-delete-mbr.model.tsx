import useRoomStore from "@/store/useRoomStore";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
}

export const DelelteMD = ({ isOpen, onClose, memberId }: Props) => {
  const { t } = useTranslation();
  const roomState = useRoomStore((state) => state);
  const member = roomState.room?.members.find((m) => m.id === memberId);
  const handleChange = async () => {
    if (!roomState.room?.id) return;
    await roomState.deleteMember(memberId);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col items-center gap-1">
              {t("chat.modal.deleteMember.title")}
            </ModalHeader>
            <ModalBody>
              <p>
                {t("chat.modal.deleteMember.description", {
                  name: member?.name,
                })}
              </p>
            </ModalBody>
            <ModalFooter className="w-full justify-center gap-5">
              <Button color="danger" variant="light" onPress={onClose}>
                {t("chat.modal.deleteMember.cancel")}
              </Button>
              <Button color="danger" onPress={handleChange}>
                {t("chat.modal.deleteMember.confirm")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
