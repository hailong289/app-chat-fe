import { User } from "@/types/auth.type";
import { Socket } from "socket.io-client";


export interface CallMember {
  id: string;
  fullname: string;
  avatar: string;
  is_caller: boolean;
  status:  | 'initiated'
  | 'started'
  | 'pending'
  | 'accepted'
  | 'cancelled' // người gọi đã hủy cuộc gọi
  | 'rejected' // người nhận đã từ chối cuộc gọi
  | 'missed' // người nhận đã bỏ qua cuộc gọi
  | 'ended' // người nhận hoặc người gọi đã kết thúc cuộc gọi
  | 'joined'; // người nhận đã tham gia cuộc gọi
}

export interface CallState {
  roomId: string | null;
  status: 'idle' | 'calling' | 'incoming' | 'ended' | 'accepted' | 'declined' | 'joined'; // idle: không có cuộc gọi, calling: người gọi, incoming: người bị gọi, ended: kết thúc cuộc gọi, accepted: đã chấp nhận cuộc gọi, declined: đã từ chối cuộc gọi, joined: đã tham gia cuộc gọi
  mode: 'audio' | 'video'; // audio: audio, video: video only
  members: CallMember[];
  error: string | null;
  isWindowOpen: boolean;
  configPeerConnection: {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize: number;
    iceTransportPolicy: 'all' | 'public' | 'relay';
    bundlePolicy: 'max-bundle' | 'max-compat' | 'balanced';
    rtcpMuxPolicy: 'negotiate' | 'require';
  };
  stream: {
    localStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
    peerConnections: Map<string, RTCPeerConnection>;
  };
  pendingCandidates: Map<string, RTCIceCandidate[]>;
  action: {
    isMicEnabled: boolean; // true: mic on, false: mic off
    isCameraEnabled: boolean; // true: camera on, false: camera off
    isSpeakerphoneEnabled: boolean; // true: speakerphone on, false: speakerphone off
    duration: number; // thời gian gọi
    isSharingScreen: boolean; // true: share screen on, false: share screen off
  };
  socket: Socket | null;
  actionUserId: string | null;
  answer: string | null;
  openCall: (data: any) => void;
  endCall: (data: any) => void;
  eventCall: (event: string, payload: any) => Promise<void>;
  acceptCall: (data: any) => void;
  handleCreateLocalStream: () => void;
  handleCreatePeerConnection: (roomId: string, actionUserId: string) => Promise<RTCPeerConnection>;
  updateCallState: (state: Partial<CallState>) => void;
  flushPendingCandidates: (roomId: string, actionUserId: string) => Promise<void>;
  actionToggleTrack: (action: 'mic' | 'video' | 'speaker' | 'shareScreen', value: boolean) => Promise<void>;
  handleEndCall: (data: any) => void;
  handleRequestCall: (data: any) => void;
  handleAcceptCall: (data: any) => void;
  handleShareScreen: (value: boolean) => Promise<void>;
}

