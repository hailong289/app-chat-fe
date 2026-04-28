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

/**
 * Payload kept in memory while the IncomingCallModal is showing — driven by
 * `call:request` socket event, cleared on accept / reject / timeout.
 */
export interface IncomingCallPayload {
  callId: string;
  roomId: string;
  callType: "audio" | "video";
  callMode: "p2p" | "sfu";
  members: CallMember[];
  /** ULID of the caller — used to display the right avatar/name in the modal. */
  actionUserId: string;
  /** ms epoch when the request arrived — for timeout calculation. */
  receivedAt: number;
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
    /** Local screen-share capture (null when not sharing). */
    localScreenStream: MediaStream | null;
    /** Remote screen-share streams keyed by `${roomId}-${userId}`. */
    remoteScreenStreams: Map<string, MediaStream>;
  };
  /**
   * userIds currently broadcasting their screen. Driven by `call:share-screen`
   * socket event. UI gates "show big screen view" rendering on this — relying
   * on stream presence alone is unreliable (P2P pre-allocates the transceiver
   * so the receiver's screen track exists from the start, just muted).
   */
  peersSharingScreen: Set<string>;
  action: {
    isMicEnabled: boolean;
    isCameraEnabled: boolean;
    isSpeakerphoneEnabled: boolean;
    duration: number;
    startedAt: string | null;
    isSharingScreen: boolean;
    userIdGhimmed: string;
    /**
     * userId of the SCREEN-share owner currently pinned as main view.
     * Mutually exclusive with `userIdGhimmed` (camera pin) — setting one
     * clears the other in the action setters.
     *
     * Empty string ("") = no explicit screen pin → main view falls back
     * to the existing precedence: own localScreenStream → first remote
     * sharer → camera grid.
     *
     * Use case: in a call where multiple people share simultaneously
     * (e.g. you AND a peer), without this the main view would always be
     * your own share (or the first arbitrary sharer); clicking a peer's
     * screen tile in the strip had no way to swap it to main.
     */
    screenSharerIdGhimmed: string;
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

  /** Showing IncomingCallModal — null means modal is closed. */
  incomingCall: IncomingCallPayload | null;

  /**
   * Showing the WaitingCallBanner — a SECONDARY incoming call that arrived
   * while the user is already in another call. Distinct from `incomingCall`
   * (the full IncomingCallModal for free users) because the UX is different:
   * the banner is a small toast that lets the user accept (auto-end current
   * + join new) or reject without disrupting the active call's popup.
   *
   * Null = no waiting call.
   */
  waitingCall: IncomingCallPayload | null;

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
  /** User clicked "Chấp nhận" on the IncomingCallModal — opens /call window. */
  acceptIncomingCall: () => void;
  /** User clicked "Từ chối" on the IncomingCallModal — emits call:end status='rejected'. */
  rejectIncomingCall: () => void;
  /** Auto-decline after timeout — emits call:end status='missed'. */
  missIncomingCall: () => void;

  /**
   * Accept the waiting (secondary) call: end the current active call, then
   * promote `waitingCall` into `incomingCall` and trigger acceptIncomingCall.
   * In the popup window, this navigates the popup to the new call URL
   * (since the popup IS the active call's window).
   */
  acceptWaitingCall: () => void;
  /** Reject the waiting call — emits call:end status='rejected'. */
  rejectWaitingCall: () => void;
  /** Auto-decline after 30s — emits call:end status='missed'. */
  missWaitingCall: () => void;
  /** Caller cancelled the secondary call — silently dismiss the banner. */
  clearWaitingCall: () => void;
  /** Caller cancelled before user picked up — just close the modal silently. */
  clearIncomingCall: () => void;
  // Delegates to useP2pCallStore
  handleAcceptCall: (data: any) => void;
  handleShareScreen: (value: boolean) => Promise<void>;
  /** Audio → video upgrade: add a video track mid-call and produce/renegotiate. */
  upgradeToVideo: () => Promise<void>;
  setUserIdGhimmed: (userId: string) => void;
  /**
   * Pin a screen-share owner's screen as the main view. Pass "" to clear.
   * Setting a non-empty value also clears `userIdGhimmed` so the two pin
   * modes don't conflict.
   */
  setScreenSharerIdGhimmed: (userId: string) => void;
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
