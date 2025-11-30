import useContactStore from "@/store/useContactStore";
import useRoomStore from "@/store/useRoomStore";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
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
  Select,
  SelectItem,
  User,
} from "@heroui/react";
import { useEffect, useMemo, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const types = [
  { value: "group", label: "Nhóm" },
  { value: "channel", label: "Kênh" },
] as const;

export const CreateRoomModal = ({ isOpen, onClose }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"group" | "channel">("group");

  // Chỉ lấy đúng phần cần dùng để tránh rerender thừa
  const createRoom = useRoomStore((state) => state.createRoom);
  const contacts = useContactStore((state) => state.contacts);

  // Reset form mỗi lần modal đóng/mở
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setMemberIds([]);
      setName("");
      setType("group");
    }
  }, [isOpen]);

  // Lọc danh bạ theo searchTerm
  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const lower = searchTerm.toLowerCase();
    return contacts.filter((c) => c.fullname.toLowerCase().includes(lower));
  }, [contacts, searchTerm]);

  // Validation
  const isNameInvalid = name.trim().length < 3;
  const isMembersInvalid = memberIds.length < 2;
  const isFormInvalid = isNameInvalid || isMembersInvalid;

  const handleMembersChange = (newValues: string[]) => {
    setMemberIds(newValues);
  };

  const handleCreateRoom = () => {
    // Double-check phía client
    if (isFormInvalid) return;

    createRoom(type, name.trim(), memberIds);

    // Clear form + đóng modal
    setName("");
    setMemberIds([]);
    setSearchTerm("");
    setType("group");
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
            <ModalHeader className="flex items-center gap-2">
              <h4>Tạo</h4>
              <Select
                className="w-32"
                selectedKeys={[type]}
                onChange={(e) =>
                  setType((e.target.value as "group" | "channel") || "group")
                }
              >
                {types.map((t) => (
                  <SelectItem key={t.value}>{t.label}</SelectItem>
                ))}
              </Select>
            </ModalHeader>

            <ModalBody className="w-full">
              <Input
                label="Tên đoạn chat"
                placeholder="Nhập tên đoạn chat"
                value={name}
                isRequired
                isInvalid={isNameInvalid && name.length > 0}
                validate={(value) => {
                  if (value.trim().length < 3) {
                    return "Tên đoạn chat phải có ít nhất 3 ký tự.";
                  }
                }}
                onChange={(e) => setName(e.target.value)}
              />

              <Input
                label={`Thành viên ${memberIds.length}/${contacts.length}`}
                placeholder="Nhập tên thành viên"
                value={searchTerm}
                startContent={
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                }
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <CheckboxGroup
                isInvalid={isMembersInvalid && memberIds.length > 0}
                className="max-h-60 w-full overflow-y-auto"
                value={memberIds}
                onValueChange={handleMembersChange}
              >
                {filteredContacts.map((m) => (
                  <Checkbox className="flex w-full" key={m.id} value={m.id}>
                    <User
                      className="w-full"
                      name={m.fullname}
                      avatarProps={{
                        src: m.avatar ?? undefined,
                      }}
                    />
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </ModalBody>

            <ModalFooter>
              <Button onPress={close}>Huỷ</Button>
              <Button
                disabled={isFormInvalid}
                color="primary"
                onPress={handleCreateRoom}
              >
                Tạo
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
