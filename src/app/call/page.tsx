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
  const { socket } = useSocket("/chat");
  const [isMounted, setIsMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hasEndedRef = useRef(false);
  const {
    status: callStatus,
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
    acceptCall,
    updateCallState,
    eventCall,
    actionToggleTrack,
    endCall,
    setUserIdGhimmed,
    getDevices,
    setDevice,
  } = useCallStore();

  // handle socket event
  useEffect(() => {
    socket?.on("call:accepted", (payload: any) =>
      eventCall("accepted", payload),
    );
    // socket?.on("call:start", (payload: any) => eventCall("start", payload));
    socket?.on("call:answer", (payload: any) => eventCall("answer", payload));
    socket?.on("call:candidate", (payload: any) =>
      eventCall("candidate", payload),
    );
    socket?.on("call:end", (payload: any) => eventCall("end", payload));

    socket?.on("call:share-screen", (payload: any) => {
      if (payload.isSharing) {
        setUserIdGhimmed(payload.actionUserId);
      } else {
        const currentPinned = useCallStore.getState().action.userIdGhimmed;
        if (currentPinned === payload.actionUserId) {
          setUserIdGhimmed("");
        }
      }
    });

    return () => {
      socket?.off("call:accepted", (payload: any) =>
        eventCall("accepted", payload),
      );
      // socket?.off("call:start", (payload: any) => eventCall("start", payload));
      socket?.off("call:candidate", (payload: any) =>
        eventCall("candidate", payload),
      );
      socket?.off("call:answer", (payload: any) =>
        eventCall("answer", payload),
      );
      socket?.off("call:end", (payload: any) => eventCall("end", payload));
      socket?.off("call:share-screen");
    };
  }, [socket]);

  // update local and remote stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
    remoteStreams.forEach((stream, key) => {
      const remoteVideoElement = remoteVideoRefs.current.get(key);
      if (remoteVideoElement && stream) {
        // Chỉ set lại nếu stream khác với stream hiện tại để tránh nháy màn hình
        if (remoteVideoElement.srcObject !== stream) {
          remoteVideoElement.srcObject = stream;
        }
      }
    });
  }, [localStream, remoteStreams]);

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
          | "declined",
        mode: searchParams.get("callType") as "audio" | "video",
        members: Helpers.decryptUserInfo(
          searchParams.get("members") || "[]",
        ) as CallMember[],
        action: {
          isMicEnabled: true,
          isCameraEnabled: searchParams.get("callType") === "video",
          isSpeakerphoneEnabled: true,
          duration: 0,
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
      callStatus === "joined"
    ) {
      handleCreateLocalStream();
    }
    console.log("callStatus", callStatus);
  }, [callStatus, socket]);

  // Update audio output device
  useEffect(() => {
    if (devices.selectedAudioOutput) {
      remoteVideoRefs.current.forEach((videoEl) => {
        if (videoEl && "setSinkId" in videoEl) {
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

  const handleAccept = () => {
    acceptCall({
      callId: searchParams.get("callId") || "",
      currentUser: currentUser,
      members: members,
      roomId: roomId,
      socket,
    });
  };

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
                  if (el.srcObject !== stream) el.srcObject = stream;
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
                    if (el.srcObject !== stream) el.srcObject = stream;
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
                if (el.srcObject !== stream) el.srcObject = stream;
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
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10">
        {callStatus === "incoming" ? (
          <>
            <Button
              color="danger"
              className="rounded-full h-14 w-14 p-0"
              onPress={handleEndCall}
              isIconOnly
            >
              <PhoneXMarkIcon className="h-7 w-7" />
            </Button>
            <Button
              color="success"
              className="rounded-full h-14 w-14 p-0"
              onPress={handleAccept}
              isIconOnly
            >
              <PhoneXMarkIcon className="h-7 w-7 rotate-135" />
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
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
