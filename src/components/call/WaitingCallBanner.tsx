"use client";

import { useEffect, useMemo } from "react";
import { Avatar, Button } from "@heroui/react";
import {
  PhoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import useCallStore from "@/store/useCallStore";

const AUTO_DECLINE_AFTER_MS = 30_000;

/**
 * Toast-style banner shown when an incoming call arrives while the user is
 * already in another call. Driven by `useCallStore.waitingCall`. Reject
 * dismisses with `call:end status='rejected'`. Accept ends the current
 * call and joins the new one (in popup context, navigates the popup; in
 * main, focuses the popup or promotes to incomingCall + acceptIncoming).
 *
 * Mounted in BOTH the main window (via SocketEventChatGlobal) and the call
 * popup (via /call page) so the user sees it regardless of focus.
 */
export function WaitingCallBanner() {
  const { t } = useTranslation();
  const waiting = useCallStore((s) => s.waitingCall);
  const acceptWaitingCall = useCallStore((s) => s.acceptWaitingCall);
  const rejectWaitingCall = useCallStore((s) => s.rejectWaitingCall);
  const missWaitingCall = useCallStore((s) => s.missWaitingCall);

  const caller = useMemo(() => {
    if (!waiting) return null;
    return (
      waiting.members.find((m) => m.is_caller) ||
      waiting.members.find((m) => m.id === waiting.actionUserId) ||
      waiting.members[0] ||
      null
    );
  }, [waiting]);

  // Auto-decline after 30s — same window as IncomingCallModal so the
  // server-side call history closes consistently.
  useEffect(() => {
    if (!waiting) return;
    const elapsed = Date.now() - waiting.receivedAt;
    const remaining = Math.max(AUTO_DECLINE_AFTER_MS - elapsed, 0);
    const timer = setTimeout(() => {
      missWaitingCall();
    }, remaining);
    return () => clearTimeout(timer);
  }, [waiting, missWaitingCall]);

  if (!waiting || !caller) return null;

  const isVideo = waiting.callType === "video";
  const isGroup = waiting.members.length > 2;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[380px] max-w-[92vw] bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-pulse-slow">
      <div className="relative shrink-0">
        <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-primary/30" />
        <Avatar
          src={caller.avatar}
          name={caller.fullname}
          size="md"
          className="relative h-12 w-12"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">
          {caller.fullname}
        </p>
        <p className="text-default-400 text-xs flex items-center gap-1 truncate">
          {isVideo ? (
            <VideoCameraIcon className="h-3 w-3" />
          ) : (
            <PhoneIcon className="h-3 w-3" />
          )}
          {isGroup
            ? t("callPage.waitingBanner.subtitleGroup")
            : t("callPage.waitingBanner.subtitle")}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          isIconOnly
          radius="full"
          size="sm"
          color="danger"
          aria-label={t("callPage.waitingBanner.rejectAria")}
          onPress={rejectWaitingCall}
          className="h-9 w-9"
        >
          <PhoneXMarkIcon className="h-4 w-4" />
        </Button>
        <Button
          isIconOnly
          radius="full"
          size="sm"
          color="success"
          aria-label={t("callPage.waitingBanner.acceptAria")}
          onPress={acceptWaitingCall}
          className="h-9 w-9 text-white"
        >
          {isVideo ? (
            <VideoCameraIcon className="h-4 w-4" />
          ) : (
            <PhoneIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
