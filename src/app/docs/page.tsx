"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useDocumentStore from "@/store/useDocumentStore";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  CardBody,
  Input,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import {
  DocumentPlusIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

export default function DocsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    documents,
    loading,
    loadDocuments,
    createDocument,
    deleteDocument,
    duplicateDocument,
  } = useDocumentStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const newDoc = await createDocument({
        title: t("docs.untitled") || "Untitled Document",
        visibility: "private",
      });
      if (newDoc) {
        router.push(`/docs/${newDoc._id}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        t("docs.confirmDelete") ||
          "Are you sure you want to delete this document?"
      )
    ) {
      await deleteDocument(id);
    }
  };

  const handleDuplicate = async (id: string) => {
    await duplicateDocument(id);
  };

  // Hydration fix: only render content after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("documents.title") || "Documents"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t("documents.subtitle") ||
                "Manage your documents and collaborate with others."}
            </p>
          </div>
          <Button
            color="primary"
            startContent={<DocumentPlusIcon className="w-5 h-5" />}
            onPress={handleCreate}
            isLoading={isCreating}
          >
            {t("docs.newDoc") || "New Document"}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Input
            placeholder={t("common.search") || "Search..."}
            startContent={
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
            }
            value={searchQuery}
            onValueChange={setSearchQuery}
            variant="bordered"
            classNames={{
              inputWrapper: "bg-white dark:bg-gray-900",
            }}
          />
        </div>

        {/* Document Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery
              ? t("common.noResults") || "No results found"
              : t("docs.noDocs") || "No documents yet"}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc._id}
                className="border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => router.push(`/docs/${doc._id}`)}
              >
                <CardBody className="p-6 h-40 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <DocumentTextIcon className="w-8 h-8 text-blue-500" />
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly variant="light" size="sm">
                            <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Document actions">
                          <DropdownItem
                            key="duplicate"
                            startContent={
                              <DocumentDuplicateIcon className="w-4 h-4" />
                            }
                            onPress={() => handleDuplicate(doc._id)}
                          >
                            {t("common.duplicate") || "Duplicate"}
                          </DropdownItem>
                          <DropdownItem
                            key="delete"
                            className="text-danger"
                            color="danger"
                            startContent={<TrashIcon className="w-4 h-4" />}
                            onPress={() => handleDelete(doc._id)}
                          >
                            {t("common.delete") || "Delete"}
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-gray-900 dark:text-white truncate"
                      title={doc.title}
                    >
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {doc.updatedAt &&
                        formatDistanceToNow(new Date(doc.updatedAt), {
                          addSuffix: true,
                        })}
                    </p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
