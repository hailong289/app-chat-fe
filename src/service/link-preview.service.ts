import apiService from "./api.service";

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

class LinkPreviewService {
  private static instance: LinkPreviewService;

  private constructor() {}

  static getInstance(): LinkPreviewService {
    if (!LinkPreviewService.instance) {
      LinkPreviewService.instance = new LinkPreviewService();
    }
    return LinkPreviewService.instance;
  }

  /**
   * Fetch link preview metadata from backend
   * @param url - URL to preview
   * @returns Promise with preview data
   */
  async fetchPreview(url: string): Promise<LinkPreviewData> {
    try {
      const response = await apiService.get<{
        success: boolean;
        data: LinkPreviewData;
      }>(`/social/preview-link?url=${encodeURIComponent(url)}`);

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      // Fallback nếu format response khác
      return response.data as unknown as LinkPreviewData;
    } catch (error: any) {
      console.error("LinkPreviewService: Failed to fetch preview", error);
      throw error;
    }
  }

  /**
   * Check if URL is a YouTube video
   * @param url - URL to check
   * @returns YouTube video ID or null
   */
  getYouTubeId(url: string): { id: string | null; start?: number } {
    try {
      const u = new URL(url);

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
  }

  /**
   * Check if URL is a Facebook video
   * @param url - URL to check
   * @returns true if Facebook video
   */
  isFacebookVideo(url: string): boolean {
    try {
      const u = new URL(url);
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
  }

  /**
   * Generate Facebook embed URL
   * @param url - Facebook video URL
   * @param width - Video width
   * @returns Embed URL
   */
  getFacebookEmbedUrl(url: string, width = 560): string {
    const href = encodeURIComponent(url);
    return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=${width}&height=${Math.round(
      (width * 9) / 16
    )}&allowfullscreen=true`;
  }
}

export default LinkPreviewService.getInstance();
