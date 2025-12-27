import useContactStore from "@/store/useContactStore";
import useRoomStore from "@/store/useRoomStore";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  User,
} from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddMemberModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // Chỉ lấy đúng field cần
  const contacts = useContactStore((state) => state.contacts);
  const roomState = useRoomStore((state) => state);
  // Reset form mỗi lần modal đóng
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setMemberIds([]);
    }
  }, [isOpen]);

  // Lọc contact theo searchTerm
  const filteredContacts = useMemo(() => {
    const currentMemberIds = roomState.room?.members.map((m) => m.id) || [];

    const availableContacts = contacts.filter(
      (c) => !currentMemberIds.includes(c.id)
    );

    if (!searchTerm.trim()) return availableContacts;

    const lower = searchTerm.toLowerCase();

    return availableContacts.filter((c) =>
      c.fullname.toLowerCase().includes(lower)
    );
  }, [contacts, searchTerm, roomState.room]);

  // Validation
  const isMembersInvalid = memberIds.length < 1;

  const handleChange = (newValues: string[]) => {
    setMemberIds(newValues);
  };

  const addMember = () => {
    if (isMembersInvalid) return;

    // TODO: call API add member here - implement after backend confirms member add endpoint
    roomState.addMember(memberIds);

    setMemberIds([]);
    setSearchTerm("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader>{t("chat.modal.addMember.title")}</ModalHeader>
            <ModalBody className="w-full">
              <Input
                label={t("chat.modal.addMember.selected", {
                  count: memberIds.length,
                  total: contacts.length,
                })}
                placeholder={t("chat.modal.addMember.placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <CheckboxGroup
                isInvalid={isMembersInvalid && memberIds.length > 0}
                className="max-h-60 w-full overflow-y-auto"
                value={memberIds}
                onValueChange={handleChange}
              >
                {filteredContacts.map((m) => (
                  <Checkbox className="flex w-full" key={m.id} value={m.id}>
                    <User
                      className="w-full"
                      name={m.fullname}
                      avatarProps={{
                        src: m.avatar || undefined,
                      }}
                    />
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </ModalBody>
            <ModalFooter>
              <Button onPress={close}>
                {t("chat.modal.addMember.cancel")}
              </Button>
              <Button
                color="primary"
                onPress={addMember}
                disabled={isMembersInvalid}
              >
                {t("chat.modal.addMember.add")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
