import { create, UseBoundStore, StoreApi } from "zustand";
import { P2pState } from "./types/call-p2p.state";
import { CallMember } from "./types/call.state";
import Helpers from "@/libs/helpers";
import useAuthStore from "./useAuthStore";

// Circular import is safe: useP2pCallStore is imported by useCallStore,
// and useP2pCallStore imports useCallStore. Both access each other only
// inside action closures (not at module initialization time), so by the
// time any action runs all modules are fully initialized.
import useCallStore from "./useCallStore";

const useP2pCallStore: UseBoundStore<StoreApi<P2pState>> = create<P2pState>()((set, get) => ({
  peerConnections: new Map(),
  pendingCandidates: new Map(),

  handleCreatePeerConnection: async (roomId, actionUserId) => {
    const key = `${roomId}-${actionUserId}`;

    // Return existing connection if already created
    if (get().peerConnections.has(key)) {
      return get().peerConnections.get(key)!;
    }

    const { socket, configPeerConnection, stream } = useCallStore.getState();
    const pc = new RTCPeerConnection(configPeerConnection as RTCConfiguration);

    // Forward ICE candidates to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("call:candidate", {
          candidate: event.candidate,
          roomId,
          actionUserId,
        });
      }
    };

    // Remote track received → write to coordinator's remoteStreams
    pc.ontrack = (event) => {
      useCallStore.setState((prev) => {
        if (prev.stream.remoteStreams.has(key)) return prev; // already set
        const newRemoteStreams = new Map(prev.stream.remoteStreams);
        newRemoteStreams.set(key, event.streams[0]);
        return { stream: { ...prev.stream, remoteStreams: newRemoteStreams } };
      });
    };

    // Add local tracks to peer connection
    const localStream = stream.localStream;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    const newPeerConnections = new Map(get().peerConnections);
    newPeerConnections.set(key, pc);
    set({ peerConnections: newPeerConnections });

    return pc;
  },

  handleAcceptCall: async (payload) => {
    const { roomId, offer, members, actionUserId, callId } = payload;
    const socket = useCallStore.getState().socket;
    const currentUser = useAuthStore.getState().user;

    if (!currentUser) {
      console.error("[P2P] User not authenticated, cannot handle call");
      return;
    }

    const userInCall = members.find((m: CallMember) => m.id === currentUser.id);
    if (!userInCall) {
      console.error("[P2P] Current user not found in members, skipping handleAcceptCall");
      return;
    }

    // Guard: PC already exists → duplicate event (listener accumulation)
    if (get().peerConnections.has(`${roomId}-${actionUserId}`)) {
      console.warn(`[P2P] PC for ${actionUserId} already exists, skipping duplicate`);
      return;
    }

    const offerDescription = Helpers.decryptUserInfo(offer);
    const pc = await get().handleCreatePeerConnection(roomId, actionUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerCreated = await pc.createAnswer();
    await pc.setLocalDescription(answerCreated);

    socket?.emit("call:answer", {
      roomId,
      answer: Helpers.enCryptUserInfo(answerCreated),
      members: Helpers.enCryptUserInfo(members),
      targetUserId: actionUserId,
    });

    // Write result back to coordinator
    useCallStore.setState({
      status: "accepted",
      answer: Helpers.enCryptUserInfo(answerCreated),
    });
    Helpers.updateURLParams("status", "accepted");
    Helpers.updateURLParams("callId", callId);
  },

  flushPendingCandidates: async (roomId, actionUserId) => {
    if (!window.opener) return;
    const key = `${roomId}-${actionUserId}`;
    const pendingCandidates = get().pendingCandidates.get(key) || [];
    const pc = get().peerConnections.get(key);
    if (!pc || pendingCandidates.length === 0) return;

    console.log(`[P2P] Flushing ${pendingCandidates.length} pending ICE candidates`);
    for (const candidate of pendingCandidates) {
      if (pc.signalingState === "closed") break;
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error("[P2P] Error adding queued ICE candidate:", err);
      }
    }
    get().pendingCandidates.delete(key);
  },

  replaceTracksInPeers: async (newStream, type = "both") => {
    const audioTrack = newStream.getAudioTracks()[0];
    const videoTrack = newStream.getVideoTracks()[0];

    for (const [, pc] of get().peerConnections.entries()) {
      const senders = pc.getSenders();

      if ((type === "audio" || type === "both") && audioTrack) {
        const audioSender = senders.find((s) => s.track?.kind === "audio");
        if (audioSender) await audioSender.replaceTrack(audioTrack);
      }

      if ((type === "video" || type === "both") && videoTrack) {
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender) await videoSender.replaceTrack(videoTrack);
      }
    }
  },

  teardownP2p: () => {
    get().peerConnections.forEach((pc) => {
      if (pc.signalingState !== "closed") pc.close();
    });
    set({
      peerConnections: new Map(),
      pendingCandidates: new Map(),
    });
  },
}));

export default useP2pCallStore;
