"use client";
import { Card, CardBody, Image, Skeleton } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import MessageService from "@/service/message.service";

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

      try {
        setLoading(true);
        setError(false);

        const res = await MessageService.getLinkPreview(url);

        // Giả sử backend trả về ApiResponse<LinkPreviewData>
        // và dữ liệu thực nằm trong res.data.metadata
        const data = (res.data as any)?.metadata as LinkPreviewData;

        if (!ignore) {
          if (data) {
            setPreview(data);
          } else {
            // Trường hợp success nhưng không có metadata (hoặc null)
            setError(true);
          }
        }
      } catch (err: any) {
        console.error("Error fetching link preview:", err);
        if (!ignore) setError(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    if (url) fetchPreview();
    return () => {
      ignore = true;
    };
  }, [url, shouldFetchPreview]);

  /* ---------------------- Loading Card ----------------------- */
  const LoadingCard = (
    <Card
      className={`
        w-full max-w-sm 
        bg-white dark:bg-gray-900 
        border border-gray-200 dark:border-gray-800
        ${roundedClass}
      `}
      shadow="sm"
    >
      <CardBody className="p-0">
        <Skeleton className="w-full h-40" />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="w-20 h-3 rounded-lg" />
          </div>
          <Skeleton className="w-full h-5 rounded-lg" />
          <Skeleton className="w-3/4 h-4 rounded-lg" />
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
      <div className="block max-w-sm w-full">
        <div
          className={`relative w-full overflow-hidden bg-black ${roundedClass}`}
          style={{ paddingTop: "56.25%" }}
        >
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10">
              <Skeleton className="w-full h-full" />
            </div>
          )}
          <iframe
            className="absolute left-0 top-0 h-full w-full z-20"
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
      <div className="block max-w-sm w-full">
        <div
          className={`relative w-full overflow-hidden bg-black ${roundedClass}`}
          style={{ paddingTop: "56.25%" }}
        >
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10">
              <Skeleton className="w-full h-full" />
            </div>
          )}
          <iframe
            className="absolute left-0 top-0 h-full w-full z-20"
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
          flex items-center gap-3 px-4 py-3 rounded-xl border
          bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800
          hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700
          transition-all duration-200 max-w-sm shadow-sm group w-full
        `}
      >
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
          <GlobeAltIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {url}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click to open link
          </p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block max-w-sm w-full group"
    >
      <Card
        className={`
          overflow-hidden transition-all duration-200 
          bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
          hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700
          ${roundedClass}
        `}
        shadow="sm"
        isPressable
      >
        <CardBody className="p-0">
          {/* Preview Image */}
          {preview.image && (
            <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <Image
                src={preview.image}
                alt={preview.title || "Link preview"}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                removeWrapper
                radius="none"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-4 space-y-2">
            {/* Site Info */}
            {(preview.siteName || preview.favicon) && (
              <div className="flex items-center gap-2">
                {preview.favicon && (
                  <img
                    src={preview.favicon}
                    alt=""
                    className="w-4 h-4 rounded-sm"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {preview.siteName || new URL(url).hostname}
                </span>
              </div>
            )}

            {/* Title */}
            {preview.title && (
              <h4 className="font-bold text-base leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {preview.title}
              </h4>
            )}

            {/* Description */}
            {preview.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {preview.description}
              </p>
            )}

            {/* Fallback Domain if no site name */}
            {!preview.siteName && !preview.favicon && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {new URL(url).hostname}
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    </a>
  );
};
