"use client";
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

const isFacebookVideoUrl = (raw: string) => {
  try {
    const u = new URL(raw);
    if (
      !u.hostname.includes("facebook.com") &&
      !u.hostname.includes("fb.watch")
    )
      return false;
    // Hỗ trợ /watch/, /reel/, /reels/, /videos/ và fb.watch/xxxx
    return (
      /\/(watch|reel|reels|videos)\//.test(u.pathname) ||
      u.hostname === "fb.watch"
    );
  } catch {
    return false;
  }
};

const fbEmbedSrc = (raw: string, width = 560) => {
  const href = encodeURIComponent(raw);
  return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=${width}&height=${Math.round(
    (width * 9) / 16
  )}&allowfullscreen=true`;
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

  // Nhận diện nền tảng
  const ytInfo = useMemo(() => ytIdFromUrl(url), [url]);
  const isYouTube = !!ytInfo.id;
  const isFacebook = useMemo(() => isFacebookVideoUrl(url), [url]);

  // Nếu là YouTube/Facebook -> bỏ qua fetch preview
  const shouldFetchPreview = !isYouTube && !isFacebook;

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
      const timeoutMs = 6000; // 6s timeout
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        setLoading(true);
        setError(false);
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          const status = response.status;
          const statusText = response.statusText;
          const contentType = response.headers.get("content-type") || "";

          // Đọc body nhưng cắt ngắn + tránh spam HTML
          let bodySnippet = "";
          try {
            const rawBody = await response.text();
            if (contentType.includes("text/html")) {
              // Không in nguyên cái HTML 404 ra console nữa
              bodySnippet = "[HTML response truncated]";
            } else {
              bodySnippet = rawBody.slice(0, 300); // cắt còn ~300 ký tự
            }
          } catch (e) {
            console.debug("Failed to read error body for link preview:", e);
          }

          if (status === 404) {
            // Trường hợp API không có/không hỗ trợ -> coi như "không có preview"
            console.warn(
              "Link preview API returned 404 for url:",
              url,
              "- using fallback link only."
            );
          } else {
            console.error(
              "Link preview fetch failed:",
              status,
              statusText,
              bodySnippet
            );
          }

          if (!ignore) setError(true);
          return;
        }

        const data = (await response.json()) as LinkPreviewData;
        if (!ignore) setPreview(data);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          console.error("Link preview fetch aborted (timeout)");
        } else {
          console.error("Error fetching link preview:", err);
        }
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

  /* ---------------------- Common skeleton ---------------------- */
  const LoadingCard = (
    <Card
      className={`max-w-sm mt-2 ${isMine ? "bg-blue-400/20" : "bg-gray-100"}`}
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
      // start time nếu có
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
    const src = fbEmbedSrc(url, 560);
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
              : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
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
              : "bg-white border-gray-200"
          }
          ${roundedClass}
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
};
