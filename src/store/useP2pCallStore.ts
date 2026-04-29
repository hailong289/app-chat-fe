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
  screenTransceivers: new Map(),
  remoteScreenTransceivers: new Map(),
  cameraSenders: new Map(),

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

    // Connection-state watchdog: when the remote peer closes their tab,
    // crashes, or hits a network blackhole, the BE's `call:end` emit on
    // socket disconnect may not reach us (also disconnected, or socket
    // server lost the room mapping). The WebRTC `connectionstatechange`
    // event still fires reliably as ICE detects the dead path. Treat
    // `failed` and `closed` as a definitive peer-gone signal and drive
    // the same end-call cleanup we'd do for an explicit `call:end`.
    // `disconnected` is intentionally NOT terminal — it's transient and
    // often recovers within a few seconds (brief network blip, Wi-Fi
    // handoff). Wait for it to escalate to `failed`.
    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== "failed" && pc.connectionState !== "closed") {
        return;
      }
      const callStore = useCallStore.getState();
      if (callStore.status !== "accepted") return;
      callStore.handleEndCall({
        roomId,
        actionUserId,
        members: callStore.members ?? [],
        callId: callStore.callId,
      });
    };

    // Add local audio + camera tracks. NO placeholder transceivers — Chromium
    // gets ambiguous matching when there are multiple same-kind transceivers
    // (e.g. two `video` m-lines, one camera + one screen placeholder), and
    // can swap or fail to deliver tracks to the receiver. Empirically this
    // showed up as remote video/audio never reaching the caller side even
    // though `setRemoteDescription` succeeded. Screen share takes the cost
    // of one renegotiation per toggle instead — see `replaceScreenTrackInPeers`.
    const localStream = stream.localStream;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
      localStream.getVideoTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStream);
        // Remember the camera sender so future toggles can find it even
        // after replaceTrack(null) (which makes `sender.track === null`
        // and breaks any kind-based lookup).
        const next = new Map(get().cameraSenders);
        next.set(key, sender);
        set({ cameraSenders: next });
      });
    }

    // Remote track received → camera/audio go to `remoteStreams`, screen
    // tracks go to `remoteScreenStreams`. Identification: it's a screen
    // track if (a) it's video, (b) the sender has already been flagged as
    // sharing in `peersSharingScreen` via `call:share-screen` socket event,
    // and (c) we already have a video track for this peer in remoteStreams
    // (so the new one is a second video → must be screen).
    //
    // Re-render rule: KEEP the existing MediaStream object reference for
    // each `key`. Mutate it in place (add new track, drop superseded
    // same-kind tracks) so any inline `<video ref={...}>` whose closure
    // captured the stream still points at the right object — re-binding
    // srcObject to a NEW stream every time would break that. To get React
    // to re-evaluate `stream.getVideoTracks().length`-style render checks,
    // we still emit a NEW Map on every event; the inner stream reference
    // is preserved.
    pc.ontrack = (event) => {
      useCallStore.setState((prev) => {
        const isScreenTrack =
          event.track.kind === "video" &&
          prev.peersSharingScreen.has(actionUserId) &&
          (prev.stream.remoteStreams.get(key)?.getVideoTracks().length ?? 0) > 0;

        if (isScreenTrack) {
          // Stash the receiver transceiver so subsequent share toggles
          // (sharer reuses same transceiver via replaceTrack — which
          // does NOT refire ontrack) can harvest receiver.track from
          // here. Stored in `remoteScreenTransceivers` (NOT
          // `screenTransceivers`) to avoid key collision with the
          // sender-side transceiver in 1-on-1 where both peers share.
          if (event.transceiver) {
            const next = new Map(get().remoteScreenTransceivers);
            next.set(key, event.transceiver);
            set({ remoteScreenTransceivers: next });
          }
          const existing = prev.stream.remoteScreenStreams.get(key);
          const target = existing ?? new MediaStream();
          if (!target.getTracks().includes(event.track)) {
            target.addTrack(event.track);
          }
          const newRemoteScreenStreams = new Map(prev.stream.remoteScreenStreams);
          newRemoteScreenStreams.set(key, target);
          return {
            stream: {
              ...prev.stream,
              remoteScreenStreams: newRemoteScreenStreams,
            },
          };
        }

        const existing = prev.stream.remoteStreams.get(key);
        const target = existing ?? new MediaStream();
        // Drop any prior tracks of the same kind — the new event.track
        // supersedes them. Then add the new one. Operates IN-PLACE on
        // the existing MediaStream so its identity is preserved.
        target.getTracks().forEach((t) => {
          if (t.kind === event.track.kind && t !== event.track) {
            target.removeTrack(t);
          }
        });
        if (!target.getTracks().includes(event.track)) {
          target.addTrack(event.track);
        }
        const newRemoteStreams = new Map(prev.stream.remoteStreams);
        newRemoteStreams.set(key, target);
        return { stream: { ...prev.stream, remoteStreams: newRemoteStreams } };
      });
    };

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

    // PC may already exist if this is a renegotiation (vd peer upgraded
    // from audio → video and re-emit call:accepted). In that case we don't
    // create a new PC — we just apply the new remote offer + create a
    // fresh answer to acknowledge the new tracks. payload.renegotiate is
    // the explicit hint, but we also accept a duplicate accept event as
    // re-offer when the PC is in `stable` state.
    const key = `${roomId}-${actionUserId}`;
    const existingPc = get().peerConnections.get(key);
    const isRenegotiation =
      !!existingPc && (payload.renegotiate === true || existingPc.signalingState === "stable");

    if (existingPc && !isRenegotiation) {
      console.warn(`[P2P] PC for ${actionUserId} already exists, skipping duplicate`);
      return;
    }

    const offerDescription = Helpers.decryptUserInfo(offer);
    const pc = existingPc ?? (await get().handleCreatePeerConnection(roomId, actionUserId));

    // Glare handling: if BOTH peers upgrade camera at the same moment, both
    // call createOffer + setLocalDescription → both PCs are in
    // `have-local-offer` when the other side's offer arrives. Without
    // rollback, `setRemoteDescription` throws InvalidStateError and the
    // upgrade silently fails on both sides (camera never maps).
    //
    // Perfect-negotiation pattern: the peer with the smaller userId is
    // "polite" — it rolls back its own pending offer and accepts the
    // remote one, then the renegotiation completes and the polite peer
    // re-offers its changes via the next replaceTrack/upgrade cycle. The
    // "impolite" peer ignores the incoming offer because its own outgoing
    // offer is already in flight and will be answered.
    const isGlare =
      isRenegotiation && pc.signalingState === "have-local-offer";
    if (isGlare) {
      const isPolite = (currentUser.id || "") < actionUserId;
      if (!isPolite) {
        console.warn(
          `[P2P] Glare detected, ignoring incoming renegotiation offer (impolite peer); ours wins`,
        );
        return;
      }
      // Polite: rollback our pending local offer first, then accept theirs.
      try {
        await pc.setLocalDescription({ type: "rollback" });
      } catch (err) {
        console.warn("[P2P] Glare rollback failed:", err);
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerCreated = await pc.createAnswer();
    await pc.setLocalDescription(answerCreated);

    socket?.emit("call:answer", {
      roomId,
      answer: Helpers.enCryptUserInfo(answerCreated),
      members: Helpers.enCryptUserInfo(members),
      targetUserId: actionUserId,
    });

    // Don't restart the duration ticker on a renegotiation (e.g. screen-share
    // toggle re-emits call:accepted). Reading `startedAt` from history.started_at
    // would reset duration to whatever it was at call start — fine for the
    // initial accept, but for a renegotiation the ticker is already running
    // and we'd just be re-anchoring it to the same value. Skip the work.
    if (!isRenegotiation) {
      // Anchor the duration ticker to the call's canonical `started_at` from
      // CallHistory so caller and callee show the same elapsed seconds (the
      // FE clock difference between the two devices doesn't matter — both
      // diff against the same server timestamp). Without this, the caller
      // never gets a startedAt and the timer was stuck at 00:00.
      //
      // Fallback to `Date.now()` if the BE didn't include `history` (e.g.
      // gRPC serialization edge case). Slight desync vs. callee but at
      // least the ticker counts up instead of staying at 00:00 forever.
      const startedAtFromBE = (
        payload as { history?: { started_at?: string | Date } }
      ).history?.started_at;
      const startedAtStr = startedAtFromBE
        ? new Date(startedAtFromBE).toISOString()
        : new Date().toISOString();
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAtStr).getTime()) / 1000),
      );

      // updateCallState's `state.status === "accepted"` branch starts the
      // duration ticker AND merges the action partial (so startedAt sticks).
      useCallStore.getState().updateCallState({
        status: "accepted",
        action: {
          ...useCallStore.getState().action,
          startedAt: startedAtStr,
          duration: elapsedSeconds,
        },
      });
      useCallStore.setState({ answer: Helpers.enCryptUserInfo(answerCreated) });
      Helpers.updateURLParams("status", "accepted");
      Helpers.updateURLParams("callId", callId);
    }
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
    const screenTransceivers = get().screenTransceivers;

    for (const [key, pc] of get().peerConnections.entries()) {
      const senders = pc.getSenders();
      // The screen transceiver shares the kind="video" with the camera one,
      // so a naive `senders.find(kind === "video")` could match either. Skip
      // the screen sender explicitly so camera-toggle / device-switch never
      // accidentally clobbers the screen track that is currently being shared.
      const screenSender = screenTransceivers.get(key)?.sender;

      if ((type === "audio" || type === "both") && audioTrack) {
        const audioSender = senders.find((s) => s.track?.kind === "audio");
        if (audioSender) await audioSender.replaceTrack(audioTrack);
      }

      if ((type === "video" || type === "both") && videoTrack) {
        const videoSender = senders.find(
          (s) => s.track?.kind === "video" && s !== screenSender,
        );
        if (videoSender) await videoSender.replaceTrack(videoTrack);
      }
    }
  },

  replaceScreenTrackInPeers: async (track) => {
    // No pre-allocated screen transceiver path (Chromium had ambiguous
    // matching with two video m-lines, breaking remote video). Instead,
    // addTransceiver(track) creates a 3rd m-line on demand when sharing
    // starts; replaceTrack(null) on it stops the stream when sharing ends.
    // Each toggle costs one offer/answer round-trip via call:accepted +
    // payload.renegotiate=true through the existing signaling path.
    const callStore = useCallStore.getState();
    const { socket, callId, roomId, members } = callStore;
    const peers = get().peerConnections;
    const newScreenTransceivers = new Map(get().screenTransceivers);

    for (const [key, pc] of peers) {
      if (pc.signalingState === "closed") continue;

      const existing = get().screenTransceivers.get(key);
      try {
        if (track) {
          if (existing) {
            // Already have a transceiver from a previous share — reuse it.
            await existing.sender.replaceTrack(track);
          } else {
            const transceiver = pc.addTransceiver(track);
            newScreenTransceivers.set(key, transceiver);
          }
        } else if (existing) {
          await existing.sender.replaceTrack(null);
        }

        // Renegotiate so the new SDP reaches the peer. Old offer/answer
        // path: emit call:accepted with renegotiate=true; receiver applies
        // it via existing handleAcceptCall renegotiation branch.
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const targetUserId = key.split("-")[1] || key;
        socket?.emit("call:accepted", {
          roomId,
          targetUserId,
          offer: Helpers.enCryptUserInfo(offer),
          callId,
          members,
          renegotiate: true,
        });
      } catch (err) {
        console.warn(`[P2P] replaceScreenTrack failed for ${key}:`, err);
      }
    }

    set({ screenTransceivers: newScreenTransceivers });
  },

  teardownP2p: () => {
    get().peerConnections.forEach((pc) => {
      if (pc.signalingState !== "closed") pc.close();
    });
    set({
      peerConnections: new Map(),
      pendingCandidates: new Map(),
      screenTransceivers: new Map(),
      remoteScreenTransceivers: new Map(),
      cameraSenders: new Map(),
    });
  },
}));

export default useP2pCallStore;
