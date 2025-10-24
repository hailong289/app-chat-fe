import { roomType } from "@/store/types/room.state";
import useRoomStore from "@/store/useRoomStore";
import { CheckIcon, PencilIcon } from "@heroicons/react/16/solid";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useEffect, useState } from "react";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangeNickNameModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const roomState = useRoomStore((state) => state);
  const [members, setMembers] = useState(
    roomState.room?.members.map((member) => ({
      id: member.id,
      name: member.name,
      isChange: false,
    })) || []
  );
  useEffect(() => {
    setMembers(
      roomState.room?.members.map((member) => ({
        id: member.id,
        name: member.name,
        isChange: false,
      })) || []
    );
  }, [roomState.room?.members]);

  const handleDoubleClick = (memberId: string) => {
    const findMember = members.find((member) => member.id === memberId);
    console.log("🚀 ~ handleDoubleClick ~ findMember:", findMember);
    if (findMember?.isChange) {
      console.log("change");
      // call api change nick name
      roomState.changeNickName(memberId, findMember?.name?.trim() || "");
    }

    setMembers((prevMembers) =>
      prevMembers.map((member) =>
        member.id === memberId
          ? { ...member, isChange: !member.isChange }
          : member
      )
    );
  };
  const changeNameMember = async (memberId: string, newName: string) => {
    setMembers((prevMembers) =>
      prevMembers.map((member) =>
        member.id === memberId ? { ...member, name: newName } : member
      )
    );
  };
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col items-center gap-1">
              Biệt Danh
            </ModalHeader>
            <ModalBody>
              <span className="text-sm">
                Mọi người để biết khi thay đổi tên đoạn chat
              </span>

              {members.map((member) => (
                <Input
                  key={member?.id}
                  disabled={!member?.isChange}
                  type="text"
                  required={true}
                  value={member?.name || ""}
                  variant={member?.isChange ? "faded" : "flat"}
                  onChange={(e) => changeNameMember(member.id, e.target.value)}
                  endContent={
                    <Button
                      variant="light"
                      size="sm"
                      onPress={() => handleDoubleClick(member.id)}
                    >
                      {member?.isChange ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <PencilIcon className="h-4 w-4" />
                      )}
                    </Button>
                  }
                />
              ))}
            </ModalBody>
            <ModalFooter className="flex justify-center gap-5">
              <Button color="danger" variant="light" onPress={onClose}>
                Huỷ
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
