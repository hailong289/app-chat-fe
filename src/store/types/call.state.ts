import { User } from "@/types/auth.type";
import { Socket } from "socket.io-client";


export interface CallState {
  roomId: string | null;
  status: 'idle' | 'calling' | 'incoming' | 'ended' | 'accepted' | 'declined'; // idle: không có cuộc gọi, calling: người gọi, incoming: người bị gọi, ended: kết thúc cuộc gọi, accepted: đã chấp nhận cuộc gọi, declined: đã từ chối cuộc gọi
  mode: 'audio' | 'video'; // audio: audio, video: video
  userInfo: User | null;
  error: string | null;
  isWindowOpen: boolean;
  iceServers: RTCIceServer[];
  stream: {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    instanceStream: MediaStream | null;
  };
  peerConnection: RTCPeerConnection | null;
  pendingCandidates: Map<string, RTCIceCandidate[]>;
  startCall: (data: any) => void;
  eventCall: (event: string, payload: any) => Promise<void>;
  acceptCall: (data: any) => void;
  openWindowCall: () => void;
  closeWindowCall: () => void;
  handleCreateLocalStream: () => void;
  handleCreateOffer: (data: any) => void;
  handleReceiveOffer: (data: any) => Promise<void>;
  handleCreatePeerConnection: (roomId: string, socket: Socket) => Promise<RTCPeerConnection>;
  updateStatus: (status: 'idle' | 'calling' | 'incoming' | 'ended' | 'accepted' | 'declined') => void;
  flushPendingCandidates: (roomId: string) => Promise<void>;
}

