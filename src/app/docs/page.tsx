"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import useDocumentStore from "@/store/useDocumentStore";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import {
  PlusIcon,
  DocumentTextIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  GlobeAltIcon,
  LockClosedIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

export default function DocumentsListPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const {
    documents,
    loading,
    creating,
    loadDocuments,
    createDocument,
    deleteDocument,
  } = useDocumentStore();

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [newDocTitle, setNewDocTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, []);

  const handleCreateDocument = async (onClose: () => void) => {
    if (!newDocTitle.trim()) return;

    const newDoc = await createDocument({
      title: newDocTitle.trim(),
      visibility: "private",
    });

    if (newDoc) {
      onClose();
      setNewDocTitle("");
      router.push(`/docs/${newDoc._id}`);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    await deleteDocument(docId);
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 gap-4">
        <Spinner size="lg" color="primary" />
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">
          Loading your library...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Documents
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage and collaborate on your ideas
            </p>
          </div>
          <Button
            onPress={onOpen}
            color="primary"
            size="lg"
            startContent={<PlusIcon className="w-5 h-5" />}
            className="shadow-lg shadow-blue-500/30 font-medium"
          >
            New Document
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="sticky top-4 z-10 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md py-2">
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
            }
            size="lg"
            classNames={{
              inputWrapper: "bg-white dark:bg-gray-900 shadow-sm",
            }}
            isClearable
            onClear={() => setSearchQuery("")}
          />
        </div>

        {/* Documents Grid */}
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <DocumentTextIcon className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery ? "No documents found" : "No documents yet"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
              {searchQuery
                ? `We couldn't find any documents matching "${searchQuery}"`
                : "Create your first document to start writing and collaborating with your team."}
            </p>
            {!searchQuery && (
              <Button onPress={onOpen} color="primary" variant="flat">
                Create Document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc._id}
                isPressable
                onPress={() => router.push(`/docs/${doc._id}`)}
                className="group hover:scale-[1.02] transition-transform duration-200 border border-transparent hover:border-blue-500/30 dark:bg-gray-900"
              >
                <CardHeader className="flex justify-between items-start px-4 pt-4 pb-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 mb-2">
                    <DocumentTextIcon className="w-6 h-6" />
                  </div>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={
                      doc.visibility === "private"
                        ? "default"
                        : doc.visibility === "shared"
                        ? "secondary"
                        : "success"
                    }
                    startContent={
                      doc.visibility === "private" ? (
                        <LockClosedIcon className="w-3 h-3" />
                      ) : doc.visibility === "shared" ? (
                        <UserGroupIcon className="w-3 h-3" />
                      ) : (
                        <GlobeAltIcon className="w-3 h-3" />
                      )
                    }
                    className="capitalize"
                  >
                    {doc.visibility}
                  </Chip>
                </CardHeader>

                <CardBody className="px-4 py-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 min-h-[2.5em]">
                    {doc.plainText || "No preview available..."}
                  </p>
                </CardBody>

                <CardFooter className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <ClockIcon className="w-3 h-3" />
                    {new Date(
                      doc.updatedAt || doc.createdAt || ""
                    ).toLocaleDateString()}
                  </div>

                  {doc.ownerId === currentUser?._id && (
                    <Button
                      isIconOnly
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={(e) => {
                        // e.stopPropagation(); // Card isPressable handles click, need to stop propagation?
                        // HeroUI Card isPressable might conflict, but let's try standard button behavior
                        // Actually, onPress on Button should capture it.
                        handleDeleteDocument(doc._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Document Modal */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="center"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Create New Document
              </ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  label="Document Title"
                  placeholder="Enter a title for your document"
                  variant="bordered"
                  value={newDocTitle}
                  onValueChange={setNewDocTitle}
                  startContent={
                    <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                  }
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={() => handleCreateDocument(onClose)}
                  isLoading={creating}
                  isDisabled={!newDocTitle.trim()}
                >
                  Create
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
