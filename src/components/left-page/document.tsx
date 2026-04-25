"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DocumentArrowDownIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tooltip,
} from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import useDocumentStore from "@/store/useDocumentStore";
import useAuthStore from "@/store/useAuthStore";
import useAlertStore from "@/store/useAlertStore";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import useCounterStore from "@/store/useCounterStore";
import { useSocket } from "../providers/SocketProvider";

const Document: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();

  const currentUser = useAuthStore((s) => s.user);
  const {
    documents,
    loading,
    creating,
    loadDocuments,
    createDocument,
    deleteDocument,
  } = useDocumentStore();
  const { showConfirm } = useAlertStore();

  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const isCollapsed = useCounterStore((state) => state.collapsedSidebar);
  const { socket } = useSocket("/doc");
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      setTimeout(async () => {
        try {
          await loadDocuments();
        } catch (error) {
          console.error("❌ [SOCKET RECONNECT] Error fetching rooms:", error);
        }
      }, 500);
    };

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, loadDocuments]);

  // Debounce search + query changes

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadDocuments();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [loadDocuments]);

  useEffect(() => {
    if (isCollapsed) {
      setShowSearch(false);
    }
  }, [isCollapsed]);

  // Avoid hydration mismatches from client-only language detection.
  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) return;

    const newDoc = await createDocument({
      title: newDocTitle.trim(),
      visibility: "private",
    });

    if (newDoc) {
      setNewDocTitle("");
      onClose();
      router.push(`/docs/${newDoc._id}`);
    }
  };

  const handleDeleteDocument = (docId: string) => {
    showConfirm({
      title: t("common.confirmDelete"),
      message: t("documents.deleteConfirm"),
      type: "error",
      confirmText: t("common.delete"),
      onConfirm: async () => {
        await deleteDocument(docId);
      },
    });
  };

  const filteredDocuments = useMemo(() => {
    if (!searchValue.trim()) return documents;
    const q = searchValue.toLowerCase();
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, searchValue]);
  const titleText = t("documents.title");
  const collapsedLabel = t("documents.shortTitle", { defaultValue: titleText });

  const collapsedView = (
    <div className="h-full w-full bg-background border-r border-default-200 flex flex-col">
      <div className="flex items-center justify-center h-[60px] border-b border-default-200 bg-background">
        <Tooltip content={titleText} placement="right">
          <span className="text-sm font-semibold text-foreground">
            {collapsedLabel}
          </span>
        </Tooltip>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3 py-4">
        {loading ? (
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : filteredDocuments.length === 0 ? (
          <span className="text-xs text-foreground-400 px-2 text-center">
            {t("documents.empty.title")}
          </span>
        ) : (
          filteredDocuments.map((item) => {
            const isActive = pathname === `/docs/${item._id}`;
            return (
              <Tooltip key={item._id} content={item.title} placement="right">
                <Button
                  isIconOnly
                  variant={isActive ? "solid" : "light"}
                  color={isActive ? "primary" : "default"}
                  size="sm"
                  className="w-10 h-10"
                  onPress={() => router.push(`/docs/${item._id}`)}
                >
                  <DocumentArrowDownIcon className="w-5 h-5" />
                </Button>
              </Tooltip>
            );
          })
        )}
      </div>
      <div className="p-2 border-t border-default-200 flex justify-center">
        <Tooltip content={t("documents.create")} placement="right">
          <Button
            isIconOnly
            variant="flat"
            color="primary"
            size="sm"
            onPress={onOpen}
          >
            <PlusIcon className="w-5 h-5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );

  const expandedView = (
    <div className="h-full w-full bg-background border-r border-default-200 flex flex-col overflow-hidden relative">
      <div className="flex items-center justify-between pl-3 pr-12 py-3 border-b border-default-200 bg-background h-[60px]">
        <div className="flex flex-col overflow-hidden">
          <h2 className="text-lg font-bold truncate">{titleText}</h2>
          <p className="text-xs text-foreground-500 truncate">
            {t("documents.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={t("documents.search")}>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => setShowSearch((v) => !v)}
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content={t("documents.create")}>
            <Button isIconOnly variant="light" size="sm" onPress={onOpen}>
              <PlusIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 border-b border-default-200 bg-background overflow-hidden"
          >
            <Input
              size="sm"
              placeholder={t("documents.modal.placeholder")}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              autoFocus
              variant="bordered"
              startContent={
                <MagnifyingGlassIcon className="w-4 h-4 text-foreground-400" />
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {(() => {
          if (loading) {
            return (
              <div className="flex items-center justify-center h-20">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            );
          }

          if (filteredDocuments.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-10 gap-3 px-4 text-center">
                <p className="text-sm text-foreground-500">
                  {t("documents.empty.title")}
                </p>
                <Button color="primary" size="sm" onPress={onOpen}>
                  {t("documents.empty.button")}
                </Button>
              </div>
            );
          }

          return (
            <div className="flex flex-col">
              {filteredDocuments.map((item) => {
                const isActive = pathname === `/docs/${item._id}`;
                return (
                  <div
                    role="button"
                    key={item._id}
                    tabIndex={0}
                    className={`
                      group relative flex items-center px-3 py-3
                      cursor-pointer transition-all duration-200
                      border-b border-default-100
                      ${
                        isActive
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-default-100 border-l-4 border-l-transparent"
                      }
                      outline-none focus-visible:ring-2 focus-visible:ring-primary
                    `}
                    onClick={() => router.push(`/docs/${item._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/docs/${item._id}`);
                      }
                    }}
                  >
                    <div
                      className={`
                      flex items-center justify-center rounded-lg p-2 transition-colors
                      ${
                        isActive
                          ? "bg-primary text-white shadow-md"
                          : "bg-default-100 text-foreground-500 group-hover:bg-white group-hover:shadow-sm"
                      }
                    `}
                    >
                      <DocumentArrowDownIcon className="w-5 h-5" />
                    </div>

                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-medium truncate ${
                            isActive ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.ownerId === currentUser?._id && (
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 text-danger -mr-2"
                            onPress={() => handleDeleteDocument(item._id)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-foreground-400">
                          {new Date(
                            item.updatedAt || item.createdAt || ""
                          ).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-default-200/50 rounded text-foreground-500 capitalize">
                          {t(`documents.visibility.${item.visibility}`)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );

  return (
    <>
      {hydrated ? (
        isCollapsed ? (
          collapsedView
        ) : (
          expandedView
        )
      ) : (
        <div className="h-full w-full" aria-hidden="true" />
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {t("documents.modal.title")}
              </ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  label={t("documents.modal.placeholder")}
                  placeholder={t("documents.modal.placeholder")}
                  variant="bordered"
                  value={newDocTitle}
                  onValueChange={setNewDocTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateDocument();
                  }}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  {t("documents.modal.cancel")}
                </Button>
                <Button
                  color="primary"
                  onPress={handleCreateDocument}
                  isLoading={creating}
                  isDisabled={!newDocTitle.trim()}
                >
                  {creating
                    ? t("documents.modal.creating")
                    : t("documents.modal.create")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default Document;
