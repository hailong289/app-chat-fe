import useContactStore from "@/store/useContactStore";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import ItemContact from "../itemContac";
import { useRouter } from "next/navigation";

interface InvaitationSentModalProps {
  // Define any props if needed
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onOpenChange: (isOpen: boolean) => void;
}

export default function InvaitationSentModal({
  isOpen,
  onClose,
  onOpenChange,
}: InvaitationSentModalProps) {
  const contactState = useContactStore((state) => state);
  const router = useRouter();
  const onPress = (id: string) => {
    router.push(`/contacts?profileId=${id}`);
    console.log("Pressed item");
  };
  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Lời mời đã gửi
            </ModalHeader>
            <ModalBody>
              <h3>Đã gửi {contactState.sent.length} lời mời kết bạn</h3>
              {contactState.sent.map((item) => (
                <ItemContact
                  item={item}
                  key={item.id}
                  onPress={() => onPress(item.id)}
                  type="sent"
                />
              ))}
            </ModalBody>
            <ModalFooter>
              {/* <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onPress={onClose}>
                Action
              </Button> */}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
