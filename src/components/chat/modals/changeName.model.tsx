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
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CallChangeNameModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const roomState = useRoomStore((state) => state);
  const [name, setName] = useState(roomState.room?.name || "");
  const handleChangeName = async () => {
    if (!name) return;
    if (roomState.room?.name === name) return;
    if (!roomState.room?.id) return;
    await roomState.changeRoomName(roomState.room?.id, name);
  };
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col items-center gap-1">
              {t("chat.modal.changeName.title")}
            </ModalHeader>
            <ModalBody>
              <span className="text-sm">
                {t("chat.modal.changeName.description")}
              </span>
              <Input
                type="text"
                required={true}
                label={t("chat.modal.changeName.label")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </ModalBody>
            <ModalFooter className="flex justify-center gap-5">
              <Button color="danger" variant="light" onPress={onClose}>
                {t("chat.modal.changeName.cancel")}
              </Button>
              <Button
                color="primary"
                disabled={roomState.room?.name === name}
                onPress={() => {
                  handleChangeName();
                  onClose();
                }}
              >
                {t("chat.modal.changeName.confirm")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
