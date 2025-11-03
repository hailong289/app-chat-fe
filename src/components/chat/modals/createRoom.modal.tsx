import useRoomStore from "@/store/useRoomStore";
import {
  MagnifyingGlassCircleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/16/solid";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
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
import { m } from "framer-motion";
import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal = ({ isOpen, onClose }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [checkValid, setCheckValid] = useState(false);
  const types = [
    { value: "group", label: "Nhóm" },
    { value: "channel", label: "Kênh" },
  ] as const;
  const [type, setType] = useState<"group" | "channel">(
    (types[0].value as "group" | "channel") || "group"
  );
  const roomState = useRoomStore((state) => state);
  const defaultMembers = [
    {
      id: "0199dbf6282a000000186f",
      name: "Lê Thiên Trí",
      avatar: "",
    },
    {
      id: "0199e1a63dc00000005f85",
      name: "Lê Thiên Trí",
      avatar:
        "https://avatar.iran.liara.run/public/username?username=lêthiêntrí",
    },
    {
      id: "0199e237ba5c000000ff45",
      name: "Lê Thiên Trí3",
      avatar:
        "https://avatar.iran.liara.run/public/username?username=lêthiêntrí3",
    },
    {
      id: "0199e290ac1b00000012a5",
      name: "Nguyễn Văn A",
      avatar:
        "https://avatar.iran.liara.run/public/username?username=nguyenvana",
    },
    {
      id: "0199e29fb8a8000000c85c",
      name: "Trần Bảo B",
      avatar: "https://avatar.iran.liara.run/public/username?username=tranbaob",
    },
    {
      id: "0199e2abfbf00000002b65",
      name: "Phạm Cường C",
      avatar:
        "https://avatar.iran.liara.run/public/username?username=phamcuongc",
    },
    {
      id: "0199e2c3de90000000f1f4",
      name: "Đỗ Minh D",
      avatar: "https://avatar.iran.liara.run/public/username?username=dominhd",
    },
    {
      id: "0199e2f13bd0000000c1e9",
      name: "Lý Hồng E",
      avatar: "https://avatar.iran.liara.run/public/username?username=lyhonge",
    },
    {
      id: "0199e30bb3c00000009b22",
      name: "Võ Nhật F",
      avatar: "https://avatar.iran.liara.run/public/username?username=vonhatf",
    },
    {
      id: "0199e31f1a10000000e5aa",
      name: "Bùi Gia G",
      avatar: "https://avatar.iran.liara.run/public/username?username=buigiag",
    },
    {
      id: "0199e335d210000000e41c",
      name: "Trương Khánh H",
      avatar:
        "https://avatar.iran.liara.run/public/username?username=truongkhanhh",
    },
    {
      id: "0199e34c5ab00000007b5f",
      name: "Tạ Lan I",
      avatar: "https://avatar.iran.liara.run/public/username?username=talani",
    },
    {
      id: "0199e36b89c00000007c9d",
      name: "Huỳnh Quốc J",
      avatar:
        "https://avatar.iran.liara.run/public/username?username=huynhquocj",
    },
  ];
  const handleChange = (newValues: string[]) => {
    console.log("Selected values:", newValues.length);
    setMemberIds(newValues);
    console.log(memberIds);
    setCheckValid(newValues.length < 2);

    // ở đây bạn có thể cập nhật state khác, gọi API, etc
  };
  const handleValid = () => {
    setCheckValid(memberIds.length < 2);
    setCheckValid(name.length < 3);
  };
  const CreateRoom = () => {
    handleValid();
    if (checkValid) return;
    // Logic để tạo phòng chat mới
    console.log("Tạo phòng chat với tên:", name);
    console.log("Thành viên:", memberIds);
    console.log("kiểu:", type);
    // roomState.createRoom(type, name, memberIds);
    setName("");
    setMemberIds([]);
    setCheckValid(false);
    onClose();
  };
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <h4>Tạo</h4>
              <Select className="w-32" defaultSelectedKeys={[types[0].value]}>
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
                isInvalid={name.length < 3}
                validate={(value) => {
                  if (value.length < 3) {
                    return "Tên đoạn chat phải có ít nhất 3 ký tự.";
                  }
                }}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label={`Thành viên ${memberIds.length}/${defaultMembers.length}`}
                placeholder="Nhập tên thành viên"
                value={searchTerm}
                startContent={
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                }
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <CheckboxGroup
                isInvalid={memberIds.length < 2}
                className="max-h-50 w-full overflow-hidden overflow-y-auto"
                value={memberIds}
                onValueChange={handleChange}
                // hoặc onChange tùy phiên bản: onChange={(v) => handleChange(v)}
              >
                {defaultMembers.map((m) => (
                  <Checkbox className="flex w-full" key={m.id} value={m.id}>
                    <User
                      className="w-full"
                      name={m.name}
                      avatarProps={{
                        src: m.avatar,
                      }}
                    />
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </ModalBody>
            <ModalFooter>
              <Button onPress={onClose}>Huỷ</Button>
              <Button
                disabled={checkValid}
                color="primary"
                onPress={CreateRoom}
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
