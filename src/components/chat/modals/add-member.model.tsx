import useContactStore from "@/store/useContactStore";
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
  User,
} from "@heroui/react";
import { use, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddMemberModal = ({ isOpen, onClose }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [checkValid, setCheckValid] = useState(false);
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
  const contactState = useContactStore((state) => state);
  const handleChange = (newValues: string[]) => {
    setMemberIds(newValues);
    setCheckValid(newValues.length < 1);

    // ở đây bạn có thể cập nhật state khác, gọi API, etc
  };

  const addMember = () => {
    if (checkValid) return;
    // Logic để tạo phòng chat mới
    console.log("Thành viên:", memberIds);
    setMemberIds([]);
    setCheckValid(false);
    onClose();
  };
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Thêm thành viên</ModalHeader>
            <ModalBody className="w-full">
              <Input
                placeholder="Nhập tên bạn bè"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <CheckboxGroup
                isInvalid={memberIds.length < 1}
                className="max-h-50 w-full overflow-hidden overflow-y-auto"
                value={memberIds}
                onValueChange={handleChange}
                // hoặc onChange tùy phiên bản: onChange={(v) => handleChange(v)}
              >
                {contactState.contacts.map((m) => (
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
              <Button onPress={onClose}>Huỷ</Button>
              <Button color="primary">Thêm</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
