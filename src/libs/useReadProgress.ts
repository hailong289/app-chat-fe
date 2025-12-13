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
    }, 300); // Tăng debounce lên 300ms
  };

  // Track observed elements để tránh re-observe
  const observedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!messages.length) return;

    let ticking = false;

    // Optimized: Check if container has scroll
    const hasScroll = (): boolean => {
      if (!container) {
        const { scrollHeight, clientHeight } = document.documentElement;
        return scrollHeight > clientHeight + 10; // 10px threshold
      } else {
        const { scrollHeight, clientHeight } = container;
        return scrollHeight > clientHeight + 10;
      }
    };

    // Optimized: Check if scrolled to bottom
    const isAtBottom = (): boolean => {
      if (!container) {
        const { scrollHeight, scrollTop, clientHeight } =
          document.documentElement;
        return scrollHeight - (scrollTop + clientHeight) <= 50;
      } else {
        const { scrollHeight, scrollTop, clientHeight } = container;
        return scrollHeight - (scrollTop + clientHeight) <= 50;
      }
    };

    // Mark last visible message as read
    const updateLastRead = (id: string) => {
      const currentIdx = indexOf.get(lastReadId) ?? -1;
      const newIdx = indexOf.get(id) ?? -1;

      if (newIdx > currentIdx) {
        setLastReadId(id);
        debouncedCommit(id);
      }
    };

    // Find last non-mine message
    const getLastReadableMessageId = (): string | null => {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (!msg.isMine && !msg.deleted) {
          return msg.id;
        }
      }
      return null;
    };

    // 🔥 Mark all as read if no scroll (all messages visible)
    const markAllAsReadIfNoScroll = () => {
      if (!hasScroll()) {
        const lastId = getLastReadableMessageId();
        if (lastId) {
          updateLastRead(lastId);
        }
        return true;
      }
      return false;
    };

    const io = new IntersectionObserver(
      (entries) => {
        // Nếu đang ở bottom, mark hết luôn
        if (isAtBottom()) {
          const lastId = getLastReadableMessageId();
          if (lastId) updateLastRead(lastId);
          return;
        }

        // Lấy những entry visible
        const visible = entries
          .filter(
            (e) => e.isIntersecting && e.intersectionRatio >= minVisibleRatio
          )
          .map((e) => e.target as HTMLElement);

        if (visible.length === 0) return;

        // Lấy message có index lớn nhất
        let maxIdx = -1;
        let maxId: string | null = null;

        for (const el of visible) {
          const id = el.dataset.mid;
          if (!id) continue;

          const msg = messages[indexOf.get(id)!];
          if (msg?.isMine || msg?.deleted) continue;

          const idx = indexOf.get(id);
          if (idx != null && idx > maxIdx) {
            maxIdx = idx;
            maxId = id;
          }
        }

        if (maxId) {
          updateLastRead(maxId);
        }
      },
      {
        root: container ?? null,
        rootMargin: `0px 0px -${stickyBottomPx}px 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1], // Giảm từ 10 xuống 5 threshold
      }
    );

    // Chỉ observe messages mới (chưa được observe)
    for (const msg of messages) {
      if (observedIds.current.has(msg.id)) continue;

      const el = refMap.current.get(msg.id);
      if (el) {
        io.observe(el);
        observedIds.current.add(msg.id);
      }
    }

    // Optimized scroll handler với RAF
    const handleScroll = () => {
      if (ticking) return;

      ticking = true;
      requestAnimationFrame(() => {
        if (isAtBottom()) {
          const lastId = getLastReadableMessageId();
          if (lastId) updateLastRead(lastId);
        }
        ticking = false;
      });
    };

    // Add scroll listener only if has scroll
    const scrollTarget = container ?? window;
    if (hasScroll()) {
      scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    }

    // Initial check - với delay để đảm bảo DOM đã render
    const initialCheckTimer = setTimeout(() => {
      // Check if no scroll - mark all as read
      if (markAllAsReadIfNoScroll()) {
        return; // Already marked all as read
      }

      // Otherwise check if at bottom
      if (isAtBottom()) {
        const lastId = getLastReadableMessageId();
        if (lastId) updateLastRead(lastId);
      }
    }, 100); // Delay 100ms để DOM render xong

    return () => {
      io.disconnect();
      observedIds.current.clear();
      scrollTarget.removeEventListener("scroll", handleScroll);
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
      clearTimeout(initialCheckTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, container, stickyBottomPx, minVisibleRatio]);

  return { setMessageRef: setRef, lastReadId };
}
