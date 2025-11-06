import React, { useEffect } from "react";
import Image from "next/image";
import {
  ChevronUpIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import {
  Card,
  CardBody,
  Avatar,
  Badge,
  Button,
  Tabs,
  Tab,
  Input,
  useDisclosure,
} from "@heroui/react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import InvaitationSentModal from "../contact/modal/invitation-sent.modal";
import ItemContact from "../contact/itemContac";
import useContactStore from "@/store/useContactStore";

interface StatusUpdate {
  id: string;
  name: string;
  updatedAt: string;
  avatar: string;
}

const Contacts: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const contactState = useContactStore((state) => state);
  const friendRequests: StatusUpdate[] = [
    {
      id: "1",
      name: "Jony Lynetin",
      updatedAt: "Today, 10:30am",
      avatar: "https://avatar.iran.liara.run/public?text=J",
    },
    {
      id: "2",
      name: "Sufiya Elija",
      updatedAt: "Today, 11:00am",
      avatar: "https://avatar.iran.liara.run/public?text=S",
    },
  ];

  const sentRequests: StatusUpdate[] = [
    {
      id: "3",
      name: "Mukrani Pabelo",
      updatedAt: "Today, 9:55am",
      avatar: "https://avatar.iran.liara.run/public?text=M",
    },
    {
      id: "4",
      name: "Pabelo Mukrani",
      updatedAt: "Today, 12:05am",
      avatar: "https://avatar.iran.liara.run/public?text=P",
    },
  ];
  useEffect(() => {
    contactState.getAllContacts();
    console.log("get contacts");
  }, []);
  useEffect(() => {
    if (searchValue == "") return; // tránh gọi khi rỗng

    contactState.search(searchValue);
  }, [searchValue]);

  const router = useRouter();
  const { isOpen, onClose, onOpenChange } = useDisclosure();
  const handleClose = () => () => {
    router.push("/");
  };
  const onPress = (id: string) => {
    router.push(`/contacts?profileId=${id}`);
    console.log("Pressed item");
  };
  return (
    <>
      <Card className="bg-white w-full shadow-none border-none rounded-none">
        <CardBody>
          <div className="flex flex-col items-center justify-between p-2 border-b border-gray-200 w-full">
            <div className="w-full flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold ">Bạn bè</h2>
              <div className="flex items-center justify-end ">
                {!showSearch && (
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-gray-500"
                    onPress={() => setShowSearch((v) => !v)}
                  >
                    <MagnifyingGlassIcon className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  isIconOnly
                  variant="light"
                  className="text-gray-500"
                  onPress={handleClose()}
                >
                  <XMarkIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex  items-center w-full">
              <div className="w-full">
                {/* <h2 className="text-xl font-semibold ">Bạn bè</h2> */}
                {showSearch ? (
                  <form
                    className="  flex items-center gap-2 "
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <Input
                      className="flex-1"
                      placeholder="Tìm kiếm..."
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      autoFocus
                      endContent={
                        <Button
                          isIconOnly
                          variant="light"
                          className="text-gray-500"
                          onPress={() => setShowSearch((v) => !v)}
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </Button>
                      }
                    />
                  </form>
                ) : (
                  <button
                    className="text-small text-gray-500 text-left"
                    onClick={() => setShowSearch((v) => !v)}
                    type="button"
                  >
                    Thêm bạn mới để trò chuyện cùng họ
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs for friend requests and sent requests */}
          {!showSearch && (
            <div className="px-2 w-full mt-5">
              <Tabs
                selectedKey={tab.toString()}
                onSelectionChange={(key) => setTab(Number(key))}
                color="primary"
                variant="solid"
                aria-label="Tabs for friend requests and sent requests"
                fullWidth
              >
                <Tab key="0" title="Danh sách bạn bè">
                  {/* {friendRequests.map((update) => (
                    <ItemContact
                      key={update.id}
                      item={update}
                      onPress={() => onPress(update.id)}
                    />
                  ))} */}
                </Tab>

                <Tab key="1" title="Lời mời kết bạn">
                  <Button
                    className="text-blue-500"
                    variant="light"
                    fullWidth
                    onPress={onOpenChange}
                  >
                    <h5>Xem lời mời đã gửi</h5>
                  </Button>
                  {/* {sentRequests.map((item) => (
                    <ItemContact
                      item={item}
                      key={item.id}
                      onPress={() => onPress(item.id)}
                    />
                  ))} */}
                </Tab>
              </Tabs>
            </div>
          )}
          {showSearch && (
            <div className="px-2 w-full mt-5">
              {contactState.searchResults.map((item) => (
                <ItemContact
                  item={item}
                  key={item.id}
                  onPress={() => onPress(item.id)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <InvaitationSentModal
        isOpen={isOpen}
        onClose={onClose}
        onOpenChange={onOpenChange}
      />
    </>
  );
};

export default Contacts;
