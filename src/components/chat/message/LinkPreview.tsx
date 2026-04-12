"use client";
import { Card, CardBody, Image, Skeleton } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import LinkPreviewService, {
  LinkPreviewData,
} from "@/service/link-preview.service";
import { logError, normalizeError } from "@/utils/errorUtils";

/* ---------------------------- Types ---------------------------- */
interface LinkPreviewProps {
  url: string;
  isMine?: boolean;
  /** tuỳ chọn tắt autoplay của iframe (YouTube/Facebook) */
  autoPlay?: boolean;
  /** bo góc cho khung preview/player */
  roundedClass?: string; // ví dụ "rounded-xl"
}

/* ---------------------------- Component ---------------------------- */
export const LinkPreview = ({
  url,
  isMine = false,
  autoPlay = false,
  roundedClass = "rounded-xl",
}: LinkPreviewProps) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Nhận diện nền tảng sử dụng service
  const ytInfo = useMemo(() => LinkPreviewService.getYouTubeId(url), [url]);
  const isYouTube = !!ytInfo.id;
  const isFacebook = useMemo(
    () => LinkPreviewService.isFacebookVideo(url),
    [url]
  );

  // Nếu là YouTube/Facebook -> bỏ qua fetch preview
  const shouldFetchPreview = !isYouTube && !isFacebook;

  useEffect(() => {
    let ignore = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchPreview = async () => {
      if (!shouldFetchPreview) {
        setLoading(false);
        setPreview(null);
        setError(false);
        return;
      }

      const timeoutMs = 10000; // 10s timeout
      let isTimeout = false;

      timeoutId = setTimeout(() => {
        isTimeout = true;
        if (!ignore) {
          console.warn("Link preview timeout after", timeoutMs, "ms for:", url);
          setError(true);
          setLoading(false);
        }
      }, timeoutMs);

      try {
        setLoading(true);
        setError(false);

        // Gọi service để fetch preview
        const data = await LinkPreviewService.fetchPreview(url);

        if (!ignore && !isTimeout) {
          setPreview(data);
          setError(false);
        }
      } catch (error: unknown) {
        if (!ignore && !isTimeout) {
          const normalized = normalizeError(error);

          if (normalized.statusCode === 404) {
            console.warn("Link preview not found for:", url);
          } else if (normalized.statusCode === 503) {
            console.warn("Link preview service unavailable for:", url);
          } else {
            logError("Error fetching link preview", error);
          }
          setError(true);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (!ignore && !isTimeout) {
          setLoading(false);
        }
      }
    };

    if (url) {
      fetchPreview();
    }

    return () => {
      ignore = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [url, shouldFetchPreview]);

  /* ---------------------- Common skeleton ---------------------- */
  const LoadingCard = (
    <Card
      className={`
        max-w-sm mt-2 
        ${
          isMine
            ? "bg-blue-400/20"
            : "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        }
      `}
      shadow="sm"
    >
      <CardBody className={`p-0 ${roundedClass}`}>
        <Skeleton className="w-full h-32" />
        <div className="p-3 space-y-2">
          <Skeleton className="w-3/4 h-4 rounded-lg" />
          <Skeleton className="w-full h-3 rounded-lg" />
        </div>
      </CardBody>
    </Card>
  );

  /* ---------------------- YouTube Player ----------------------- */
  const YouTubePlayer = () => {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const base = `https://www.youtube-nocookie.com/embed/${ytInfo.id}`;
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      autoplay: autoPlay ? "1" : "0",
      mute: autoPlay ? "1" : "0",
      controls: "1",
      ...(ytInfo.start ? { start: String(ytInfo.start) } : {}),
    }).toString();

    return (
      <div className="block mt-2 max-w-sm">
        <div
          className={`relative w-full overflow-hidden ${roundedClass}`}
          style={{ paddingTop: "56.25%" }}
        >
          {!iframeLoaded && (
            <div className="absolute inset-0">
              <Skeleton className="w-full h-full" />
            </div>
          )}
          <iframe
            className="absolute left-0 top-0 h-full w-full"
            src={`${base}?${params}`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      </div>
    );
  };

  /* ---------------------- Facebook Player ---------------------- */
  const FacebookPlayer = () => {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const src = LinkPreviewService.getFacebookEmbedUrl(url, 560);
    const autoplayParam = autoPlay ? "&autoplay=true" : "";
    return (
      <div className="block mt-2 max-w-sm">
        <div
          className={`relative w-full overflow-hidden ${roundedClass}`}
          style={{ paddingTop: "56.25%" }}
        >
          {!iframeLoaded && (
            <div className="absolute inset-0">
              <Skeleton className="w-full h-full" />
            </div>
          )}
          <iframe
            className="absolute left-0 top-0 h-full w-full"
            src={`${src}${autoplayParam}`}
            title="Facebook video player"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      </div>
    );
  };

  /* ---------------------- Render branches ---------------------- */
  if (isYouTube) return <YouTubePlayer />;
  if (isFacebook) return <FacebookPlayer />;

  if (loading) return LoadingCard;

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
              : `
                bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200
                dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700
              `
          }
          transition-colors duration-200 max-w-sm
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
              : "bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700"
          }
          ${roundedClass}
        `}
        shadow="sm"
        isPressable
      >
        <CardBody className="p-0">
          {/* Preview Image */}
          {preview.image && (
            <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-800 overflow-hidden">
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
                    className={`
                      text-xs font-medium 
                      ${
                        isMine
                          ? "text-blue-100"
                          : "text-gray-500 dark:text-gray-400"
                      }
                    `}
                  >
                    {preview.siteName}
                  </span>
                )}
              </div>
            )}

            {preview.title && (
              <h4
                className={`
                  font-semibold text-sm line-clamp-2
                  ${isMine ? "text-white" : "text-gray-900 dark:text-gray-100"}
                `}
              >
                {preview.title}
              </h4>
            )}

            {preview.description && (
              <p
                className={`
                  text-xs line-clamp-2
                  ${
                    isMine
                      ? "text-blue-100"
                      : "text-gray-600 dark:text-gray-400"
                  }
                `}
              >
                {preview.description}
              </p>
            )}

            <p
              className={`
                text-xs truncate
                ${isMine ? "text-blue-200" : "text-gray-400 dark:text-gray-500"}
              `}
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
};
