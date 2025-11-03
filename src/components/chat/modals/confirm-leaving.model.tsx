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

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfirmLeavingModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
}) => {
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
              Xác Nhận rời nhóm
            </ModalHeader>
            <ModalBody>
              <span className="text-sm">
                Bạn có chắc chắn muốn rời khỏi nhóm này không?
              </span>
            </ModalBody>
            <ModalFooter className="flex justify-center gap-5">
              <Button color="danger" variant="light" onPress={onClose}>
                Huỷ
              </Button>
              <Button
                color="default"
                onPress={() => {
                  handleChange();
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
