import { useState, useRef } from "react";

export function useChatMessagesState(chatId: string) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set()
  );
  const [isBottomVisible, setIsBottomVisible] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isLoadingFromAPI, setIsLoadingFromAPI] = useState(false);
  const [hasMoreOnServer, setHasMoreOnServer] = useState(true);
  // Single source of truth: which chatId (if any) is currently loading
  // its messages. `loadingChatId === chatId` → show skeleton; null →
  // done. Replaces the old triplet (`isSwitchingChat`,
  // `isFetchingNewMessages`, store's `isLoading`) which had to be
  // synchronized manually and frequently went out of sync (empty rooms
  // got stuck on `isSwitchingChat=true` because the "loaded" tracker
  // only fired on `messages.length > 0`).
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevChatIdRef = useRef(chatId);
  const renderedMessageIds = useRef(new Set<string>());
  const hasTriedLoadingFromServer = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedServerMessageIdRef = useRef<string | null>(null);
  // Tracks which chatId we've already kicked off `loadRoomFromCache`
  // for, so the merged chat-switch/initial-fetch effect doesn't spam
  // the API when its other deps (refs, setters, etc.) churn between
  // renders. Cleared via assignment to chatId on every legitimate
  // chat switch.
  const loadedChatIdRef = useRef<string | null>(null);

  return {
    // State
    expandedMessages,
    setExpandedMessages,
    isBottomVisible,
    setIsBottomVisible,
    isLoadingOlder,
    setIsLoadingOlder,
    isLoadingFromAPI,
    setIsLoadingFromAPI,
    hasMoreOnServer,
    setHasMoreOnServer,
    loadingChatId,
    setLoadingChatId,
    shouldAnimate,
    setShouldAnimate,
    // Refs
    containerRef,
    bottomRef,
    topRef,
    prevMessageCountRef,
    loadingTimeoutRef,
    prevChatIdRef,
    renderedMessageIds,
    hasTriedLoadingFromServer,
    fetchTimeoutRef,
    lastFetchedServerMessageIdRef,
    loadedChatIdRef,
  };
}
