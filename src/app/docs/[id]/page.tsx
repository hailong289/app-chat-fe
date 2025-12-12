"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useDocSocket } from "@/hooks/useDocSocket";
import { useDocumentSync } from "@/hooks/useDocumentSync";
import useAuthStore from "@/store/useAuthStore";
import useDocumentStore from "@/store/useDocumentStore";
import { DynamicEditor } from "@/components/docs/DynamicEditor";
import { Doc } from "yjs";
import useToast from "@/hooks/useToast";
import ShareModal from "@/components/docs/ShareModal";
import {
  Avatar,
  AvatarGroup,
  Button,
  Card,
  CardBody,
  Chip,
  Skeleton,
  Tooltip,
  Navbar,
  NavbarContent,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  ArrowLeftIcon,
  ShareIcon,
  UserGroupIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

import { useTranslation } from "react-i18next";

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const docId = params?.id as string;
  const { socket, status } = useDocSocket();
  const currentUser = useAuthStore((s) => s.user);
  const { updateTitle, deleteDocument, duplicateDocument } = useDocumentStore();
  const toast = useToast();

  // Editor instance
  const [editor, setEditor] = useState<any>(null);

  // Create Y.Doc instance (stable reference)
  const [ydoc] = useState(() => new Doc());

  // Use centralized document sync hook
  const { document, setDocument, usersPresence, provider, isSnapshotApplied } =
    useDocumentSync({
      docId,
      socket,
      ydoc,
      enabled: status === "connected" && !!currentUser,
    });

  const activeUsers = Array.from(usersPresence.values());
  const isOnline = status === "connected";

  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Delete Modal State
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onOpenChange: onDeleteOpenChange,
  } = useDisclosure();

  // Share Modal State
  const {
    isOpen: isShareOpen,
    onOpen: onShareOpen,
    onClose: onShareClose,
  } = useDisclosure();

  useEffect(() => {
    if (document) {
      setTitleInput(document.title);
    }
  }, [document]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  const handleTitleSave = async () => {
    if (!titleInput.trim() || titleInput === document?.title) {
      setIsEditingTitle(false);
      setTitleInput(document?.title || "");
      return;
    }

    try {
      const updatedDoc = await updateTitle(docId, titleInput);
      if (updatedDoc) {
        setDocument((prev) =>
          prev ? { ...prev, title: updatedDoc.title } : null
        );
        toast.success(t("docs.renameSuccess"));
      } else {
        throw new Error("Failed to update title");
      }
    } catch (error) {
      console.error("Failed to rename document:", error);
      toast.error(t("docs.renameError"));
      setTitleInput(document?.title || "");
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
      setTitleInput(document?.title || "");
    }
  };

  const handleShare = () => {
    onShareOpen();
  };

  const handleDelete = async () => {
    try {
      await deleteDocument(docId);
      toast.success(t("docs.deleteSuccess"));
      router.push("/docs");
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error(t("docs.deleteError"));
    }
  };

  const handleExportPDF = () => {
    globalThis.print();
  };

  const handleMakeCopy = async () => {
    if (!document) return;
    try {
      const newDoc = await duplicateDocument(docId);
      if (newDoc) {
        toast.success(t("docs.copySuccess"));
        // Optionally redirect to the new document
        // router.push(`/docs/${newDoc._id}`);
      } else {
        throw new Error("Failed to copy document");
      }
    } catch (error) {
      console.error("Failed to copy document:", error);
      toast.error(t("docs.copyError"));
    }
  };

  // Edit Handlers
  const handleUndo = () => {
    if (editor) {
      console.log("Executing Undo", editor);
      editor.focus();
      editor.undo();
    }
  };

  const handleRedo = () => {
    if (editor) {
      console.log("Executing Redo", editor);
      editor.focus();
      editor.redo();
    }
  };

  const handleCut = () => {
    if (editor) {
      // Focus the editor first
      editor.focus();
      // Use window.document.execCommand for cut (legacy but widely supported for this use case)
      globalThis.document.execCommand("cut");
    }
  };

  const handleCopy = () => {
    if (editor) {
      editor.focus();
      globalThis.document.execCommand("copy");
    }
  };

  const handlePaste = async () => {
    if (editor) {
      editor.focus();
      try {
        const text = await navigator.clipboard.readText();
        // Insert text at current selection
        editor.insertBlocks(
          [{ content: text }],
          editor.getTextCursorPosition().block,
          "after"
        );
      } catch (err) {
        console.error("Failed to read clipboard", err);
        toast.error(t("docs.pasteError") || "Please use Ctrl+V to paste");
      }
    }
  };

  if (!document || !isSnapshotApplied) {
    return (
      <div className="h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-950">
        <Navbar
          isBordered
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md"
        >
          <NavbarContent justify="start">
            <Skeleton className="rounded-lg w-8 h-8" />
            <div className="ml-4 space-y-2">
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-3 w-24 rounded-lg" />
            </div>
          </NavbarContent>
        </Navbar>
        <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
          <Card className="h-full min-h-[600px] w-full">
            <CardBody className="p-12 space-y-4">
              <Skeleton className="h-8 w-3/4 rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-2/3 rounded-lg" />
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header / Navbar */}
      <Navbar
        isBordered
        maxWidth="full"
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md h-16"
      >
        <NavbarContent justify="start" className="gap-4">
          <Button
            isIconOnly
            variant="light"
            onPress={() => router.push("/docs")}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 h-8">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleKeyDown}
                  className="text-lg font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none text-gray-900 dark:text-white min-w-[200px]"
                />
              ) : (
                <button
                  type="button"
                  aria-label={t("docs.editTitle")}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded transition-colors bg-transparent border-none focus:outline-none"
                  onClick={() => setIsEditingTitle(true)}
                >
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-md select-none">
                    {document.title}
                  </h1>
                  <PencilIcon className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                </button>
              )}

              <Chip
                size="sm"
                variant="dot"
                color={isOnline ? "success" : "warning"}
                className="border-none gap-1 px-0"
                classNames={{
                  base: "bg-transparent",
                  content:
                    "font-medium text-xs text-gray-500 dark:text-gray-400",
                  dot: isOnline ? "bg-green-500" : "bg-yellow-500",
                }}
              >
                {isOnline ? t("docs.status.saved") : t("docs.status.offline")}
              </Chip>
            </div>

            {/* Menu Bar */}
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="light"
                    className="h-6 px-2 min-w-0 text-xs data-[hover=true]:bg-gray-100 dark:data-[hover=true]:bg-gray-800"
                  >
                    {t("docs.menu.file.title")}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="File actions">
                  <DropdownItem
                    key="new"
                    startContent={<DocumentDuplicateIcon className="w-4 h-4" />}
                    onPress={handleMakeCopy}
                  >
                    {t("docs.menu.file.copy")}
                  </DropdownItem>
                  <DropdownItem
                    key="export"
                    startContent={<ArrowDownTrayIcon className="w-4 h-4" />}
                    onPress={handleExportPDF}
                  >
                    {t("docs.menu.file.download")}
                  </DropdownItem>
                  <DropdownItem
                    key="print"
                    startContent={<PrinterIcon className="w-4 h-4" />}
                    onPress={() => globalThis.print()}
                  >
                    {t("docs.menu.file.print")}
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    className="text-danger"
                    color="danger"
                    startContent={<TrashIcon className="w-4 h-4" />}
                    onPress={onDeleteOpen}
                  >
                    {t("docs.menu.file.delete")}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>

              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="light"
                    className="h-6 px-2 min-w-0 text-xs data-[hover=true]:bg-gray-100 dark:data-[hover=true]:bg-gray-800"
                  >
                    {t("docs.menu.edit.title")}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Edit actions">
                  <DropdownItem key="undo" shortcut="⌘Z" onPress={handleUndo}>
                    {t("docs.menu.edit.undo")}
                  </DropdownItem>
                  <DropdownItem key="redo" shortcut="⌘⇧Z" onPress={handleRedo}>
                    {t("docs.menu.edit.redo")}
                  </DropdownItem>
                  <DropdownItem key="cut" shortcut="⌘X" onPress={handleCut}>
                    {t("docs.menu.edit.cut")}
                  </DropdownItem>
                  <DropdownItem key="copy" shortcut="⌘C" onPress={handleCopy}>
                    {t("docs.menu.edit.copy")}
                  </DropdownItem>
                  <DropdownItem key="paste" shortcut="⌘V" onPress={handlePaste}>
                    {t("docs.menu.edit.paste")}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>

              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="light"
                    className="h-6 px-2 min-w-0 text-xs data-[hover=true]:bg-gray-100 dark:data-[hover=true]:bg-gray-800"
                  >
                    {t("docs.menu.view.title")}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="View actions">
                  <DropdownItem key="mode">
                    {t("docs.menu.view.mode")}
                  </DropdownItem>
                  <DropdownItem key="sidebar">
                    {t("docs.menu.view.outline")}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>

              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="light"
                    className="h-6 px-2 min-w-0 text-xs data-[hover=true]:bg-gray-100 dark:data-[hover=true]:bg-gray-800"
                  >
                    {t("docs.menu.help.title")}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Help actions">
                  <DropdownItem key="shortcuts">
                    {t("docs.menu.help.shortcuts")}
                  </DropdownItem>
                  <DropdownItem key="support">
                    {t("docs.menu.help.support")}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>
        </NavbarContent>

        <NavbarContent justify="end" className="gap-2 sm:gap-4">
          {/* Active Users Avatar Group */}
          <div className="hidden sm:flex items-center">
            <AvatarGroup
              max={4}
              total={activeUsers.length > 4 ? activeUsers.length : undefined}
              size="sm"
              isBordered
            >
              {/* Current User */}
              <Tooltip content={`${t("docs.you")} (${currentUser?.fullname})`}>
                <Avatar
                  src={currentUser?.avatar}
                  name={currentUser?.fullname?.[0]}
                  className="ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-blue-500"
                  color="primary"
                />
              </Tooltip>

              {/* Other Users */}
              {activeUsers.map((user) => (
                <Tooltip
                  key={user.userId}
                  content={
                    <div className="px-1 py-2">
                      <div className="font-bold text-small">
                        {user.fullname}
                      </div>
                      {user.isTyping && (
                        <div className="text-tiny text-default-500">
                          {t("docs.typing")}
                        </div>
                      )}
                    </div>
                  }
                >
                  <Avatar
                    src={user.avatar}
                    name={user.fullname?.[0]}
                    style={{
                      backgroundColor: user.color || "#ccc",
                    }}
                    className={
                      user.isTyping ? "animate-pulse ring-2 ring-blue-400" : ""
                    }
                  />
                </Tooltip>
              ))}
            </AvatarGroup>
          </div>

          {/* Mobile User Count */}
          <div className="sm:hidden flex items-center gap-1 text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full text-xs font-medium">
            <UserGroupIcon className="w-4 h-4" />
            {activeUsers.length + 1}
          </div>

          <Button
            color="primary"
            variant="solid"
            size="sm"
            className="font-medium shadow-lg shadow-blue-500/20"
            startContent={<ShareIcon className="w-4 h-4" />}
            onPress={handleShare}
          >
            {t("docs.share")}
          </Button>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button isIconOnly variant="light" size="sm">
                <EllipsisHorizontalIcon className="w-6 h-6 text-gray-500" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Document actions">
              <DropdownItem
                key="export"
                startContent={<ArrowDownTrayIcon className="w-4 h-4" />}
                onPress={handleExportPDF}
              >
                {t("docs.actions.export")}
              </DropdownItem>
              <DropdownItem
                key="copy"
                startContent={<DocumentDuplicateIcon className="w-4 h-4" />}
                onPress={handleMakeCopy}
              >
                {t("docs.menu.file.copy")}
              </DropdownItem>
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                startContent={<TrashIcon className="w-4 h-4" />}
                onPress={onDeleteOpen}
              >
                {t("docs.actions.delete")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
      </Navbar>

      {/* Main Editor Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <Card className="min-h-[calc(100vh-8rem)] shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardBody className="p-0">
            <div className="editor-wrapper h-full min-h-[500px] p-4 sm:p-8 lg:p-12">
              <DynamicEditor
                key={`${document._id}-${provider ? "online" : "offline"}`}
                onEditorReady={setEditor}
                ydoc={ydoc}
                provider={provider}
                userName={currentUser?.fullname || "Anonymous"}
                userColor={
                  activeUsers.find((u) => u.userId === currentUser?._id)
                    ?.color || "#0066ff"
                }
                userAvatar={currentUser?.avatar}
              />
            </div>
          </CardBody>
        </Card>
      </main>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {t("docs.deleteModal.title")}
              </ModalHeader>
              <ModalBody>
                <p>
                  {t("docs.deleteModal.content", { title: document.title })}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button color="danger" onPress={handleDelete}>
                  {t("common.delete")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Share Modal */}
      {document && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={onShareClose}
          document={document as any}
          onUpdate={(updatedDoc) => setDocument(updatedDoc as any)}
        />
      )}
    </div>
  );
}
