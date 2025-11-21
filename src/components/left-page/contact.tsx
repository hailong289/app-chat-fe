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

const Contacts: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const contactState = useContactStore((state) => state);

  useEffect(() => {
    contactState.getAllContacts();
    contactState.getFriends();
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
  const onPressFriendRequestsInvite = () => {
    contactState.friendRequessts({ type: "received" });
  };
  const onPressFriendRequestsent = () => {
    contactState.friendRequessts({ type: "sent" });
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
                <Tab
                  key="0"
                  title="Danh sách bạn bè"
                  onClick={() => contactState.getFriends()}
                >
                  {contactState.friends.map((update) => (
                    <ItemContact
                      key={update.id}
                      item={update}
                      onPress={() => onPress(update.id)}
                      type="all"
                    />
                  ))}
                </Tab>

                <Tab
                  key="1"
                  title="Lời mời kết bạn"
                  onClick={onPressFriendRequestsInvite}
                >
                  <Button
                    className="text-blue-500"
                    variant="light"
                    fullWidth
                    onPress={() => {
                      onOpenChange();
                      onPressFriendRequestsent();
                    }}
                  >
                    <h5>Xem lời mời đã gửi</h5>
                  </Button>
                  {contactState.inviteds.map((item) => (
                    <ItemContact
                      item={item}
                      key={item.id}
                      onPress={() => onPress(item.id)}
                      type="received"
                    />
                  ))}
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
                  type="all"
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
