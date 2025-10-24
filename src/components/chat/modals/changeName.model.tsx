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

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CallChangeNameModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
}) => {
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
              Đổi Tên Đoạn Chat
            </ModalHeader>
            <ModalBody>
              <span className="text-sm">
                Mọi người để biết khi thay đổi tên đoạn chat
              </span>
              <Input
                type="text"
                required={true}
                label="Tên Đoạn Chat"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </ModalBody>
            <ModalFooter className="flex justify-center gap-5">
              <Button color="danger" variant="light" onPress={onClose}>
                Huỷ
              </Button>
              <Button
                color="primary"
                disabled={roomState.room?.name === name}
                onPress={() => {
                  handleChangeName();
                  onClose();
                }}
              >
                Xác Nhận
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
