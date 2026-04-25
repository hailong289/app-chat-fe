"use client";

import { useRef, useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from "@heroui/react";
import {
  MicrophoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ComputerDesktopIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import { useSocket } from "@/components/providers/SocketProvider";
import useAuthStore from "@/store/useAuthStore";
import Helpers from "@/libs/helpers";
import useCallStore from "@/store/useCallStore";
import { CallMember } from "@/store/types/call.state";
import { useTranslation } from "react-i18next";

function CallPageContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket } = useSocket("/call");
  const [isMounted, setIsMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { t } = useTranslation();

  // callMode is stable for the lifetime of this call window (set from URL params
  // once and never changes). Use it to register only the relevant socket listeners.
  const callMode = (searchParams.get("callMode") as "p2p" | "sfu") || "p2p";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hasEndedRef = useRef(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const {
    status: callStatus,
    error: callError,
    stream: { localStream, remoteStreams },
    action: {
      isMicEnabled,
      isCameraEnabled,
      isSpeakerphoneEnabled,
      duration,
      isSharingScreen,
      userIdGhimmed,
    },
    devices,
    mode,
    members,
    roomId,
    handleCreateLocalStream,
    updateCallState,
    eventCall,
    actionToggleTrack,
    endCall,
    setUserIdGhimmed,
    getDevices,
    setDevice,
    handleSFUSignal,
  } = useCallStore();

  // Stable handler refs — Socket.IO off() requires the exact same function reference
  // that was passed to on(). Inline arrow functions in both on() and off() create
  // different objects so listeners are never removed → they accumulate → events like
  // call:accepted fire multiple times → "setLocalDescription: stable state" errors.
  const onAccepted = useRef((p: any) => useCallStore.getState().eventCall("accepted", p));
  const onAnswer = useRef((p: any) => useCallStore.getState().eventCall("answer", p));
  const onCandidate = useRef((p: any) => useCallStore.getState().eventCall("candidate", p));
  const onEnd = useRef((p: any) => useCallStore.getState().eventCall("end", p));
  const onSignal = useRef((p: any) => useCallStore.getState().handleSFUSignal(p));
  const onMemberJoined = useRef((p: any) => useCallStore.getState().eventCall("member-joined", p));
  const onShareScreen = useRef((p: any) => {
    if (p.isSharing) {
      useCallStore.getState().setUserIdGhimmed(p.actionUserId);
    } else {
      const current = useCallStore.getState().action.userIdGhimmed;
      if (current === p.actionUserId) useCallStore.getState().setUserIdGhimmed("");
    }
  });
  const onBusy = useRef((p: any) => {
    const store = useCallStore.getState();
    const busyMember = store.members.find((m) => m.id === p.targetUserId);
    setBusyUser(busyMember?.fullname || "Người dùng");
    setTimeout(() => useCallStore.getState().eventCall("busy", p), 3000);
  });

  // Register socket listeners based on callMode to prevent cross-protocol
  // event handling. P2P and SFU use completely different signaling paths:
  //   P2P:  call:accepted → offer/answer negotiation, call:answer, call:candidate
  //   SFU:  signal → mediasoup transport/produce/consume pipeline
  // Registering both sets simultaneously was the root cause of media mapping bugs.
  useEffect(() => {
    if (!socket) return;

    // Always-on: shared events for both modes
    socket.on("call:end", onEnd.current);
    socket.on("call:member-joined", onMemberJoined.current);
    socket.on("call:share-screen", onShareScreen.current);
    socket.on("call:busy", onBusy.current);

    if (callMode === "p2p") {
      socket.on("call:accepted", onAccepted.current);
      socket.on("call:answer", onAnswer.current);
      socket.on("call:candidate", onCandidate.current);
    }

    if (callMode === "sfu") {
      socket.on("signal", onSignal.current);
    }

    return () => {
      socket.off("call:end", onEnd.current);
      socket.off("call:member-joined", onMemberJoined.current);
      socket.off("call:share-screen", onShareScreen.current);
      socket.off("call:busy", onBusy.current);

      if (callMode === "p2p") {
        socket.off("call:accepted", onAccepted.current);
        socket.off("call:answer", onAnswer.current);
        socket.off("call:candidate", onCandidate.current);
      }

      if (callMode === "sfu") {
        socket.off("signal", onSignal.current);
      }
    };
  }, [socket, callMode]);

  // update local and remote stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      }
    }
    remoteStreams.forEach((stream, key) => {
      const remoteVideoElement = remoteVideoRefs.current.get(key);
      if (remoteVideoElement && stream) {
        // Only re-assign if stream changed to avoid interrupting ongoing playback
        if (remoteVideoElement.srcObject !== stream) {
          remoteVideoElement.srcObject = stream;
          remoteVideoElement.play().catch(() => {});
        }
      }
    });
  }, [localStream, remoteStreams, callStatus]);

  // update call state
  useEffect(() => {
    if (!socket) return;
    (async () => {
      await updateCallState({
        roomId: searchParams.get("roomId") || "",
        status: searchParams.get("status") as
          | "idle"
          | "calling"
          | "incoming"
          | "ended"
          | "accepted"
          | "declined"
          | "joined",
        mode: searchParams.get("callType") as "audio" | "video",
        callMode: (searchParams.get("callMode") as "p2p" | "sfu") || "p2p",
        callId: searchParams.get("callId") || null,
        members: Helpers.decryptUserInfo(
          searchParams.get("members") || "[]",
        ) as CallMember[],
        action: {
          isMicEnabled: true,
          isCameraEnabled: searchParams.get("callType") === "video",
          isSpeakerphoneEnabled: false,
          duration: 0,
          startedAt: null,
          isSharingScreen: false,
          userIdGhimmed: "",
        },
        socket: socket,
      });
    })();
  }, [searchParams, socket]);

  useEffect(() => {
    if (!socket) return;
    if (
      callStatus === "incoming" ||
      callStatus === "calling" ||
      callStatus === "joined" ||
      callStatus === "accepted"
    ) {
      handleCreateLocalStream();
    }
    console.log("callStatus", callStatus);
  }, [callStatus, socket]);

  // Update audio output device - only on elements that already have a stream
  useEffect(() => {
    if (devices.selectedAudioOutput) {
      remoteVideoRefs.current.forEach((videoEl) => {
        if (videoEl && "setSinkId" in videoEl && videoEl.srcObject) {
          // @ts-ignore
          videoEl
            .setSinkId(devices.selectedAudioOutput)
            .catch((err: any) => console.error("Error setting sinkId:", err));
        }
      });
    }
  }, [devices.selectedAudioOutput, remoteStreams]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Close the window when the call ends. Must set hasEndedRef BEFORE closing
  // so that the beforeunload/pagehide handlers don't re-trigger endCall.
  // This is the single source of truth for window.close() — both the local
  // "End" button path and the remote "call:end" received path flow through here.
  useEffect(() => {
    if (callStatus === "ended") {
      hasEndedRef.current = true;
      window.opener && window.close();
    }
  }, [callStatus]);

  const handleEndCall = useCallback(() => {
    if (hasEndedRef.current) {
      return;
    }
    let status = "ended";
    const isCaller = searchParams.get("isCaller") === "true";
    // Clear video srcObject trước khi end call
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    remoteVideoRefs.current.forEach((videoRef) => {
      if (videoRef) {
        videoRef.srcObject = null;
      }
    });

    if (isCaller) {
      status = callStatus === "accepted" ? "ended" : "cancelled";
    } else {
      status = callStatus === "accepted" ? "ended" : "rejected";
    }

    hasEndedRef.current = true;

    endCall({
      roomId: roomId,
      actionUserId: currentUserId,
      status,
      callId: searchParams.get("callId") || "",
    });
  }, [callStatus, currentUserId, endCall, roomId, searchParams]);

  useEffect(() => {
    const handleWindowClose = () => {
      if (!hasEndedRef.current) {
        handleEndCall();
      }
    };

    window.addEventListener("beforeunload", handleWindowClose);
    window.addEventListener("pagehide", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
      window.removeEventListener("pagehide", handleWindowClose);
    };
  }, [handleEndCall]);

  // Note: in-page accept button has been removed. Receivers now go through
  // <IncomingCallModal /> in the main tab and the popup opens with
  // `status=joined` straight away — updateCallState's joined branch handles
  // the join flow (emit call:join → initSFU → emit signal join). No autoAccept
  // / handleAccept is needed here.

  const getUserInfo = useCallback((): {
    id: string;
    fullname: string;
    avatar: string;
  } => {
    const countMembers = members.length;
    if (countMembers === 2) {
      const user = members.find((m: CallMember) => m.id === currentUserId);
      if (user) {
        return {
          id: user.id,
          fullname: user.fullname,
          avatar: user.avatar,
        };
      }
      const unknownLabel = t("callPage.labels.unknown");
      return {
        id: "0",
        fullname: unknownLabel,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          unknownLabel,
        )}`,
      };
    }
    const groupLabel = t("callPage.labels.youAndOthers");
    return {
      id: "0",
      fullname: groupLabel,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        groupLabel,
      )}`,
    };
  }, [currentUserId, members, t]);

  const getUserInfoLabel = useCallback(() => {
    const countMembers = members.length;
    const isCaller =
      !!currentUserId &&
      members.some((m: CallMember) => m.id === currentUserId && m.is_caller);
    if (countMembers > 2) {
      if (isCaller) {
        return t("callPage.status.groupCaller", { count: countMembers - 1 });
      }
      return t("callPage.status.groupReceiver", { count: countMembers - 1 });
    }

    if (isCaller) {
      const callee = members.find(
        (m: CallMember) => m.id !== currentUserId && !m.is_caller,
      );
      return t("callPage.status.oneOnOneCaller", {
        name: callee?.fullname || t("callPage.labels.unknownUser"),
      });
    }

    const caller = members.find(
      (m: CallMember) => m.id !== currentUserId && m.is_caller,
    );
    return t("callPage.status.oneOnOneReceiver", {
      name: caller?.fullname || t("callPage.labels.unknownUser"),
    });
  }, [currentUserId, members, t]);

  // Helper function to get member info from stream key
  const getMemberFromStreamKey = (key: string): CallMember | null => {
    // Key format: `${roomId}-${actionUserId}`
    if (!roomId) return null;

    // Remove roomId prefix to get userId
    const userId = key.replace(`${roomId}-`, "");
    return members.find((m: CallMember) => m.id === userId) || null;
  };

  // Calculate grid layout based on number of streams
  const getGridLayout = (count: number) => {
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count === 3) return "grid-cols-2"; // 2 columns, 3rd row spans
    if (count === 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    return "grid-cols-4"; // 7+ streams
  };

  if (!isMounted) {
    return null;
  }

  if (!socket) {
    return (
      <div className="bg-dark h-screen w-full flex items-center justify-center">
        <p className="text-gray-500">{t("callPage.loading.connecting")}</p>
      </div>
    );
  }

  if (!members || callStatus === "idle" || callStatus === "joined") {
    return (
      <div className="bg-dark h-screen w-full flex items-center justify-center">
        <p className="text-gray-500">{t("callPage.loading.callInfo")}</p>
      </div>
    );
  }

  return (
    <div className="bg-dark h-screen w-full relative overflow-hidden">
      {/* Remote video (main view) */}
      <div className="absolute inset-0 bg-black">
        {mode === "video" && (remoteStreams.size > 0 || userIdGhimmed) ? (
          userIdGhimmed || remoteStreams.size === 1 ? (
            // Single stream - full screen (Pinned or only one remote)
            (() => {
              const key = userIdGhimmed
                ? `${roomId}-${userIdGhimmed}`
                : Array.from(remoteStreams.keys())[0];
              const stream = remoteStreams.get(key);
              const member = getMemberFromStreamKey(key);

              if (!stream)
                return (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-gray-500">
                      {t("callPage.loading.stream")}
                    </p>
                  </div>
                );

              const videoRef = (el: HTMLVideoElement | null) => {
                if (el) {
                  remoteVideoRefs.current.set(key, el);
                  // Assign srcObject immediately on mount so streams that arrived
                  // before this element was rendered are shown without waiting for
                  // the useEffect to re-run (which only fires when deps change).
                  if (stream && el.srcObject !== stream) {
                    el.srcObject = stream;
                    el.play().catch(() => {});
                  }
                } else {
                  remoteVideoRefs.current.delete(key);
                }
              };

              return (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain bg-black"
                    autoPlay
                    playsInline
                    muted={!isSpeakerphoneEnabled}
                    onClick={() =>
                      setUserIdGhimmed(userIdGhimmed ? "" : member?.id || "")
                    }
                  />
                  {/* User info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pointer-events-none">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member?.avatar}
                        name={member?.fullname || t("callPage.labels.unknown")}
                        className="w-10 h-10"
                      />
                      <span className="text-white text-lg font-semibold">
                        {member?.fullname || t("callPage.labels.unknownUser")}
                      </span>
                    </div>
                  </div>
                  {/* Audio indicator */}
                  {member && (
                    <div className="absolute top-4 left-4">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          stream.getAudioTracks().length > 0 &&
                          stream.getAudioTracks()[0].enabled
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            // Multiple streams - grid layout
            <div
              className={`w-full h-full grid ${getGridLayout(
                remoteStreams.size,
              )} gap-2 p-2`}
            >
              {Array.from(remoteStreams.entries()).map(([key, stream]) => {
                const member = getMemberFromStreamKey(key);
                const videoRef = (el: HTMLVideoElement | null) => {
                  if (el) {
                    remoteVideoRefs.current.set(key, el);
                    if (stream && el.srcObject !== stream) {
                      el.srcObject = stream;
                      el.play().catch(() => {});
                    }
                  } else {
                    remoteVideoRefs.current.delete(key);
                  }
                };

                return (
                  <div
                    key={key}
                    className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden min-h-0 cursor-pointer"
                    onClick={() => setUserIdGhimmed(member?.id || "")}
                  >
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted={!isSpeakerphoneEnabled}
                    />
                    {/* User info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pointer-events-none">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={member?.avatar}
                          name={
                            member?.fullname || t("callPage.labels.unknown")
                          }
                          className="w-6 h-6 text-xs"
                        />
                        <span className="text-white text-xs font-medium truncate">
                          {member?.fullname || t("callPage.labels.unknownUser")}
                        </span>
                      </div>
                    </div>
                    {/* Audio indicator */}
                    <div className="absolute top-2 left-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          stream.getAudioTracks().length > 0 &&
                          stream.getAudioTracks()[0].enabled
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : callStatus === "accepted" && remoteStreams.size === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <Avatar
              src={getUserInfo().avatar}
              name={getUserInfo().fullname}
              className="w-32 h-32 text-4xl"
            />
            <p className="text-gray-300 text-base">
              {t("callPage.status.waitingForOthers")}
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar
              src={getUserInfo().avatar}
              name={getUserInfo().fullname}
              className="w-32 h-32 text-4xl"
            />
          </div>
        )}
      </div>

      {/* Local video (picture-in-picture) - only show if there are remote streams */}
      {mode === "video" && localStream && remoteStreams.size > 0 && (
        <div className="absolute bottom-24 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg z-20">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
        </div>
      )}

      {/* Other remote streams when one is pinned */}
      {userIdGhimmed && remoteStreams.size > 1 && (
        <div className="absolute bottom-24 left-4 flex gap-2 z-20 overflow-x-auto max-w-[calc(100%-14rem)]">
          {Array.from(remoteStreams.entries()).map(([key, stream]) => {
            const member = getMemberFromStreamKey(key);
            if (member?.id === userIdGhimmed) return null;

            const videoRef = (el: HTMLVideoElement | null) => {
              if (el) {
                remoteVideoRefs.current.set(key, el);
                if (stream && el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play().catch(() => {});
                }
              } else {
                remoteVideoRefs.current.delete(key);
              }
            };

            return (
              <div
                key={key}
                className="w-32 h-24 rounded-lg overflow-hidden border border-white/50 bg-black cursor-pointer flex-shrink-0"
                onClick={() => setUserIdGhimmed(member?.id || "")}
              >
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted={!isSpeakerphoneEnabled}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Busy notification banner */}
      {busyUser && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-yellow-500 text-black px-6 py-3 rounded-full font-semibold shadow-lg text-sm whitespace-nowrap">
          {busyUser} đang bận — cuộc gọi sẽ tự đóng...
        </div>
      )}

      {/* Call info overlay */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center z-10">
        <h2 className="text-white text-xl font-semibold mb-1">
          {callStatus === "accepted"
            ? t("callPage.status.connected")
            : getUserInfoLabel()}
        </h2>
        {callStatus === "accepted" && (
          <p className="text-gray-300 text-sm">{formatDuration(duration)}</p>
        )}
      </div>

      {/* Control buttons */}
      {/*
        Note: the in-page "incoming" Y/N screen has been removed — accept/reject
        is now handled by <IncomingCallModal /> in the main tab BEFORE this
        window opens. The popup always lands on status='joined' (or 'calling'
        for caller / 'accepted' once member-joined arrives).
      */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10">
        <Button
          color={isMicEnabled ? "danger" : "default"}
              className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                isMicEnabled ? "bg-primary" : "bg-white/20"
              }`}
              onPress={() =>
                actionToggleTrack("mic", isMicEnabled ? false : true)
              }
              isIconOnly
            >
              <MicrophoneIcon className={`h-6 w-6 text-white`} />
            </Button>
            {mode === "video" && (
              <Button
                color={isCameraEnabled ? "default" : "danger"}
                className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                  isCameraEnabled ? "bg-primary" : "bg-white/20"
                }`}
                onPress={() =>
                  actionToggleTrack("video", isCameraEnabled ? false : true)
                }
                isIconOnly
              >
                {isCameraEnabled ? (
                  <VideoCameraIcon className="h-6 w-6 text-white" />
                ) : (
                  <VideoCameraSlashIcon className="h-6 w-6 text-white" />
                )}
              </Button>
            )}
            <Button
              color="danger"
              className="rounded-full h-14 w-14 p-0"
              onPress={handleEndCall}
              isIconOnly
            >
              <PhoneXMarkIcon className="h-7 w-7" />
            </Button>
            <Button
              color={isSpeakerphoneEnabled ? "default" : "danger"}
              className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                isSpeakerphoneEnabled ? "bg-primary" : "bg-white/20"
              }`}
              onPress={() =>
                actionToggleTrack("speaker", !isSpeakerphoneEnabled)
              }
              isIconOnly
            >
              {isSpeakerphoneEnabled ? (
                <SpeakerWaveIcon className="h-6 w-6 text-white" />
              ) : (
                <SpeakerXMarkIcon className="h-6 w-6 text-white" />
              )}
            </Button>
            {callStatus === "accepted" && (
              <Button
                color="default"
                className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                  isSharingScreen ? "bg-primary" : "bg-white/20"
                }`}
                onPress={() =>
                  actionToggleTrack("shareScreen", !isSharingScreen)
                }
                isIconOnly
              >
                <ComputerDesktopIcon className="h-6 w-6 text-white" />
              </Button>
            )}
            <Button
              isIconOnly
              className="rounded-full h-14 w-14 p-0 bg-white/20 backdrop-blur-sm"
              onPress={() => {
                getDevices();
                setIsSettingsOpen(true);
              }}
            >
              <Cog6ToothIcon className="h-6 w-6 text-white" />
            </Button>
      </div>

      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <ModalContent>
          <ModalHeader>{t("callPage.labels.deviceSettings")}</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Select
                label={t("callPage.labels.microphone")}
                selectedKeys={
                  devices.selectedAudioInput ? [devices.selectedAudioInput] : []
                }
                onChange={(e) => setDevice("audioInput", e.target.value)}
              >
                {devices.audioInputs.map((device) => (
                  <SelectItem key={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId}`}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label={t("callPage.labels.speaker")}
                selectedKeys={
                  devices.selectedAudioOutput
                    ? [devices.selectedAudioOutput]
                    : []
                }
                onChange={(e) => setDevice("audioOutput", e.target.value)}
              >
                {devices.audioOutputs.map((device) => (
                  <SelectItem key={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId}`}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label={t("callPage.labels.camera")}
                selectedKeys={
                  devices.selectedVideoInput ? [devices.selectedVideoInput] : []
                }
                onChange={(e) => setDevice("videoInput", e.target.value)}
              >
                {devices.videoInputs.map((device) => (
                  <SelectItem key={device.deviceId}>
                    {device.label || `Camera ${device.deviceId}`}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={() => setIsSettingsOpen(false)}>
              {t("callPage.labels.close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function CallPageContent() {
  return (
    <Suspense
      fallback={
        <div className="bg-dark h-screen w-full flex items-center justify-center">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      }
    >
      <CallPageContentInner />
    </Suspense>
  );
}

export default CallPageContent;
