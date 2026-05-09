export interface P2pState {
  peerConnections: Map<string, RTCPeerConnection>;
  pendingCandidates: Map<string, RTCIceCandidate[]>;
  /**
   * Pre-allocated 3rd video transceiver (m-line index 2) per peer, reserved
   * for screen sharing. Created up-front in handleCreatePeerConnection so the
   * SDP has 3 video lines from the very first offer (audio + camera + screen).
   * Sharing is then `transceiver.sender.replaceTrack(screenTrack)` — zero
   * renegotiation. Stop sharing is `replaceTrack(null)`.
   */
  screenTransceivers: Map<string, RTCRtpTransceiver>;
  /**
   * RECEIVER-side counterpart of `screenTransceivers`. Stores the
   * transceiver that `pc.ontrack` fired with for the peer's screen
   * track, so subsequent share toggles (sharer reuses the same
   * transceiver via replaceTrack — which does NOT refire ontrack on
   * the receiver) can harvest the still-live `receiver.track` and
   * re-add it to remoteScreenStreams.
   *
   * Why a SEPARATE Map (instead of reusing screenTransceivers): in
   * P2P where both peers share, each PC ends up with TWO screen
   * transceivers under the same peer key — one our-side sender (from
   * our `addTransceiver`) and one peer-side receiver (from SDP). Same-
   * Map storage would let one overwrite the other, breaking either
   * stop-own-share (Tx.sender becomes the wrong instance) or
   * harvest-remote-share (Tx.receiver becomes the wrong instance)
   * depending on order of operations.
   */
  remoteScreenTransceivers: Map<string, RTCRtpTransceiver>;
  /**
   * The camera RTCRtpSender created (or to be created) for each peer. We
   * track it explicitly because once the user toggles camera OFF we
   * `replaceTrack(null)` on this sender, which leaves `sender.track === null`
   * — that breaks any subsequent `pc.getSenders().find(s => s.track?.kind === "video")`
   * lookup. Without this map, turning the camera back on while screen sharing
   * created a second video sender alongside the screen one and the new
   * camera track never reached the remote peer.
   */
  cameraSenders: Map<string, RTCRtpSender>;
  handleCreatePeerConnection: (roomId: string, actionUserId: string) => Promise<RTCPeerConnection>;
  handleAcceptCall: (payload: any) => Promise<void>;
  flushPendingCandidates: (roomId: string, actionUserId: string) => Promise<void>;
  replaceTracksInPeers: (
    newStream: MediaStream,
    type?: "audio" | "video" | "both",
  ) => Promise<void>;
  /** Replace the screen track on every peer's pre-allocated screen transceiver. */
  replaceScreenTrackInPeers: (track: MediaStreamTrack | null) => Promise<void>;
  teardownP2p: () => void;
}
