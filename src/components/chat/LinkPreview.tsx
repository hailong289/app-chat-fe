"use client";
import React from "react";
import { Card, CardBody, Image, Skeleton } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

/* ---------------------------- Helpers ---------------------------- */
const ytIdFromUrl = (raw: string): { id: string | null; start?: number } => {
  try {
    const u = new URL(raw);
    // youtu.be/<id>?t=123
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1);
      const t = u.searchParams.get("t") || u.searchParams.get("start");
      return {
        id: id || null,
        start: t ? Number.parseInt(t) || undefined : undefined,
      };
    }
    // youtube.com/watch?v=<id>&t=123
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      const t = u.searchParams.get("t") || u.searchParams.get("start");
      return {
        id: id || null,
        start: t ? Number.parseInt(t) || undefined : undefined,
      };
    }
    return { id: null };
  } catch {
    return { id: null };
  }
};

/* ---------------------------- Types ---------------------------- */
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
  autoPlay?: boolean;
  roundedClass?: string;
}

/* ---------------------------- Component ---------------------------- */
const YouTubePlayer = ({
  ytInfo,
  autoPlay,
  roundedClass,
}: {
  ytInfo: { id: string | null; start?: number };
  autoPlay: boolean;
  roundedClass: string;
}) => (
  <div className="block mt-2 max-w-sm">
    <div
      className={`relative w-full overflow-hidden ${roundedClass}`}
      style={{ paddingTop: "56.25%" }}
    >
      <iframe
        className="absolute left-0 top-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${
          ytInfo.id
        }?autoplay=${autoPlay ? "1" : "0"}&mute=${autoPlay ? "1" : "0"}`}
        title={`YouTube video player${ytInfo.id ? ` - ${ytInfo.id}` : ""}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  </div>
);

const LoadingCard = ({
  isMine,
  roundedClass,
}: {
  isMine: boolean;
  roundedClass: string;
}) => (
  <Card
    className={`max-w-sm mt-2 ${isMine ? "bg-blue-400/20" : "bg-gray-100"}`}
    shadow="sm"
  >
    <CardBody className={`p-0 ${roundedClass}`}>
      <Skeleton className="w-full h-32" />
      <div className="p-3 space-y-2">
        <Skeleton className="w-3/4 h-4" />
        <Skeleton className="w-full h-3" />
      </div>
    </CardBody>
  </Card>
);

const ErrorFallback = ({
  url,
  isMine,
}: {
  url: string;
  isMine: boolean;
}) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border max-w-sm ${
      isMine
        ? "bg-blue-400/20 border-blue-400/30 text-white"
        : "bg-gray-100 border-gray-200 text-gray-700"
    }`}
  >
    <GlobeAltIcon className="w-4 h-4" />
    <span className="text-xs truncate">{url}</span>
  </a>
);

const StandardPreview = ({
  url,
  isMine,
  roundedClass,
  preview,
}: {
  url: string;
  isMine: boolean;
  roundedClass: string;
  preview: LinkPreviewData;
}) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="block mt-2 max-w-sm"
  >
    <Card
      className={`overflow-hidden transition-all duration-200 hover:scale-[1.02] ${
        isMine
          ? "bg-blue-400/10 border-blue-400/30"
          : "bg-white border-gray-200"
      } ${roundedClass}`}
      shadow="sm"
      isPressable
    >
      <CardBody className="p-0">
        {preview.image && (
          <div className="relative w-full h-40 bg-gray-100 overflow-hidden">
            <Image
              src={preview.image}
              alt={preview.title || "Preview"}
              className="w-full h-full object-cover"
              removeWrapper
            />
          </div>
        )}

        <div className="p-3 space-y-1">
          {(preview.siteName || preview.favicon) && (
            <div className="flex items-center gap-2 mb-2">
              {preview.favicon && (
                <img
                  src={preview.favicon}
                  alt=""
                  className="w-4 h-4 rounded"
                  onError={(e) => (e.currentTarget.style.display = "none")}
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

          {preview.title && (
            <h4
              className={`font-semibold text-sm line-clamp-2 ${
                isMine ? "text-white" : "text-gray-900"
              }`}
            >
              {preview.title}
            </h4>
          )}

          {preview.description && (
            <p
              className={`text-xs line-clamp-2 ${
                isMine ? "text-blue-100" : "text-gray-600"
              }`}
            >
              {preview.description}
            </p>
          )}

          <p
            className={`text-xs truncate ${
              isMine ? "text-blue-200" : "text-gray-400"
            }`}
          >
            {(() => {
              try {
                return new URL(url).hostname;
              } catch {
                return url;
              }
            })()}
          </p>
        </div>
      </CardBody>
    </Card>
  </a>
);

export const LinkPreview = ({
  url,
  isMine = false,
  autoPlay = false,
  roundedClass = "rounded-xl",
}: LinkPreviewProps) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const ytInfo = useMemo(() => ytIdFromUrl(url), [url]);
  const isYouTube = !!ytInfo.id;
  const shouldFetchPreview = !isYouTube;

  useEffect(() => {
    let ignore = false;
    const fetchPreview = async () => {
      if (!shouldFetchPreview) {
        setLoading(false);
        setPreview(null);
        setError(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        setLoading(true);
        setError(false);

        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          let body = "";
          try {
            body = await response.text();
          } catch {}
          console.error("Preview fetch failed:", response.status, body);
          if (!ignore) setError(true);
          return;
        }

        const data = (await response.json()) as LinkPreviewData;
        if (!ignore) setPreview(data);
      } catch (err: any) {
        console.error("Preview error", err);
        if (!ignore) setError(true);
      } finally {
        clearTimeout(timeoutId);
        if (!ignore) setLoading(false);
      }
    };

    if (url) fetchPreview();

    return () => {
      ignore = true;
    };
  }, [url, shouldFetchPreview]);

  if (isYouTube) {
    return (
      <YouTubePlayer ytInfo={ytInfo} autoPlay={autoPlay} roundedClass={roundedClass} />
    );
  }

  if (loading) return <LoadingCard isMine={isMine} roundedClass={roundedClass} />;

  if (error || !preview) {
    return <ErrorFallback url={url} isMine={isMine} />;
  }

  return (
    <StandardPreview
      url={url}
      isMine={isMine}
      roundedClass={roundedClass}
      preview={preview}
    />
  );
};
