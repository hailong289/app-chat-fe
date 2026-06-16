import { useEffect, useMemo, useRef, useCallback } from "react";

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

  // 1. Keep data in refs to avoid restarting observer on data change
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const observerRef = useRef<IntersectionObserver | undefined>(undefined);
  
  // Track last read to prevent backward jumps or duplicates
  const lastReadIdRef = useRef<string>("");
  
  // Index lookup for O(1) comparison
  // We keep this up to date synchronously with renders
  const indexOfRef = useRef(new Map<string, number>());
  
  useMemo(() => {
    const m = new Map<string, number>();
    messages.forEach((msg, i) => m.set(msg.id, i));
    indexOfRef.current = m;
  }, [messages]);

  // Debounced commit
  const commitTimer = useRef<NodeJS.Timeout | null>(null);
  const lastCommittedId = useRef<string>("");

  const debouncedCommit = useCallback((id: string) => {
    if (!onCommitRef.current || lastCommittedId.current === id) return;
    
    if (commitTimer.current) clearTimeout(commitTimer.current);
    
    // Tăng debounce lên chút cho an toàn với scroll nhanh
    commitTimer.current = setTimeout(() => {
      lastCommittedId.current = id;
      if (onCommitRef.current) {
        onCommitRef.current(id);
      }
    }, 500);
  }, []);

  // Registry for ref callbacks to ensure stability
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());
  // Store elements map for manual lookup if needed
  const elementsMap = useRef(new Map<string, HTMLElement>());

  // 2. Core Logic Helpers
  const isAtBottom = useCallback(() => {
    const target = container || document.documentElement;
    // Use a slighly larger threshold (50px) to be safe
    return target.scrollHeight - (target.scrollTop + target.clientHeight) <= 50;
  }, [container]);

  const hasScroll = useCallback(() => {
    const target = container || document.documentElement;
    return target.scrollHeight > target.clientHeight + 10;
  }, [container]);

  const getLastReadableMessageId = useCallback(() => {
    const msgs = messagesRef.current;
    // Scan backwards
    for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i];
        if (!msg.isMine && !msg.deleted) {
            return msg.id;
        }
    }
    return null;
  }, []);

  const updateLastRead = useCallback((id: string) => {
    const indexOf = indexOfRef.current;
    const currentIdx = indexOf.get(lastReadIdRef.current) ?? -1;
    const newIdx = indexOf.get(id) ?? -1;

    // Only advance forward
    if (newIdx > currentIdx) {
      lastReadIdRef.current = id;
      debouncedCommit(id);
    }
  }, [debouncedCommit]);

  // 3. Setup Observer (Runs once per container/options change)
  useEffect(() => {
    const handleIntersect: IntersectionObserverCallback = (entries) => {
      // Fast path: if at bottom, mark latest as read immediately
      if (isAtBottom()) {
        const lastId = getLastReadableMessageId();
        if (lastId) updateLastRead(lastId); 
        return; 
      }

      // Normal path: Find max visible index
      const visibleEntries = entries.filter(
        (e) => e.isIntersecting && e.intersectionRatio >= (minVisibleRatio || 0.5)
      );

      if (visibleEntries.length === 0) return;

      const msgs = messagesRef.current;
      const indexOf = indexOfRef.current;
      
      let maxIdx = -1;
      let maxId: string | null = null;

      for (const entry of visibleEntries) {
        const el = entry.target as HTMLElement;
        const id = el.dataset.mid; 
        
        if (!id) continue;

        const idx = indexOf.get(id);
        if (idx === undefined) continue;
        
        const msg = msgs[idx];
        if (!msg || msg.isMine || msg.deleted) continue;

        if (idx > maxIdx) {
          maxIdx = idx;
          maxId = id;
        }
      }

      if (maxId) {
        updateLastRead(maxId);
      }
    };

    const io = new IntersectionObserver(handleIntersect, {
      root: container,
      rootMargin: `0px 0px -${stickyBottomPx}px 0px`,
      threshold: [0, (minVisibleRatio || 0.5)], // Minimal thresholds
    });

    observerRef.current = io;

    // Re-observe all currently mounted elements
    // This handles the case where IO is re-created but elements persist
    elementsMap.current.forEach((el) => {
       io.observe(el);
    });

    return () => {
      io.disconnect();
      observerRef.current = undefined;
    };
  }, [container, stickyBottomPx, minVisibleRatio, isAtBottom, getLastReadableMessageId, updateLastRead]);

  // 4. Stable Ref Factory
  const getRef = useCallback((id: string) => {
    const existing = refCallbacks.current.get(id);
    if (existing) return existing;

    const cb = (el: HTMLElement | null) => {
      const io = observerRef.current;
      if (el) {
        elementsMap.current.set(id, el);
        el.dataset.mid = id; 
        
        // Try to observe immediately if IO exists
        if (observerRef.current) {
             observerRef.current.observe(el);
        } else {
            // Queue for next tick if IO not ready (rare race condition)
            setTimeout(() => {
                observerRef.current?.observe(el);
            }, 0);
        }
      } else {
        const prevEl = elementsMap.current.get(id);
        if (prevEl && observerRef.current) {
            observerRef.current.unobserve(prevEl);
        }
        elementsMap.current.delete(id);
      }
    };
    
    refCallbacks.current.set(id, cb);
    return cb;
  }, []);

  // 5. Scroll Fallback
  useEffect(() => {
    const target = container || window;
    let ticking = false;

    const onScroll = () => {
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

    target.addEventListener("scroll", onScroll, { passive: true });
    
    // Initial check
    const timer = setTimeout(() => {
        if (!hasScroll()) {
             const lastId = getLastReadableMessageId();
             if (lastId) updateLastRead(lastId);
        } else if (isAtBottom()) {
             const lastId = getLastReadableMessageId();
             if (lastId) updateLastRead(lastId);
        }
    }, 500);

    return () => {
      target.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [container, hasScroll, isAtBottom, getLastReadableMessageId, updateLastRead]);

  // Clean up timers
  useEffect(() => {
      return () => {
          if (commitTimer.current) clearTimeout(commitTimer.current);
      }
  }, []);

  return { 
      setMessageRef: getRef,
      lastReadId: lastReadIdRef.current 
  };
}
