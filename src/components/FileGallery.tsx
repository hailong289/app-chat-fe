import { FilePreview } from "@/store/types/message.state";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Progress,
} from "@heroui/react";
import { useState } from "react";
import {
  PlayCircleIcon,
  DocumentIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/solid";

interface FileGalleryProps {
  files: FilePreview[];
  className?: string;
}

export const FileGallery = ({ files, className = "" }: FileGalleryProps) => {
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);

  const handleFileClick = (file: FilePreview) => {
    setSelectedFile(file);
  };

  const handleClose = () => {
    setSelectedFile(null);
  };

  const renderThumbnail = (file: FilePreview) => {
    const isUploading = file.status === "uploading";
    const isFailed = file.status === "failed";

    return (
      <div
        key={file._id}
        className={`relative cursor-pointer rounded-lg overflow-hidden aspect-square ${
          isUploading ? "opacity-70" : ""
        }`}
        onClick={() => !isUploading && handleFileClick(file)}
      >
        {/* Thumbnail based on file type */}
        {file.kind === "photo" && (
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        )}

        {file.kind === "video" && (
          <div className="relative w-full h-full">
            <video
              src={file.url}
              className="w-full h-full object-cover"
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <PlayCircleIcon className="w-12 h-12 text-white" />
            </div>
          </div>
        )}

        {file.kind === "audio" && (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <MusicalNoteIcon className="w-12 h-12 text-white" />
          </div>
        )}

        {file.kind === "file" && (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex flex-col items-center justify-center p-2">
            <DocumentIcon className="w-12 h-12 text-white mb-2" />
            <p className="text-xs text-white text-center truncate w-full px-2">
              {file.name}
            </p>
          </div>
        )}

        {/* Upload Progress Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
            <div className="w-4/5">
              <Progress
                size="sm"
                value={file.uploadProgress || 0}
                color="primary"
                className="mb-2"
              />
              <p className="text-xs text-white text-center">
                {file.uploadProgress || 0}%
              </p>
            </div>
          </div>
        )}

        {/* Failed Overlay */}
        {isFailed && (
          <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center">
            <p className="text-xs text-white font-semibold">Upload Failed</p>
          </div>
        )}

        {/* File Size Badge */}
        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {formatFileSize(file.size)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Gallery Grid */}
      <div className={`grid grid-cols-3 gap-2 ${className}`}>
        {files.map((file) => renderThumbnail(file))}
      </div>

      {/* Modal for full view */}
      <Modal
        isOpen={!!selectedFile}
        onClose={handleClose}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold truncate">
              {selectedFile?.name}
            </h3>
            <p className="text-sm text-gray-500">
              {selectedFile && formatFileSize(selectedFile.size)} •{" "}
              {selectedFile?.mimeType}
            </p>
          </ModalHeader>
          <ModalBody className="pb-6">
            {selectedFile && (
              <div className="w-full">
                {/* Upload Progress in Modal */}
                {selectedFile.status === "uploading" && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">
                        Uploading...
                      </span>
                      <span className="text-sm text-blue-700">
                        {selectedFile.uploadProgress || 0}%
                      </span>
                    </div>
                    <Progress
                      value={selectedFile.uploadProgress || 0}
                      color="primary"
                      size="md"
                    />
                  </div>
                )}

                {/* Failed Status in Modal */}
                {selectedFile.status === "failed" && (
                  <div className="mb-4 p-4 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-red-900">
                      ❌ Upload failed. Please try again.
                    </p>
                  </div>
                )}

                {/* File Preview */}
                {selectedFile.kind === "photo" && (
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.name}
                    className="w-full h-auto rounded-lg"
                  />
                )}

                {selectedFile.kind === "video" && (
                  <video
                    src={selectedFile.url}
                    controls
                    className="w-full h-auto rounded-lg"
                  >
                    <track kind="captions" />
                  </video>
                )}

                {selectedFile.kind === "audio" && (
                  <div className="p-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                    <audio src={selectedFile.url} controls className="w-full">
                      <track kind="captions" />
                    </audio>
                  </div>
                )}

                {selectedFile.kind === "file" && (
                  <div className="p-8 bg-gray-100 rounded-lg text-center">
                    <DocumentIcon className="w-20 h-20 mx-auto text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600 mb-4">
                      This file type cannot be previewed
                    </p>
                    {selectedFile.status === "uploaded" && (
                      <a
                        href={selectedFile.uploadedUrl || selectedFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600"
                      >
                        Download File
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

// Helper function
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
