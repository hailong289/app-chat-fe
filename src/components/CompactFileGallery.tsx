import { FilePreview } from "@/store/types/message.state";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Progress,
  Button,
  Image,
} from "@heroui/react";
import { useState } from "react";
import {
  PlayCircleIcon,
  DocumentIcon,
  MusicalNoteIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/solid";

// Helper: Normalize kind value (backend có thể trả "image" hoặc "photo")
const normalizeKind = (file: FilePreview): string => {
  const kind = file.kind?.toLowerCase() || "";
  const mimeType = file.mimeType?.toLowerCase() || "";

  // Check mimeType first (more reliable)
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  // Fallback to kind, normalize "image" → "photo"
  if (kind === "image" || kind === "photo") return "photo";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";

  return "file";
};

interface CompactFileGalleryProps {
  files: FilePreview[];
  maxDisplay?: number; // Số file hiển thị tối đa, còn lại show "+N"
  className?: string;
}

export const CompactFileGallery = ({
  files,
  maxDisplay = 4,
  className = "",
}: CompactFileGalleryProps) => {
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);
  const [showAll, setShowAll] = useState(false);

  const displayFiles = showAll ? files : files.slice(0, maxDisplay);
  const remainingCount = files.length - maxDisplay;

  const handleFileClick = (file: FilePreview) => {
    // Không mở modal nếu đang upload
    if (file.status === "uploading") return;
    setSelectedFile(file);
  };

  const handleClose = () => {
    setSelectedFile(null);
  };

  const renderCompactThumbnail = (file: FilePreview, index: number) => {
    const isUploading = file.status === "uploading";
    const isFailed = file.status === "failed";
    const isLast = index === maxDisplay - 1 && remainingCount > 0 && !showAll;
    const fileKind = normalizeKind(file); // Normalize kind value

    return (
      <button
        key={file._id}
        type="button"
        aria-label={
          isLast
            ? `Show ${remainingCount} more files`
            : `Open file ${file.name}`
        }
        className={`relative cursor-pointer rounded-lg overflow-hidden  border ${
          isFailed ? "border-red-500" : "border-gray-300"
        } ${isUploading ? "opacity-70" : ""}`}
        style={{ aspectRatio: "1/1" }}
        onClick={() => (isLast ? setShowAll(true) : handleFileClick(file))}
      >
        {/* Show "+N more" overlay for last item */}
        {isLast && (
          <div className="absolute bg-gray-800 inset-0  flex items-center justify-center z-10">
            <p className="text-white text-lg font-bold">+{remainingCount}</p>
          </div>
        )}

        {/* Thumbnail */}
        {fileKind === "photo" && (
          <Image
            src={file.url}
            alt={file.name}
            isZoomed
            className="w-full h-full object-cover"
          />
        )}

        {fileKind === "video" && (
          <div className="relative w-full h-full bg-black">
            <video
              src={file.url}
              className="w-full h-full object-cover"
              preload="metadata"
            >
              <track kind="captions" />
            </video>

            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <PlayCircleIcon className="w-8 h-8 text-white" />
            </div>
          </div>
        )}

        {fileKind === "audio" && (
          <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
            <MusicalNoteIcon className="w-8 h-8 text-white" />
          </div>
        )}

        {fileKind === "file" && (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
            <DocumentIcon className="w-8 h-8 text-white" />
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2">
            <Progress
              size="sm"
              value={file.uploadProgress || 0}
              color="primary"
              className="w-full mb-1"
            />
            <p className="text-xs text-white">{file.uploadProgress || 0}%</p>
          </div>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Compact Gallery Grid */}
      <div className={`grid gap-1 ${className}`}>
        {files.length === 1 && (
          <div className="grid grid-cols-1">
            {displayFiles.map((file, idx) => renderCompactThumbnail(file, idx))}
          </div>
        )}
        {files.length === 2 && (
          <div className="grid gap-1 grid-cols-2">
            {displayFiles.map((file, idx) => renderCompactThumbnail(file, idx))}
          </div>
        )}
        {files.length === 3 && (
          <div className="grid gap-1  grid-cols-2 grid-rows-2">
            <div className="row-span-2">
              {renderCompactThumbnail(displayFiles[0], 0)}
            </div>
            <div>{renderCompactThumbnail(displayFiles[1], 1)}</div>
            <div>{renderCompactThumbnail(displayFiles[2], 2)}</div>
          </div>
        )}
        {files.length >= 4 && (
          <div className="grid grid-cols-2 gap-1">
            {displayFiles.map((file, idx) => renderCompactThumbnail(file, idx))}
          </div>
        )}
      </div>

      {/* Modal for full view */}
      <Modal
        isOpen={!!selectedFile}
        onClose={handleClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center justify-between border-b">
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-base font-semibold truncate">
                    {selectedFile?.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedFile && formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="p-0 w-full h-full">
                {selectedFile && (
                  <div className="w-full">
                    {/* Upload Progress */}
                    {selectedFile.status === "uploading" && (
                      <div className="p-4 bg-blue-50 border-b">
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
                          size="sm"
                        />
                      </div>
                    )}

                    {/* Failed Status */}
                    {selectedFile.status === "failed" && (
                      <div className="p-4 bg-red-50 border-b">
                        <p className="text-sm font-medium text-red-900">
                          ❌ Upload failed
                        </p>
                      </div>
                    )}

                    {/* File Content */}
                    <div className="p-4">
                      {normalizeKind(selectedFile) === "photo" && (
                        <img
                          src={selectedFile.url}
                          alt={selectedFile.name}
                          className="w-full h-auto rounded-lg"
                        />
                      )}

                      {normalizeKind(selectedFile) === "video" && (
                        <video
                          src={selectedFile.url}
                          controls
                          className="w-full h-auto rounded-lg bg-black"
                        >
                          <track kind="captions" />
                        </video>
                      )}

                      {normalizeKind(selectedFile) === "audio" && (
                        <div className="space-y-4">
                          <div className="p-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                            <MusicalNoteIcon className="w-20 h-20 text-white" />
                          </div>
                          <audio
                            src={selectedFile.url}
                            controls
                            className="w-full"
                          >
                            <track kind="captions" />
                          </audio>
                        </div>
                      )}

                      {normalizeKind(selectedFile) === "file" && (
                        <div className="text-center py-12">
                          <DocumentIcon className="w-20 h-20 mx-auto text-gray-400 mb-4" />
                          <p className="text-sm text-gray-600 mb-6">
                            Preview not available
                          </p>
                          {selectedFile.status === "uploaded" && (
                            <Button
                              color="primary"
                              startContent={
                                <ArrowDownTrayIcon className="w-5 h-5" />
                              }
                              onPress={() => {
                                const link = document.createElement("a");
                                link.href =
                                  selectedFile.uploadedUrl || selectedFile.url;
                                link.download = selectedFile.name;
                                link.click();
                              }}
                            >
                              Download
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </ModalBody>
            </>
          )}
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
