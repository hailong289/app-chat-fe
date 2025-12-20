import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Listbox,
  ListboxItem,
  Chip,
} from "@heroui/react";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import documentService, { Document } from "@/service/document.service";
import { DocumentIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { useTranslation as useNextTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (doc: Document) => void;
  roomId?: string;
}

export const DocumentPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  roomId,
}: Props) => {
  const { t, i18n } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      setSelectedDocId(null);
      setSearchTerm("");
    }
  }, [isOpen]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      // Fetch all documents or filter by room if needed.
      // For now, let's fetch all user documents to allow sharing across rooms.
      const docs = await documentService.getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  const handleConfirm = () => {
    const doc = documents.find((d) => d._id === selectedDocId);
    if (doc) {
      onSelect(doc);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {t("documents.select_document", "Select Document")}
        </ModalHeader>
        <ModalBody>
          <Input
            placeholder={t("common.search", "Search...")}
            startContent={
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
            }
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="mb-4"
          />

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t("documents.no_documents", "No documents found")}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredDocs.map((doc) => (
                <div
                  key={doc._id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-3 ${
                    selectedDocId === doc._id
                      ? "border-primary bg-primary/10"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => setSelectedDocId(doc._id)}
                >
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <DocumentIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {doc.title || "Untitled"}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        {doc.updatedAt &&
                          formatDistanceToNow(new Date(doc.updatedAt), {
                            addSuffix: true,
                            locale: i18n.language === "vi" ? vi : enUS,
                          })}
                      </span>
                      {doc.roomIds && doc.roomIds.length > 0 && (
                        <Chip
                          size="sm"
                          variant="flat"
                          color="secondary"
                          className="h-5 text-[10px]"
                        >
                          Room
                        </Chip>
                      )}
                    </div>
                  </div>
                  {selectedDocId === doc._id && (
                    <div className="w-4 h-4 rounded-full bg-primary border-2 border-white dark:border-gray-900" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            color="primary"
            onPress={handleConfirm}
            isDisabled={!selectedDocId}
          >
            {t("common.send", "Send")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
