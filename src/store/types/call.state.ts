import { User } from "@/types/auth.type";
import { is } from "date-fns/locale";
import { Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

export interface CallMember {
  id: string;
  user_id?: string;
  fullname: string;
  avatar: string;
  is_caller: boolean;
  status:
    | "initiated"
    | "started"
    | "pending"
    | "accepted"
    | "cancelled" // người gọi đã hủy cuộc gọi
    | "rejected" // người nhận đã từ chối cuộc gọi
    | "missed" // người nhận đã bỏ qua cuộc gọi
    | "ended" // người nhận hoặc người gọi đã kết thúc cuộc gọi
    | "joined"; // người nhận đã tham gia cuộc gọi
}

export interface CallState {
  roomId: string | null;
  status:
    | "idle"
    | "calling"
    | "incoming"
    | "ended"
    | "accepted"
    | "declined"
    | "joined"; // idle: không có cuộc gọi, calling: người gọi, incoming: người bị gọi, ended: kết thúc cuộc gọi, accepted: đã chấp nhận cuộc gọi, declined: đã từ chối cuộc gọi, joined: đã tham gia cuộc gọi
  mode: "audio" | "video"; // audio: audio, video: video only
  callMode: "p2p" | "sfu"; // p2p: direct connection (1-1), sfu: server-routed (groups)
  members: CallMember[];
  error: string | null;
  isWindowOpen: boolean;
  configPeerConnection: {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize: number;
    iceTransportPolicy: "all" | "public" | "relay";
    bundlePolicy: "max-bundle" | "max-compat" | "balanced";
    rtcpMuxPolicy: "negotiate" | "require";
  };
  stream: {
    localStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
    peerConnections: Map<string, RTCPeerConnection>;
  };
  sfu?: {
    device: mediasoupClient.types.Device | null;
    sendTransport: mediasoupClient.types.Transport | null;
    recvTransport: mediasoupClient.types.Transport | null;
    producers: Map<string, mediasoupClient.types.Producer>;
    consumers: Map<string, mediasoupClient.types.Consumer>;
    // Callbacks waiting for produce:me ack so transport.produce() can resolve
    pendingProduceCallbacks: Map<string, (params: { id: string }) => void>;
  };
  pendingCandidates: Map<string, RTCIceCandidate[]>;
  action: {
    isMicEnabled: boolean; // true: mic on, false: mic off
    isCameraEnabled: boolean; // true: camera on, false: camera off
    isSpeakerphoneEnabled: boolean; // true: speakerphone on, false: speakerphone off
    duration: number; // thời gian gọi
    isSharingScreen: boolean; // true: share screen on, false: share screen off
    userIdGhimmed: string; // true: ghim cuộc gọi, false: không ghim
  };
  socket: Socket | null;
  devices: {
    audioInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    selectedAudioInput: string;
    selectedAudioOutput: string;
    selectedVideoInput: string;
  };
  actionUserId: string | null;
  callId: string | null;
  answer: string | null;
  openCall: (data: any) => void;
  endCall: (data: any) => void;
  eventCall: (event: string, payload: any) => Promise<void>;
  acceptCall: (data: any) => void;
  handleCreateLocalStream: () => void;
  handleCreatePeerConnection: (
    roomId: string,
    actionUserId: string,
  ) => Promise<RTCPeerConnection>;
  updateCallState: (state: Partial<CallState>) => void;
  flushPendingCandidates: (
    roomId: string,
    actionUserId: string,
  ) => Promise<void>;
  actionToggleTrack: (
    action: "mic" | "video" | "speaker" | "shareScreen",
    value: boolean,
  ) => Promise<void>;
  handleEndCall: (data: any) => void;
  handleRequestCall: (data: any) => void;
  handleAcceptCall: (data: any) => void;
  handleShareScreen: (value: boolean) => Promise<void>;
  setUserIdGhimmed: (userId: string) => void;
  getDevices: () => Promise<void>;
  setDevice: (
    type: "audioInput" | "audioOutput" | "videoInput",
    deviceId: string,
  ) => Promise<void>;
  initSFU: () => Promise<void>;
  handleSFUSignal: (payload: any) => Promise<void>;
}
