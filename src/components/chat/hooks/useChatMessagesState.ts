import { useState, useRef } from "react";
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";

export function useChatMessagesState(chatId: string) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set()
  );
  const [isBottomVisible, setIsBottomVisible] = useState(false);
  const [isTopVisible, setIsTopVisible] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [displayedMessagesCount, setDisplayedMessagesCount] =
    useState(MESSAGES_PER_GROUP);
  const [isLoadingFromAPI, setIsLoadingFromAPI] = useState(false);
  const [hasMoreOnServer, setHasMoreOnServer] = useState(true);
  const [isFetchingNewMessages, setIsFetchingNewMessages] = useState(false);
  const [isSwitchingChat, setIsSwitchingChat] = useState(false);
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
  const hasInitialFetchRef = useRef<Record<string, boolean>>({});

  return {
    // State
    expandedMessages,
    setExpandedMessages,
    isBottomVisible,
    setIsBottomVisible,
    isTopVisible,
    setIsTopVisible,
    isLoadingOlder,
    setIsLoadingOlder,
    displayedMessagesCount,
    setDisplayedMessagesCount,
    isLoadingFromAPI,
    setIsLoadingFromAPI,
    hasMoreOnServer,
    setHasMoreOnServer,
    isFetchingNewMessages,
    setIsFetchingNewMessages,
    isSwitchingChat,
    setIsSwitchingChat,
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
    hasInitialFetchRef,
  };
}

