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
  Button,
  Tabs,
  Tab,
  Input,
  useDisclosure,
  Tooltip,
} from "@heroui/react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import InvaitationSentModal from "../contact/modal/invitation-sent.modal";
import ItemContact from "../contact/itemContac";
import useContactStore from "@/store/useContactStore";
import useCounterStore from "@/store/useCounterStore";
import { useSocket } from "../providers/SocketProvider";

const Contacts: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const contactState = useContactStore((state) => state);
  const isCollapsed = useCounterStore((state) => state.collapsedSidebar);
  const toggleSidebar = useCounterStore((state) => state.togoleSidebar);
  const { socket: chatSocket } = useSocket("/chat");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await contactState.getAllContacts();
      await contactState.getFriends();
      // Suggestions fetch is best-effort (errors swallowed in the action).
      contactState.fetchFriendSuggestions(10);
      if (cancelled) return;
      // Poll presence AFTER friends land in db.contacts — otherwise
      // friends who were already online when this tab opened never light
      // up (no STATUS broadcast fires for state that didn't transition).
      const s = chatSocket;
      if (s?.connected) {
        contactState.checkOnlineStatus(s);
      } else if (s) {
        s.once("connect", () => contactState.checkOnlineStatus(s));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSocket]);
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
  };
  const friendPreviews = contactState.friends.slice(0, 6);

  return (
    <>
      <Card className="h-full w-full shadow-none border-none rounded-none">
        <CardBody
          className={isCollapsed ? "py-4 flex flex-col items-center gap-4" : ""}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex flex-col items-center gap-2">
                <Tooltip content="Tìm kiếm bạn bè" placement="right">
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={() => {
                      if (isCollapsed) toggleSidebar();
                      setShowSearch(true);
                    }}
                  >
                    <MagnifyingGlassIcon className="w-5 h-5" />
                  </Button>
                </Tooltip>
                <Tooltip content="Lời mời kết bạn" placement="right">
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={() => {
                      if (isCollapsed) toggleSidebar();
                      onOpenChange();
                      onPressFriendRequestsent();
                    }}
                  >
                    <ChevronUpIcon className="w-5 h-5" />
                  </Button>
                </Tooltip>
                <Tooltip content="Đóng danh sách" placement="right">
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-gray-500"
                    onPress={handleClose()}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </Button>
                </Tooltip>
              </div>

              <div className="flex flex-col items-center gap-3">
                {friendPreviews.map((item) => (
                  <Tooltip
                    key={item.id}
                    content={item.fullname}
                    placement="right"
                  >
                    <Avatar
                      src={item.avatar ?? undefined}
                      name={item.fullname}
                      size="md"
                      isBordered
                      className="cursor-pointer"
                      onClick={() => {
                        if (isCollapsed) toggleSidebar();
                        onPress(item.id);
                      }}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-between p-2 border-b  w-full">
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
                    classNames={{
                      // Tab titles are tight in Vietnamese — squeezing all
                      // three into the narrow contacts panel cuts off the
                      // last one. Compact font + smaller padding lets all
                      // three fit at panel widths down to ~280px.
                      tabList: "px-1 gap-1",
                      tab: "px-2 text-xs",
                    }}
                  >
                    <Tab
                      key="0"
                      title="Bạn bè"
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
                      title="Lời mời"
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

                    <Tab
                      key="2"
                      title="Gợi ý"
                      onClick={() => contactState.fetchFriendSuggestions(10)}
                    >
                      {contactState.suggestions.length === 0 ? (
                        <p className="text-center text-default-400 text-sm py-6">
                          Chưa có gợi ý nào. Hãy kết bạn với một vài người để
                          nhận thêm gợi ý.
                        </p>
                      ) : (
                        <div className="flex flex-col">
                          {contactState.suggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => onPress(s.id)}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-default-100 transition text-left"
                            >
                              <Avatar
                                src={s.avatar || undefined}
                                name={s.fullname}
                                size="md"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {s.fullname}
                                </p>
                                <p className="text-xs text-default-500 truncate">
                                  {s.mutualFriendsCount}{" "}
                                  bạn chung
                                  {s.mutualSamples.length > 0 && (
                                    <>
                                      {" — "}
                                      {s.mutualSamples.join(", ")}
                                      {s.mutualFriendsCount >
                                        s.mutualSamples.length && "…"}
                                    </>
                                  )}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
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
            </>
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
