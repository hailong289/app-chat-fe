"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Avatar,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
} from "@heroui/react";
import {
  PhoneIcon,
  PhoneXMarkIcon,
  UserGroupIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/solid";
import useCallStore from "@/store/useCallStore";
import useRoomStore from "@/store/useRoomStore";

const RINGTONE_PATH = "/audio/incoming-call.mp3";
const AUTO_DECLINE_AFTER_MS = 30_000;

/**
 * Messenger-style incoming call modal. Renders globally — driven by
 * `useCallStore.incomingCall`. Accept opens the call window, reject emits
 * call:end status='rejected', no answer within 30s emits status='missed'.
 */
export function IncomingCallModal() {
  const incoming = useCallStore((s) => s.incomingCall);
  const acceptIncomingCall = useCallStore((s) => s.acceptIncomingCall);
  const rejectIncomingCall = useCallStore((s) => s.rejectIncomingCall);
  const missIncomingCall = useCallStore((s) => s.missIncomingCall);

  // Look up the room (for group calls we want the group's name + avatar in
  // the modal header, not the caller's). `rooms` is hydrated by the chat
  // sidebar; if it isn't here yet we fall back to "Cuộc gọi nhóm".
  const room = useRoomStore((s) =>
    incoming
      ? s.rooms.find(
          (r) => r.roomId === incoming.roomId || r.id === incoming.roomId,
        )
      : undefined,
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pick the caller member (used as subtitle in groups, as the focal user in 1-1)
  const caller = useMemo(() => {
    if (!incoming) return null;
    return (
      incoming.members.find((m) => m.is_caller) ||
      incoming.members.find((m) => m.id === incoming.actionUserId) ||
      incoming.members[0] ||
      null
    );
  }, [incoming]);

  // Group = more than 2 distinct members (caller + N other receivers).
  const isGroup = (incoming?.members.length ?? 0) > 2;

  // Ringtone: play on open, stop on close. Mute autoplay errors silently —
  // browsers may block until first user interaction (acceptable trade-off).
  useEffect(() => {
    if (!incoming) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }
    const audio = new Audio(RINGTONE_PATH);
    audio.loop = true;
    audio.volume = 0.6;
    audioRef.current = audio;
    void audio.play().catch(() => {
      /* autoplay blocked — visual ringing still works */
    });
    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [incoming]);

  // Auto-decline timer (30s)
  useEffect(() => {
    if (!incoming) return;
    const elapsed = Date.now() - incoming.receivedAt;
    const remaining = Math.max(AUTO_DECLINE_AFTER_MS - elapsed, 0);
    const timer = setTimeout(() => {
      missIncomingCall();
    }, remaining);
    return () => clearTimeout(timer);
  }, [incoming, missIncomingCall]);

  if (!incoming || !caller) return null;

  const isVideo = incoming.callType === "video";

  // Display layer: groups show the room (name + avatar, fall back to caller's
  // avatar if the room isn't loaded yet); 1-1 shows the caller directly.
  const displayName = isGroup
    ? room?.name?.trim() || "Cuộc gọi nhóm"
    : caller.fullname;
  const displayAvatar = isGroup ? room?.avatar || caller.avatar : caller.avatar;
  const subtitle = isGroup
    ? `${caller.fullname} đang gọi ${isVideo ? "video" : "thoại"} nhóm`
    : `Đang gọi ${isVideo ? "video" : "thoại"} cho bạn...`;

  return (
    <Modal
      isOpen={!!incoming}
      hideCloseButton
      isDismissable={false}
      isKeyboardDismissDisabled
      size="sm"
      placement="center"
      backdrop="blur"
    >
      <ModalContent>
        <ModalBody className="flex flex-col items-center gap-3 py-8">
          {/* Pulsing ring around avatar */}
          <div className="relative">
            <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/30" />
            <Avatar
              src={displayAvatar}
              name={displayName}
              size="lg"
              className="relative h-24 w-24 text-2xl"
              icon={
                isGroup && !room?.avatar ? (
                  <UserGroupIcon className="h-10 w-10 text-default-500" />
                ) : undefined
              }
            />
          </div>

          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold">{displayName}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-default-500">
              {isVideo ? (
                <VideoCameraIcon className="h-4 w-4" />
              ) : (
                <PhoneIcon className="h-4 w-4" />
              )}
              {subtitle}
            </p>
          </div>
        </ModalBody>

        <ModalFooter className="justify-center gap-6 pb-6">
          {/* Reject — red */}
          <Button
            isIconOnly
            radius="full"
            size="lg"
            color="danger"
            aria-label="Từ chối cuộc gọi"
            onPress={rejectIncomingCall}
            className="h-14 w-14"
          >
            <PhoneXMarkIcon className="h-7 w-7" />
          </Button>

          {/* Accept — green */}
          <Button
            isIconOnly
            radius="full"
            size="lg"
            color="success"
            aria-label="Chấp nhận cuộc gọi"
            onPress={acceptIncomingCall}
            className="h-14 w-14 text-white"
          >
            {isVideo ? (
              <VideoCameraIcon className="h-7 w-7" />
            ) : (
              <PhoneIcon className="h-7 w-7" />
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
