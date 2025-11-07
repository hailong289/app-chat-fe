"use client";
import { Card, CardBody, Image, Skeleton } from "@heroui/react";
import { useEffect, useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

interface LinkPreviewProps {
  url: string;
  isMine?: boolean;
}

export const LinkPreview = ({ url, isMine = false }: LinkPreviewProps) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(false);

        // Gọi API để lấy metadata của link
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch preview");
        }

        const data = await response.json();
        setPreview(data);
      } catch (err) {
        console.error("Error fetching link preview:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchPreview();
    }
  }, [url]);

  if (loading) {
    return (
      <Card
        className={`max-w-sm mt-2 ${isMine ? "bg-blue-400/20" : "bg-gray-100"}`}
        shadow="sm"
      >
        <CardBody className="p-0">
          <Skeleton className="w-full h-32" />
          <div className="p-3 space-y-2">
            <Skeleton className="w-3/4 h-4 rounded-lg" />
            <Skeleton className="w-full h-3 rounded-lg" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error || !preview) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`
          flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border
          ${
            isMine
              ? "bg-blue-400/20 border-blue-400/30 text-white hover:bg-blue-400/30"
              : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
          }
          transition-colors duration-200
        `}
      >
        <GlobeAltIcon className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs truncate">{url}</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 max-w-sm"
    >
      <Card
        className={`
          overflow-hidden transition-all duration-200 hover:scale-[1.02]
          ${
            isMine
              ? "bg-blue-400/10 border-blue-400/30"
              : "bg-white border-gray-200"
          }
        `}
        shadow="sm"
        isPressable
      >
        <CardBody className="p-0">
          {/* Preview Image */}
          {preview.image && (
            <div className="relative w-full h-40 bg-gray-100 overflow-hidden">
              <Image
                src={preview.image}
                alt={preview.title || "Link preview"}
                className="w-full h-full object-cover"
                removeWrapper
              />
            </div>
          )}

          {/* Content */}
          <div className="p-3 space-y-1">
            {/* Site name or favicon */}
            {(preview.siteName || preview.favicon) && (
              <div className="flex items-center gap-2 mb-2">
                {preview.favicon && (
                  <img
                    src={preview.favicon}
                    alt=""
                    className="w-4 h-4 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                {preview.siteName && (
                  <span
                    className={`text-xs font-medium ${
                      isMine ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {preview.siteName}
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            {preview.title && (
              <h4
                className={`font-semibold text-sm line-clamp-2 ${
                  isMine ? "text-white" : "text-gray-900"
                }`}
              >
                {preview.title}
              </h4>
            )}

            {/* Description */}
            {preview.description && (
              <p
                className={`text-xs line-clamp-2 ${
                  isMine ? "text-blue-100" : "text-gray-600"
                }`}
              >
                {preview.description}
              </p>
            )}

            {/* URL */}
            <p
              className={`text-xs truncate ${
                isMine ? "text-blue-200" : "text-gray-400"
              }`}
            >
              {new URL(url).hostname}
            </p>
          </div>
        </CardBody>
      </Card>
    </a>
  );
};
