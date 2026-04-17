export interface P2pState {
  peerConnections: Map<string, RTCPeerConnection>;
  pendingCandidates: Map<string, RTCIceCandidate[]>;
  handleCreatePeerConnection: (roomId: string, actionUserId: string) => Promise<RTCPeerConnection>;
  handleAcceptCall: (payload: any) => Promise<void>;
  flushPendingCandidates: (roomId: string, actionUserId: string) => Promise<void>;
  replaceTracksInPeers: (
    newStream: MediaStream,
    type?: "audio" | "video" | "both",
  ) => Promise<void>;
  teardownP2p: () => void;
}
