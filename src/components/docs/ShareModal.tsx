import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Avatar,
  Select,
  SelectItem,
  User,
  Chip,
  Spinner,
} from "@heroui/react";
import { useState, useEffect, useCallback } from "react";
import useDocumentStore from "@/store/useDocumentStore";
import { Document } from "@/service/document.service";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import useAuthStore from "@/store/useAuthStore";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import AuthService from "@/service/auth.service";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  onUpdate: (doc: Document) => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  document,
  onUpdate,
}: Readonly<ShareModalProps>) {
  const { t } = useTranslation();
  const { shareDocument, unshareDocument, updateVisibility } =
    useDocumentStore();
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = document.ownerId === currentUser?._id;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("editor");
  const [visibility, setVisibility] = useState<string>(
    document.visibility || "private"
  );
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisibility(document.visibility || "private");
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [isOpen, document]);

  const handleSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim()) {
        setIsSearching(true);
        try {
          const response: any = await AuthService.searchUser({
            keyword: query,
            limit: 5,
          });
          if (response.data && response.data.metadata) {
            setSearchResults(response.data.metadata);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error("Search failed", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500),
    []
  );

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  const handleVisibilityChange = async (newVisibility: string) => {
    setLoading(true);
    try {
      const updatedDoc = await updateVisibility(document._id, newVisibility);
      if (updatedDoc) {
        setVisibility(newVisibility);
        onUpdate(updatedDoc);
      }
    } catch (error) {
      console.error("Failed to update visibility", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (userId: string, role: string = "editor") => {
    setLoading(true);
    try {
      const updatedDoc = await shareDocument(document._id, userId, role);
      if (updatedDoc) {
        onUpdate(updatedDoc);
      }
    } catch (error) {
      console.error("Failed to share", error);
    } finally {
      setLoading(false);
      setSearchQuery(""); // Clear search after sharing
    }
  };

  const handleUnshare = async (userId: string) => {
    setLoading(true);
    try {
      const updatedDoc = await unshareDocument(document._id, userId);
      if (updatedDoc) {
        onUpdate(updatedDoc);
      }
    } catch (error) {
      console.error("Failed to unshare", error);
    } finally {
      setLoading(false);
    }
  };

  const sharedUsers = document.sharedWith || [];
  const docOwner = document.owner;

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="2xl">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              {t("share.title", { title: document.title })}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-6">
                {/* Visibility Section */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {t("share.generalAccess")}
                    </span>
                    <span className="text-xs text-gray-500">
                      {t("share.generalAccessDesc")}
                    </span>
                  </div>
                  <Select
                    selectedKeys={[visibility]}
                    onChange={(e) => handleVisibilityChange(e.target.value)}
                    className="max-w-xs"
                    size="sm"
                    isDisabled={loading || !isOwner}
                    aria-label={t("share.generalAccess")}
                  >
                    <SelectItem key="private">
                      {t("share.restricted")}
                    </SelectItem>
                    <SelectItem key="public">{t("share.public")}</SelectItem>
                  </Select>
                </div>

                {/* Add People Section */}
                {isOwner && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">
                      {t("share.addPeople")}
                    </span>
                    <div className="flex gap-2">
                      <Input
                        className="flex-1"
                        placeholder={t("share.searchPlaceholder")}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        startContent={
                          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                        }
                      />
                      <Select
                        className="w-36"
                        selectedKeys={[selectedRole]}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        aria-label="Select role"
                        size="sm"
                        disallowEmptySelection
                      >
                        <SelectItem key="viewer">
                          {t("share.roleViewer") || "Viewer"}
                        </SelectItem>
                        <SelectItem key="editor">
                          {t("share.roleEditor") || "Editor"}
                        </SelectItem>
                      </Select>
                    </div>

                    {/* Search Results */}
                    {searchQuery &&
                      (() => {
                        let searchContent;
                        if (isSearching) {
                          searchContent = (
                            <div className="p-4 flex justify-center">
                              <Spinner size="sm" />
                            </div>
                          );
                          console.log(
                            "🚀 ~ ShareModal ~ searchResults:",
                            searchResults
                          );
                        } else if (searchResults.length > 0) {
                          searchContent = searchResults.map((user: any) => (
                            <div
                              key={user._id}
                              className="w-full flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                              onClick={() =>
                                handleShare(user._id, selectedRole)
                              }
                              role="button"
                              tabIndex={0}
                            >
                              <User
                                name={user.fullname}
                                description={user.email || user.phone}
                                avatarProps={{
                                  src: user.avatar,
                                }}
                              />
                              <Button size="sm" variant="flat" color="primary">
                                {t("share.add")}
                              </Button>
                            </div>
                          ));
                        } else {
                          searchContent = (
                            <div className="p-2 text-center text-gray-500 text-sm">
                              {t("share.noUsersFound")}
                            </div>
                          );
                        }
                        return (
                          <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                            {searchContent}
                          </div>
                        );
                      })()}
                  </div>
                )}

                {/* Shared Users List */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    {t("share.peopleWithAccess")}
                  </span>
                  <div className="space-y-2">
                    {/* Owner */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        <Avatar
                          className="w-8 h-8"
                          src={docOwner?.usr_avatar}
                          name={docOwner?.usr_fullname}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {docOwner?.usr_fullname || t("share.owner")}
                            {document.ownerId === currentUser?._id &&
                              ` (${t("share.you")})`}
                          </span>
                          <span className="text-xs text-gray-500">
                            {docOwner?.usr_email}
                          </span>
                        </div>
                      </div>
                      <Chip size="sm" variant="flat" color="success">
                        {t("share.roleOwner")}
                      </Chip>
                    </div>

                    {/* Shared Users */}
                    {sharedUsers.map((share: any) => (
                      <div
                        key={share.userId}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            className="w-8 h-8"
                            src={share.user?.usr_avatar}
                            name={share.user?.usr_fullname}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {share.user?.usr_fullname ||
                                `User ${share.userId.slice(0, 8)}...`}
                            </span>
                            <span className="text-xs text-gray-500">
                              {share.user?.usr_email}
                            </span>
                            <span className="text-xs text-gray-400 capitalize">
                              {share.role}
                            </span>
                          </div>
                        </div>

                        {document.ownerId === currentUser?._id && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => handleUnshare(share.userId)}
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onClose}>
                {t("share.done")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
