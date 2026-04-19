import { Socket } from "socket.io-client";

// Re-export sub-store types for convenience
export type { P2pState } from "./call-p2p.state";
export type { SfuSessionState, SfuStoreState } from "./call-sfu.state";

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
    | "joined";
  mode: "audio" | "video";
  callMode: "p2p" | "sfu";
  members: CallMember[];
  error: string | null;
  isWindowOpen: boolean;
  // RTCPeerConnection config — read by useP2pCallStore via useCallStore.getState()
  configPeerConnection: {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize: number;
    iceTransportPolicy: "all" | "public" | "relay";
    bundlePolicy: "max-bundle" | "max-compat" | "balanced";
    rtcpMuxPolicy: "negotiate" | "require";
  };
  // Coordinator stream: only localStream + remoteStreams (render source of truth)
  // peerConnections → useP2pCallStore; sfu.* → useSfuCallStore
  stream: {
    localStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
  };
  action: {
    isMicEnabled: boolean;
    isCameraEnabled: boolean;
    isSpeakerphoneEnabled: boolean;
    duration: number;
    startedAt: string | null;
    isSharingScreen: boolean;
    userIdGhimmed: string;
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

  // Actions
  openCall: (data: any) => void;
  endCall: (data: any) => void;
  eventCall: (event: string, payload: any) => Promise<void>;
  acceptCall: (data: any) => void;
  handleCreateLocalStream: () => void;
  // Delegates to useP2pCallStore
  handleCreatePeerConnection: (
    roomId: string,
    actionUserId: string,
  ) => Promise<RTCPeerConnection>;
  updateCallState: (state: Partial<CallState>) => void;
  // Delegates to useP2pCallStore
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
  // Delegates to useP2pCallStore
  handleAcceptCall: (data: any) => void;
  handleShareScreen: (value: boolean) => Promise<void>;
  setUserIdGhimmed: (userId: string) => void;
  getDevices: () => Promise<void>;
  setDevice: (
    type: "audioInput" | "audioOutput" | "videoInput",
    deviceId: string,
  ) => Promise<void>;
  // Delegates to useSfuCallStore
  initSFU: () => Promise<void>;
  // Delegates to useSfuCallStore
  handleSFUSignal: (payload: any) => Promise<void>;
}
