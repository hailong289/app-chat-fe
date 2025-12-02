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
  ComputerDesktopIcon,
} from "@heroicons/react/24/solid";
import { useSocket } from "@/components/providers/SocketProvider";
import useAuthStore from "@/store/useAuthStore";
import Helpers from "@/libs/helpers";
import useCallStore from "@/store/useCallStore";

function CallPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket } = useSocket();
  const currentUser = useAuthStore((state) => state.user);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const { 
    status: callStatus, 
    stream: { localStream, remoteStream },
    action: { isMicEnabled, isCameraEnabled, isSpeakerphoneEnabled, duration, isSharingScreen },
    mode,
    userInfo,
    roomId,
    acceptCall,
    handleCreateOffer,
    handleReceiveOffer,
    updateCallState,
    eventCall,
    actionToggleTrack,
    endCall,
  } = useCallStore();

  // handle socket event
  useEffect(() => {
    socket?.on("call:candidate", (payload: any) => eventCall("candidate", payload));
    socket?.on("call:answer", (payload: any) => eventCall("answer", payload));
    return () => {
      socket?.off("call:candidate", (payload: any) => eventCall("candidate", payload));
      socket?.off("call:answer", (payload: any) => eventCall("answer", payload));
    }
  }, [socket]);

  useEffect(() => {
    // Hàm xử lý khi đóng window
    const handleWindowClose = () => {
        // Gọi hàm dọn dẹp
        alert("Đóng window");
        handleEndCall();
    };

    // 1. Lắng nghe sự kiện pagehide (được khuyến nghị thay cho unload)
    window.addEventListener('pagehide', handleWindowClose);
    
    // 2. Lắng nghe thêm unload để chắc chắn (cho các trình duyệt cũ)
    window.addEventListener('unload', handleWindowClose);

    feat(call): Implement robust termination on window close and refactor ending logic
    return () => {
        handleWindowClose();
        window.removeEventListener('pagehide', handleWindowClose);
        window.removeEventListener('unload', handleWindowClose);
    };
}, []);

  // update local and remote stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("localStream", localStream, localVideoRef.current);
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      console.log("remoteStream", remoteStream, remoteVideoRef.current);
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  // update call state
  useEffect(() => {
    updateCallState({
      roomId: searchParams.get("roomId") || "",
      status: searchParams.get("status") as 'idle' | 'calling' | 'incoming' | 'ended' | 'accepted' | 'declined',
      mode: searchParams.get("callType") as 'audio' | 'video',
      userInfo: Helpers.decryptUserInfo(
        searchParams.get("userInfo") || "{}"
      ),
      action: {
        isMicEnabled: true,
        isCameraEnabled: searchParams.get("callType") === "video",
        isSpeakerphoneEnabled: true,
        duration: 0,
        isSharingScreen: false,
      },
    });
  }, [searchParams]);

  useEffect(() => {
    const handle = async () => {
      if (!socket) return;
      if (callStatus === 'incoming' && roomId && searchParams.get("offer")) {
        await handleReceiveOffer({
          offer: searchParams.get("offer"),
          roomId: roomId,
          socket,
          callType: mode === 'video' ? 'video' : 'audio',
        });
      } else if (callStatus === 'calling') {
        await handleCreateOffer({
          callerId: currentUser?.id,
          calleeId: userInfo?.id,
          roomId: roomId,
          callType: mode === 'video' ? 'video' : 'audio',
          callee: userInfo,
          socket,
        });
      }
    }
    handle();
  }, [callStatus, socket]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    // kết thúc cuộc gọi
    const callerId = callStatus === 'incoming' ? userInfo?.id : currentUser?.id;
    const calleeId = callStatus === 'incoming' ? currentUser?.id : userInfo?.id;
    console.log("callerId", callerId, calleeId);
    
    // Clear video srcObject trước khi end call
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    endCall({
      roomId: roomId,
      callerId: callerId,
      calleeId: calleeId,
      status: 'ended',
      socket,
    });
  };

  const handleAccept = () => {
    acceptCall({
      roomId: roomId,
      callerId: userInfo?.id,
      calleeId: currentUser?.id,
      callType: mode === 'video' ? 'video' : 'audio',
      socket,
    });
  };

  if (!socket) {
    return (
      <div className="bg-dark h-screen w-full flex items-center justify-center">
        <p className="text-gray-500">Đang kết nối...</p>
      </div>
    );
  }

  if (!userInfo || callStatus === 'idle') {
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
        {mode === 'video' && remoteStream && (
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted={!isSpeakerphoneEnabled}
          />
        )}
        {(!(mode === 'video') || !remoteStream) && (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar
              src={userInfo.avatar}
              name={userInfo.fullname}
              className="w-32 h-32 text-4xl"
            />
          </div>
        )}
      </div>

      {/* Local video (picture-in-picture) */}
      {(mode === 'video') && localStream && (
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
            : callStatus === 'incoming'
            ? `Bạn đang nhận cuộc gọi từ ${userInfo.fullname}`
            : `Bạn đang gọi đến ${userInfo.fullname}`}
        </h2>
        {
          callStatus === 'accepted' && (
            <p className="text-gray-300 text-sm">
              {formatDuration(duration)}
            </p>
          )
        }
      </div>

      {/* Control buttons */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10">
        {callStatus === 'incoming' ? (
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
              className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${isMicEnabled ? 'bg-primary' : 'bg-white/20'}`}
              onPress={() => actionToggleTrack('mic', isMicEnabled ? false : true)}
              isIconOnly
            >
              <MicrophoneIcon className={`h-6 w-6 text-white`} />
            </Button>
            {mode === 'video' && (
              <Button
                color={isCameraEnabled ? "default" : "danger"}
                className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${isCameraEnabled ? 'bg-primary' : 'bg-white/20'}`}
                onPress={() => actionToggleTrack('video', isCameraEnabled ? false : true)}
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
              className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${isSpeakerphoneEnabled ? 'bg-primary' : 'bg-white/20'}`}
              onPress={() => actionToggleTrack('speaker', !isSpeakerphoneEnabled)}
              isIconOnly
            >
              {isSpeakerphoneEnabled ? (
                <SpeakerWaveIcon className="h-6 w-6 text-white" />
              ) : (
                <SpeakerXMarkIcon className="h-6 w-6 text-white" />
              )}
            </Button>
            {
              callStatus === 'accepted' && (
                <Button
                  color="default"
                  className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${isSharingScreen ? 'bg-primary' : 'bg-white/20'}`}
                  onPress={() => actionToggleTrack('shareScreen', !isSharingScreen)}
                  isIconOnly
                >
                  <ComputerDesktopIcon className="h-6 w-6 text-white" />
                </Button>
              )
            }
          </>
        )}
      </div>
    </div>
  );
}

export default CallPageContent;
