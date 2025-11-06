// useReadProgress.ts
import { useEffect, useMemo, useRef, useState } from "react";

type MsgLite = { id: string; isMine?: boolean; deleted?: boolean };

export function useReadProgress(opts: {
  messages: MsgLite[]; // đã sort ASC theo thời gian
  container?: HTMLElement | null; // nếu scroll trong 1 div; nếu scroll toàn trang -> để null
  stickyBottomPx?: number; // chiều cao sticky ở đáy (nếu có), để IO trừ lề
  minVisibleRatio?: number; // phần trăm hiển thị tối thiểu để tính "đã đọc"
  onCommit?: (lastReadId: string) => void; // gọi server/bus khi tăng mốc
}) {
  const {
    messages,
    container = null,
    stickyBottomPx = 0,
    minVisibleRatio = 0.5,
    onCommit,
  } = opts;

  // map id -> ref
  const refMap = useRef(new Map<string, HTMLElement>());
  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (!el) refMap.current.delete(id);
    else refMap.current.set(id, el);
  };

  // id đã đọc tới (client)
  const [lastReadId, setLastReadId] = useState<string>("");

  // index map để lấy "max đã thấy"
  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    messages.forEach((msg, i) => m.set(msg.id, i));
    return m;
  }, [messages]);

  // debounce commit để tránh spam API khi kéo nhanh
  const commitTimer = useRef<number | null>(null);
  const lastCommittedId = useRef<string>("");
  
  const debouncedCommit = (id: string) => {
    if (!onCommit || lastCommittedId.current === id) return;
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      lastCommittedId.current = id;
      onCommit(id);
    }, 180);
  };

  useEffect(() => {
    if (!messages.length) return;

    // Check if scrolled to bottom
    const checkScrolledToBottom = () => {
      if (!container) {
        // Check window scroll
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;
        return scrollHeight - scrollTop - clientHeight <= 10; // 10px threshold
      } else {
        // Check container scroll
        return (
          container.scrollHeight -
            container.scrollTop -
            container.clientHeight <=
          10
        );
      }
    };

    // Mark all visible messages as read when at bottom
    const markAllVisibleAsRead = () => {
      if (!checkScrolledToBottom()) return;

      // Find the last non-mine, non-deleted message
      let lastVisibleId: string | null = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (!msg.isMine && !msg.deleted) {
          lastVisibleId = msg.id;
          break;
        }
      }

      if (lastVisibleId) {
        const currentIdx = indexOf.get(lastReadId) ?? -1;
        const newIdx = indexOf.get(lastVisibleId) ?? -1;
        
        // Chỉ update nếu ID mới lớn hơn
        if (newIdx > currentIdx) {
          console.log("📖 Mark as read (at bottom):", lastVisibleId);
          setLastReadId(lastVisibleId);
          debouncedCommit(lastVisibleId);
        }
      }
    };

    // Throttle scroll event
    let scrollTimeout: number | null = null;
    const throttledMarkAllVisible = () => {
      if (scrollTimeout) return;
      scrollTimeout = window.setTimeout(() => {
        markAllVisibleAsRead();
        scrollTimeout = null;
      }, 100); // Throttle 100ms
    };

    const io = new IntersectionObserver(
      (entries) => {
        // lấy những entry đủ tỷ lệ hiển thị
        const visible = entries
          .filter(
            (e) => e.isIntersecting && e.intersectionRatio >= minVisibleRatio
          )
          .map((e) => e.target as HTMLElement);

        if (visible.length === 0) {
          // Nếu không có visible entry, vẫn check bottom
          throttledMarkAllVisible();
          return;
        }

        // lấy message có index lớn nhất trong nhóm vừa thấy
        let best: { id: string; idx: number } | null = null;
        for (const el of visible) {
          const id = el.dataset.mid!;
          const msg = messages[indexOf.get(id)!];
          // bỏ qua tin của chính mình hoặc đã xóa nếu bạn muốn
          if (msg?.isMine || msg?.deleted) continue;

          const idx = indexOf.get(id);
          if (idx == null) continue;
          if (!best || idx > best.idx) best = { id, idx };
        }

        if (best) {
          // chỉ tăng mốc (không lùi)
          const currentIdx = indexOf.get(lastReadId) ?? -1;
          if (best.idx > currentIdx) {
            console.log("📖 Mark as read (intersect):", best.id);
            setLastReadId(best.id);
            debouncedCommit(best.id);
          }
        }

        // Also check if scrolled to bottom after intersection update
        throttledMarkAllVisible();
      },
      {
        root: container ?? null, // null = viewport
        rootMargin: `0px 0px -${stickyBottomPx}px 0px`, // trừ vùng sticky ở đáy
        threshold: Array.from({ length: 10 }, (_, i) => (i + 1) / 10), // 0.1..1
      }
    );

    // observe tất cả message nodes hiện có
    for (const msg of messages) {
      const el = refMap.current.get(msg.id);
      if (el) io.observe(el);
    }

    // Add scroll listener to check when reaching bottom
    const scrollTarget = container ?? window;
    scrollTarget.addEventListener("scroll", throttledMarkAllVisible);

    // Initial check on mount
    markAllVisibleAsRead();

    return () => {
      io.disconnect();
      scrollTarget.removeEventListener("scroll", throttledMarkAllVisible);
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, container, stickyBottomPx, minVisibleRatio]);

  return { setMessageRef: setRef, lastReadId };
}
