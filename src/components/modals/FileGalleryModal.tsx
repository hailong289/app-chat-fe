"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Tabs,
  Tab,
  Image,
  Spinner,
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import UploadService from "@/service/uploadfile.service";
import {
  MagnifyingGlassIcon,
  DocumentIcon,
  PhotoIcon,
  LinkIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";

interface FileGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (files: any[]) => void;
  roomId?: string;
  userId?: string;
}

export default function FileGalleryModal({
  isOpen,
  onClose,
  onSelect,
  roomId,
  userId,
}: FileGalleryModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("media");
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchFiles = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const currentPage = reset ? 1 : page;
        const res = await UploadService.getAttachments({
          roomId,
          userId,
          type: activeTab,
          page: currentPage,
          limit: 20,
        });

        // Check if res.data is the array or res.data.metadata is the array
        // Based on typical response format: { metadata: [...] }
        const data = res.data as any;
        const newFiles = Array.isArray(data)
          ? data
          : data && Array.isArray(data.metadata)
          ? data.metadata
          : [];

        if (reset) {
          setFiles(newFiles);
          setPage(2);
        } else {
          setFiles((prev) => [...prev, ...newFiles]);
          setPage((prev) => prev + 1);
        }
        setHasMore(newFiles.length === 20);
      } catch (error) {
        console.error("Failed to fetch files", error);
      } finally {
        setLoading(false);
      }
    },
    [roomId, userId, activeTab, page, loading]
  );

  useEffect(() => {
    if (isOpen) {
      fetchFiles(true);
      setSelectedFiles([]);
    }
  }, [isOpen, activeTab]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !loading) {
      fetchFiles();
    }
  };

  const toggleSelection = (file: any) => {
    setSelectedFiles((prev) => {
      const exists = prev.find((f) => f._id === file._id);
      if (exists) {
        return prev.filter((f) => f._id !== file._id);
      }
      return [...prev, file];
    });
  };

  const handleConfirm = () => {
    onSelect(selectedFiles);
    onClose();
  };

  const renderFileItem = (file: any) => {
    const isSelected = selectedFiles.some((f) => f._id === file._id);

    return (
      <button
        type="button"
        key={file._id}
        className={`relative group cursor-pointer border rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary ${
          isSelected
            ? "border-primary ring-2 ring-primary"
            : "border-default-200"
        }`}
        onClick={() => toggleSelection(file)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSelection(file);
          }
        }}
        tabIndex={0}
        aria-pressed={isSelected}
        role="button"
      >
        <div className="aspect-square bg-default-100 flex items-center justify-center overflow-hidden">
          {file.kind === "image" ? (
            <Image
              src={file.url}
              alt={file.name}
              className="object-cover w-full h-full"
              radius="none"
            />
          ) : file.kind === "video" ? (
            <VideoCameraIcon className="w-12 h-12 text-default-400" />
          ) : file.kind === "link" ? (
            <div className="p-2 text-center">
              <LinkIcon className="w-8 h-8 mx-auto text-primary mb-1" />
              <p className="text-xs line-clamp-2 text-default-500">
                {file.name}
              </p>
            </div>
          ) : (
            <DocumentIcon className="w-12 h-12 text-default-400" />
          )}

          {/* Selection Overlay */}
          <div
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                isSelected ? "bg-primary border-primary" : "border-white"
              }`}
            >
              {isSelected && <span className="text-white text-xs">✓</span>}
            </div>
          </div>
        </div>
        <div className="p-2 bg-content1">
          <p className="text-xs font-medium truncate" title={file.name}>
            {file.name || "Untitled"}
          </p>
          <p className="text-[10px] text-default-400">
            {format(new Date(file.createdAt || Date.now()), "dd/MM/yyyy")}
          </p>
        </div>
      </button>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {t("File Gallery")}
        </ModalHeader>
        <ModalBody className="p-0 overflow-hidden flex flex-col h-[600px]">
          <div className="px-6 pt-2">
            <Tabs
              aria-label="File types"
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              color="primary"
              variant="underlined"
              classNames={{
                tabList:
                  "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                cursor: "w-full bg-primary",
                tab: "max-w-fit px-0 h-12",
                tabContent: "group-data-[selected=true]:text-primary",
              }}
            >
              <Tab
                key="media"
                title={
                  <div className="flex items-center space-x-2">
                    <PhotoIcon className="w-4 h-4" />
                    <span>Media</span>
                  </div>
                }
              />
              <Tab
                key="doc"
                title={
                  <div className="flex items-center space-x-2">
                    <DocumentIcon className="w-4 h-4" />
                    <span>Documents</span>
                  </div>
                }
              />
              <Tab
                key="link"
                title={
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="w-4 h-4" />
                    <span>Links</span>
                  </div>
                }
              />
            </Tabs>
          </div>

          <div
            className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
            onScroll={handleScroll}
          >
            {files.map(renderFileItem)}
            {loading && (
              <div className="col-span-full flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}
            {!loading && files.length === 0 && (
              <div className="col-span-full text-center text-default-400 py-10">
                {t("No files found")}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="border-t border-divider">
          <div className="flex-1 text-sm text-default-500">
            {selectedFiles.length} {t("selected")}
          </div>
          <Button variant="light" onPress={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="primary"
            onPress={handleConfirm}
            isDisabled={selectedFiles.length === 0}
          >
            {t("Send")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
