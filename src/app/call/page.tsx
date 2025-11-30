"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Avatar } from "@heroui/react";
import {
  MicrophoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/solid";
import { useSocket } from "@/components/providers/SocketProvider";
import useAuthStore from "@/store/useAuthStore";
import Helpers from "@/libs/helpers";
import useCallStore from "@/store/useCallStore";
import { User } from "@/types/auth.type";

function CallPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket } = useSocket();
  const currentUser = useAuthStore((state) => state.user);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const { 
    endCall, 
    acceptCall,
    status: callStatus, 
    openWindowCall,
    closeWindowCall,
    isWindowOpen,
    handleCreateOffer,
    handleReceiveOffer,
    updateStatus,
    stream: { localStream, remoteStream },
  } = useCallStore();

  const [form, setForm] = useState<{
    roomId: string;
    isIncoming: boolean;
    isVideo: boolean;
    userInfo: User;
    duration: number;
    isActive: boolean;
    action: {
      isMuted: boolean;
      isVideoEnabled: boolean;
      isSpeakerEnabled: boolean;
    };
  }>({
    roomId: searchParams.get("roomId") || "",
    isIncoming: searchParams.get("status") === "incoming", // idle: không có cuộc gọi, calling: người gọi, incoming: người bị gọi, ended: kết thúc cuộc gọi, accepted: đã chấp nhận cuộc gọi, declined: đã từ chối cuộc gọi
    isVideo: searchParams.get("callType") === "video", // true: video, false: audio
    userInfo: Helpers.decryptUserInfo(
      searchParams.get("userInfo") || "{}"
    ),
    duration: 0, // thời gian gọi
    isActive: searchParams.get("status") === "accepted", // true: active, false: inactive
    action: {
      isMuted: false,
      isVideoEnabled: true,
      isSpeakerEnabled: true,
    },
  });

  // Update video streams
  useEffect(() => {
    if (isWindowOpen) {
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream, isWindowOpen]);

  // Update status
  useEffect(() => {
    updateStatus(searchParams.get("status") as 'idle' | 'calling' | 'incoming' | 'ended' | 'accepted' | 'declined');
  }, [searchParams]);

  useEffect(() => {
    console.log("callStatus", callStatus, isWindowOpen);
    if (!isWindowOpen || !socket) return;
    if (callStatus === 'ended') {
      window.close();
    } else if (callStatus === 'accepted') {
      // khi cuộc gọi đã được chấp nhận, tăng thời gian gọi lên 1 giây
      setForm((prev) => ({ ...prev, isActive: true }));
    } else if (callStatus === 'incoming') {
      handleReceiveOffer(searchParams.get("offer") || "", form.roomId, socket);
    } else if (callStatus === 'calling') {
      console.log("calling", currentUser?.id, form.userInfo?.id, form.roomId, form.isVideo ? 'video' : 'audio', form.userInfo, socket);
      handleCreateOffer({
        callerId: currentUser?.id,
        calleeId: form.userInfo?.id,
        roomId: form.roomId,
        callType: form.isVideo ? 'video' : 'audio',
        callee: form.userInfo,
        socket,
      });
    }
  }, [callStatus, socket]);

  useEffect(() => {
    openWindowCall();
    return () => {
      closeWindowCall();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    // kết thúc cuộc gọi
    const callerId = form.isIncoming ? form.userInfo?.id : currentUser?.id;
    const calleeId = form.isIncoming ? currentUser?.id : form.userInfo?.id;
    console.log("form", form, callerId, calleeId);
    endCall({
      roomId: form.roomId,
      callerId: callerId,
      calleeId: calleeId,
      callback: () => {
        socket?.emit('call:end', {
          roomId: form.roomId,
          callerId: callerId,
          calleeId: calleeId,
          status: 'ended',
        });
      },
    });
  };

  const handleAccept = () => {
    acceptCall({
      roomId: form.roomId,
      callerId: form.userInfo?.id,
      calleeId: currentUser?.id,
      callType: form.isVideo ? 'video' : 'audio',
      socket,
    });
  };

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = form.action.isMuted;
    });
    setForm((prev) => ({ ...prev, action: { ...prev.action, isMuted: !prev.action.isMuted } }));
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = form.action.isVideoEnabled;
    });
    setForm((prev) => ({ ...prev, action: { ...prev.action, isVideoEnabled: !prev.action.isVideoEnabled } }));
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = form.action.isSpeakerEnabled;
    }
    setForm((prev) => ({ ...prev, action: { ...prev.action, isSpeakerEnabled: !prev.action.isSpeakerEnabled } }));
  };

  if (!socket) {
    return (
      <div className="bg-dark h-screen w-full flex items-center justify-center">
        <p className="text-gray-500">Đang kết nối...</p>
      </div>
    );
  }

  if (!form.userInfo) {
    return (
      <div className="bg-dark h-screen w-full flex items-center justify-center">
        <p className="text-gray-500">Đang tải thông tin cuộc gọi...</p>
      </div>
    );
  }

  return (
    <div className="bg-dark h-screen w-full relative overflow-hidden">
      {/* Remote video (main view) */}
      <div className="absolute inset-0 bg-black">
        {form.isVideo && (
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted={!form.action.isSpeakerEnabled}
          />
        )}
        {(!form.isVideo || !remoteStream) && (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar
              src={form.userInfo.avatar}
              name={form.userInfo.fullname}
              className="w-32 h-32 text-4xl"
            />
          </div>
        )}
      </div>

      {/* Local video (picture-in-picture) */}
      {form.isVideo && form.isActive && localStream && (
        <div className="absolute bottom-24 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
        </div>
      )}

      {/* Call info overlay */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center z-10">
        <h2 className="text-white text-xl font-semibold mb-1">
          {callStatus === 'accepted'
            ? `Đã kết nối`
            : form.isIncoming
            ? `Bạn đang nhận cuộc gọi từ ${form.userInfo.fullname}`
            : `Bạn đang gọi đến ${form.userInfo.fullname}`}
        </h2>
        <p className="text-gray-300 text-sm">
          {form.isActive ? formatDuration(form.duration) : ""}
        </p>
      </div>

      {/* Control buttons */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10">
        {form.isIncoming && !form.isActive ? (
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
              color={form.action.isMuted ? "danger" : "default"}
              className="rounded-full h-14 w-14 p-0 bg-white/20 backdrop-blur-sm"
              onPress={toggleMute}
              isIconOnly
            >
              <MicrophoneIcon className="h-6 w-6 text-white" />
            </Button>
            {form.isVideo && (
              <Button
                color={form.action.isVideoEnabled ? "default" : "danger"}
                className="rounded-full h-14 w-14 p-0 bg-white/20 backdrop-blur-sm"
                onPress={toggleVideo}
                isIconOnly
              >
                {form.action.isVideoEnabled ? (
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
              color={form.action.isSpeakerEnabled ? "default" : "danger"}
              className="rounded-full h-14 w-14 p-0 bg-white/20 backdrop-blur-sm"
              onPress={toggleSpeaker}
              isIconOnly
            >
              {form.action.isSpeakerEnabled ? (
                <SpeakerWaveIcon className="h-6 w-6 text-white" />
              ) : (
                <SpeakerXMarkIcon className="h-6 w-6 text-white" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default CallPageContent;
