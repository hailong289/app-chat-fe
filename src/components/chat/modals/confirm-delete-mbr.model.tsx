import useRoomStore from "@/store/useRoomStore";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
}

export const DelelteMD = ({ isOpen, onClose, memberId }: Props) => {
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
              Xác Nhận Xoá Thành Viên
            </ModalHeader>
            <ModalBody>
              <p>
                Bạn có chắc chắn muốn xoá{" "}
                <span className="font-semibold">{member?.name}</span> không?
              </p>
            </ModalBody>
            <ModalFooter className="w-full justify-center gap-5">
              <Button color="danger" variant="light" onPress={onClose}>
                Huỷ
              </Button>
              <Button color="danger" onPress={handleChange}>
                Xoá
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
