import { create, UseBoundStore, StoreApi } from "zustand";
import { CallMember, CallState } from "./types/call.state";
import Helpers from "@/libs/helpers";
import useAuthStore from "./useAuthStore";
import { User } from "@/types/auth.type";

// Sub-stores — imported here for delegation.
// Circular dep (useP2pCallStore/useSfuCallStore import this file) is safe
// because both sides access each other only inside action closures, never
// at module initialization time.
import useP2pCallStore from "./useP2pCallStore";
import useSfuCallStore from "./useSfuCallStore";

// Module-level ref to the incoming call popup — persists across re-renders
let _openCallWindow: Window | null = null;
let _openTauriCallLabel: string | null = null;

// Single duration ticker so caller and all callees show identical elapsed time
// derived from the server-canonical startedAt (avoids per-client drift and
// duplicated setInterval accumulation).
let _durationTicker: ReturnType<typeof setInterval> | null = null;
function _startDurationTicker(set: (s: any) => void, getStartedAt: () => string | null) {
  if (_durationTicker) clearInterval(_durationTicker);
  const tick = () => {
    const startedAt = getStartedAt();
    if (!startedAt) return;
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
    );
    set((prev: any) => ({ action: { ...prev.action, duration: seconds } }));
  };
  tick();
  _durationTicker = setInterval(tick, 1000);
}
function _stopDurationTicker() {
  if (_durationTicker) {
    clearInterval(_durationTicker);
    _durationTicker = null;
  }
}

const CALL_ACTIVE_KEY = "appchat_call_active";

function _setCallActive(callId: string) {
  try {
    localStorage.setItem(CALL_ACTIVE_KEY, callId);
  } catch {}
}

function _clearCallActive() {
  try {
    localStorage.removeItem(CALL_ACTIVE_KEY);
  } catch {}
}

function _getActiveCallId(): string | null {
  try {
    return localStorage.getItem(CALL_ACTIVE_KEY);
  } catch {
    return null;
  }
}

function _isTauriRuntime() {
  if (typeof window === "undefined") return false;
  const tauriWindow = (window as any).__TAURI__?.window;
  return !!tauriWindow?.WebviewWindow;
}

async function _focusTauriCallWindow() {
  if (!_openTauriCallLabel) return false;
  try {
    const tauriWindow = (window as any).__TAURI__?.window;
    const existing = await tauriWindow?.WebviewWindow?.getByLabel?.(_openTauriCallLabel);
    if (existing) {
      await existing.setFocus?.();
      return true;
    }
    _openTauriCallLabel = null;
    return false;
  } catch {
    _openTauriCallLabel = null;
    return false;
  }
}

async function _openTauriCallWindow(url: string, label: string) {
  try {
    const tauriWindow = (window as any).__TAURI__?.window;
    if (!tauriWindow?.WebviewWindow) return false;

    const existing = await tauriWindow.WebviewWindow.getByLabel?.(label);
    if (existing) {
      _openTauriCallLabel = label;
      await existing.setFocus?.();
      return true;
    }

    const created = new tauriWindow.WebviewWindow(label, {
      url,
      title: "Call",
      width: 800,
      height: 600,
      center: true,
      focus: true,
      resizable: true,
    });

    _openTauriCallLabel = label;
    _setCallActive("pending");
    created.once?.("tauri://close-requested", () => {
      _openTauriCallLabel = null;
      _clearCallActive();
    });
    created.once?.("tauri://destroyed", () => {
      _openTauriCallLabel = null;
      _clearCallActive();
    });
    return true;
  } catch {
    _openTauriCallLabel = null;
    return false;
  }
}

const useCallStore: UseBoundStore<StoreApi<CallState>> = create<CallState>()((set, get) => ({
  roomId: null,
  status: "idle",
  mode: "audio",
  callMode: "p2p",
  members: [] as CallMember[],
  error: null,
  isWindowOpen: false,
  configPeerConnection: {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302"] },
      { urls: ["stun:stun1.l.google.com:19302"] },
      { urls: ["stun:stun2.l.google.com:19302"] },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:relay1.expressturn.com:3480",
        username: "000000002072254500",
        credential: "wLpXGwPdwl1qZ1YbdZDs8gJVfJA=",
      },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
    bundlePolicy: "balanced",
    rtcpMuxPolicy: "require",
  },
  stream: {
    localStream: null,
    remoteStreams: new Map<string, MediaStream>(),
    // peerConnections removed — lives in useP2pCallStore
  },
  // sfu removed — lives in useSfuCallStore
  // pendingCandidates removed — lives in useP2pCallStore
  action: {
    isMicEnabled: true,
    isCameraEnabled: false,
    isSpeakerphoneEnabled: true,
    duration: 0,
    startedAt: null,
    isSharingScreen: false,
    userIdGhimmed: "",
  },
  devices: {
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
    selectedAudioInput: "",
    selectedAudioOutput: "",
    selectedVideoInput: "",
  },
  socket: null,
  actionUserId: null,
  callId: null,
  answer: null,

  // ─── Window management ────────────────────────────────────────────────────

  openCall: (payload) => {
    const {
      roomId,
      mode,
      members,
      currentUser,
      socket,
      callMode = "p2p",
    } = payload;

    if (_openCallWindow && !_openCallWindow.closed) {
      _openCallWindow.focus();
      return;
    }
    if (_openTauriCallLabel) {
      void _focusTauriCallWindow();
      return;
    }
    if (_getActiveCallId()) {
      console.warn("[Call] Already in a call, ignoring openCall");
      return;
    }

    const memberMap = members.map((m: User) => ({
      id: m.id,
      fullname: m.fullname,
      avatar: m.avatar,
      is_caller: m.id == currentUser.id,
    }));
    const encodedMemberInfo = Helpers.enCryptUserInfo(memberMap);
    const callUrl = `/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${mode}&callMode=${callMode}&status=calling&isCaller=true`;

    if (_isTauriRuntime()) {
      void _openTauriCallWindow(callUrl, "appCallWindow_out");
      return;
    }

    _openCallWindow = window.open(
      callUrl,
      "appCallWindow_out",
      "width=800,height=600",
    );

    if (_openCallWindow) {
      _setCallActive("pending");
      const poll = setInterval(() => {
        if (!_openCallWindow || _openCallWindow.closed) {
          _clearCallActive();
          _openCallWindow = null;
          clearInterval(poll);
        }
      }, 1000);
    }
  },

  handleRequestCall: async (payload: any) => {
    const { roomId, members, callType, callId, callMode = "p2p", actionUserId } = payload;

    const alreadyInCall =
      (_openCallWindow && !_openCallWindow.closed) ||
      !!_openTauriCallLabel ||
      !!_getActiveCallId();
    if (alreadyInCall) {
      const socket = useCallStore.getState().socket;
      socket?.emit("call:busy", { callId, callerUserId: actionUserId });
      console.log("[Call] User is busy, auto-declining incoming call", callId);
      return;
    }

    const claimKey = `call_handled_${callId || "unknown"}`;
    const tryOpenWindow = () => {
      const claimTime = Number(localStorage.getItem(claimKey) || 0);
      if (Date.now() - claimTime < 60000) {
        if (_openCallWindow && !_openCallWindow.closed) {
          _openCallWindow.focus();
        } else if (_openTauriCallLabel) {
          void _focusTauriCallWindow();
        }
        return;
      }
      localStorage.setItem(claimKey, Date.now().toString());
      setTimeout(() => localStorage.removeItem(claimKey), 60000);

      const encodedMemberInfo = Helpers.enCryptUserInfo(members);
      const callUrl = `/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${callType}&callMode=${callMode}&status=incoming&callId=${callId}`;
      if (_isTauriRuntime()) {
        void _openTauriCallWindow(callUrl, "appCallWindow_inc");
        return;
      }

      _openCallWindow = window.open(
        callUrl,
        "appCallWindow_inc",
        "width=800,height=600",
      );

      if (_openCallWindow) {
        _setCallActive(callId || "pending");
        const poll = setInterval(() => {
          if (!_openCallWindow || _openCallWindow.closed) {
            _clearCallActive();
            _openCallWindow = null;
            clearInterval(poll);
          }
        }, 1000);
      }
    };

    if (typeof navigator !== "undefined" && navigator.locks) {
      navigator.locks
        .request(claimKey, { mode: "exclusive", ifAvailable: true }, async (lock) => {
          if (!lock) return;
          tryOpenWindow();
        })
        .catch(() => tryOpenWindow());
    } else {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
      tryOpenWindow();
    }
  },

  // ─── Call lifecycle ───────────────────────────────────────────────────────

  acceptCall: async (payload) => {
    const { roomId, members, currentUser, socket, callId } = payload;
    const actionUserId = currentUser.id;

    // SFU calls: join flow instead of P2P signaling
    if (get().callMode === "sfu") {
      await get().updateCallState({
        status: "joined",
        roomId,
        socket: socket ?? get().socket,
        callId,
        members,
        mode: get().mode,
        callMode: "sfu",
        action: get().action,
      });
      return;
    }

    // P2P path — guard against duplicate invocations
    if (get().status === "accepted") return;

    const membersNew = members.map((m: CallMember) => ({
      ...m,
      status: m.id === currentUser.id ? "started" : m.status,
    }));
    set({ status: "accepted", members: membersNew });
    Helpers.updateURLParams("status", "accepted");
    Helpers.updateURLParams("members", Helpers.enCryptUserInfo(membersNew));

    const otherMembers = membersNew.filter(
      (m: CallMember) => m.id !== currentUser.id,
    );
    for (const member of otherMembers) {
      const pc = await get().handleCreatePeerConnection(roomId, member.id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit("call:accepted", {
        membersIds: members.map((m: User) => m.id),
        actionUserId,
        roomId,
        targetUserId: member.id,
        offer: Helpers.enCryptUserInfo(offer),
        callId,
      });
    }
  },

  endCall: async (payload: any) => {
    const { roomId, actionUserId, status, callId } = payload;
    const socket = get().socket;

    // Stop all local tracks
    get().stream.localStream?.getTracks().forEach((track) => track.stop());
    // Stop all remote tracks
    get().stream.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });

    // Emit socket end event
    socket?.emit("call:end", {
      roomId,
      actionUserId,
      status,
      callId,
    });

    // Protocol-specific teardown
    if (get().callMode === "sfu") {
      useSfuCallStore.getState().teardownSfu();
    } else {
      useP2pCallStore.getState().teardownP2p();
    }

    _stopDurationTicker();

    set({
      status: "ended",
      roomId: null,
      stream: {
        localStream: null,
        remoteStreams: new Map<string, MediaStream>(),
      },
    });
    // window.close is handled by page.tsx useEffect watching callStatus
  },

  handleEndCall: (payload: any) => {
    const { roomId, actionUserId, members } = payload;
    const isCallerEnded = members.some(
      (m: CallMember) => m.is_caller && m.status === "ended",
    );

    if (members.length > 2 && !isCallerEnded) {
      // Multiple participants: only remove the user who left
      const key = `${roomId}-${actionUserId}`;

      const streamToRemove = get().stream.remoteStreams.get(key);
      if (streamToRemove) {
        streamToRemove.getTracks().forEach((track) => track.stop());
      }

      // Close P2P connection for this user (no-op for SFU)
      const pc = useP2pCallStore.getState().peerConnections.get(key);
      if (pc) pc.close();

      const newRemoteStreams = new Map(get().stream.remoteStreams);
      newRemoteStreams.delete(key);

      const newPeerConnections = new Map(useP2pCallStore.getState().peerConnections);
      newPeerConnections.delete(key);
      useP2pCallStore.setState({ peerConnections: newPeerConnections });

      set({
        stream: {
          ...get().stream,
          remoteStreams: newRemoteStreams,
        },
      });
      return;
    }

    // Full teardown
    get().stream.localStream?.getTracks().forEach((track) => track.stop());
    get().stream.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });

    // Protocol-specific teardown
    if (get().callMode === "sfu") {
      useSfuCallStore.getState().teardownSfu();
    } else {
      useP2pCallStore.getState().teardownP2p();
    }

    _stopDurationTicker();

    set({
      status: "ended",
      roomId: null,
      stream: {
        localStream: null,
        remoteStreams: new Map<string, MediaStream>(),
      },
    });
    // window.close is handled by page.tsx useEffect watching callStatus
  },

  // ─── Event dispatch hub ───────────────────────────────────────────────────
  // P2P-specific cases (accepted, answer, candidate) are delegated to useP2pCallStore.
  // SFU-specific cases go through handleSFUSignal → useSfuCallStore.

  eventCall: async (event: string, payload: any) => {
    const authStore = useAuthStore.getState();
    const currentUser = authStore.user;
    const status = get().status;
    if (!currentUser) {
      console.warn("[Call] User not authenticated, cannot handle call event");
      return;
    }

    if (!window.opener && event !== "request" && event !== "busy") {
      return;
    }

    const { actionUserId, answer, candidate, roomId, targetUserId } = payload;
    const socket = get().socket;

    switch (event) {
      case "request":
        if (window.opener) return;
        await get().handleRequestCall(payload);
        break;

      // ── P2P: caller receives callee's offer-accept + creates answer ──
      case "accepted":
        await useP2pCallStore.getState().handleAcceptCall(payload);
        break;

      // ── P2P: callee receives answer from caller ──
      case "answer": {
        if (status !== "accepted") {
          console.error("[P2P] Call not accepted, cannot handle answer event");
          return;
        }
        const key = `${roomId}-${actionUserId}`;
        const pc = useP2pCallStore.getState().peerConnections.get(key);
        if (!pc) {
          console.error("[P2P] Peer connection not found for answer");
          return;
        }

        if (pc.signalingState === "stable" && !pc.localDescription) {
          console.error("[P2P] Cannot set remote answer: stable but no local description");
          return;
        }
        if (pc.remoteDescription) {
          console.warn("[P2P] Remote description already set, skipping");
          await useP2pCallStore.getState().flushPendingCandidates(roomId, actionUserId);
          break;
        }

        try {
          const answerDescription = Helpers.decryptUserInfo(answer);
          await pc.setRemoteDescription(new RTCSessionDescription(answerDescription));
          await useP2pCallStore.getState().flushPendingCandidates(roomId, actionUserId);
        } catch (error) {
          console.error("[P2P] Error setting remote description (answer):", error);
          throw error;
        }
        break;
      }

      case "end":
        await get().handleEndCall(payload);
        break;

      // ── P2P: ICE candidate trickle ──
      case "candidate": {
        if (!candidate) break; // null = end-of-candidates marker
        const key = `${roomId}-${actionUserId}`;
        const iceCandidate = new RTCIceCandidate(candidate);
        const pc = useP2pCallStore.getState().peerConnections.get(key);
        const pcReady = pc && pc.signalingState !== "closed" && pc.remoteDescription;

        if (pcReady) {
          try {
            await pc.addIceCandidate(iceCandidate);
          } catch {
            // Ignore: PC may have closed between the check and the await
          }
        } else if (pc && pc.signalingState !== "closed") {
          // Queue until remoteDescription is set
          const pending = useP2pCallStore.getState().pendingCandidates;
          if (!pending.has(key)) pending.set(key, []);
          pending.get(key)!.push(iceCandidate);
        }
        break;
      }

      case "busy":
        set({ error: `${payload.targetUserId || "Người dùng"} đang bận` });
        get().endCall({
          roomId: get().roomId,
          actionUserId: useAuthStore.getState().user?.id,
          status: "cancelled",
          callId: get().callId || payload.callId,
        });
        break;

      // ── SFU: new participant joined ──
      case "member-joined":
        set({ members: payload.members });
        if (get().callMode === "sfu") {
          // Transition the initial caller from "calling" → "accepted".
          // Duration ticker is started in updateCallState at "calling" using the
          // canonical startedAt from BE so all clients stay in sync.
          if (get().status === "calling") {
            set({ status: "accepted" });
            Helpers.updateURLParams("status", "accepted");
          }

          const emitGetProducers = (attempt = 0) => {
            const { sfu: sfuNow } = useSfuCallStore.getState();
            const { roomId: r, socket: s } = get();
            if (sfuNow.recvTransport && sfuNow.device && r && s) {
              s.emit("signal", { type: "getProducers", roomId: r, target: "sfu" });
            } else if (attempt < 15) {
              setTimeout(() => emitGetProducers(attempt + 1), 300);
            }
          };
          setTimeout(() => emitGetProducers(), 500);
        }
        break;
    }
  },

  // ─── Delegation wrappers (P2P) ────────────────────────────────────────────

  handleCreatePeerConnection: async (roomId, actionUserId) => {
    return useP2pCallStore.getState().handleCreatePeerConnection(roomId, actionUserId);
  },

  handleAcceptCall: async (payload) => {
    return useP2pCallStore.getState().handleAcceptCall(payload);
  },

  flushPendingCandidates: async (roomId, actionUserId) => {
    return useP2pCallStore.getState().flushPendingCandidates(roomId, actionUserId);
  },

  // ─── Delegation wrappers (SFU) ────────────────────────────────────────────

  initSFU: async () => {
    return useSfuCallStore.getState().initSFU();
  },

  handleSFUSignal: async (payload) => {
    return useSfuCallStore.getState().handleSFUSignal(payload);
  },

  // ─── Local stream ─────────────────────────────────────────────────────────

  handleCreateLocalStream: async () => {
    if (get().stream.localStream) return;

    const currentState = get();
    const constraints: MediaStreamConstraints = {
      audio: currentState.devices.selectedAudioInput
        ? { deviceId: { exact: currentState.devices.selectedAudioInput } }
        : true,
      video:
        currentState.mode === "video"
          ? currentState.devices.selectedVideoInput
            ? { deviceId: { exact: currentState.devices.selectedVideoInput } }
            : true
          : false,
    };

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.error("[Call] getUserMedia not available (requires HTTPS or localhost)");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({ stream: { ...get().stream, localStream: stream } });

      // SFU: produce tracks if sendTransport is already ready
      if (get().callMode === "sfu") {
        await useSfuCallStore.getState().produceLocalStream(stream);
      }

      if (currentState.devices.audioInputs.length === 0) {
        await get().getDevices();
      }
    } catch (error) {
      console.error("[Call] Error creating local stream:", error);
    }
  },

  // ─── Screen sharing ───────────────────────────────────────────────────────

  handleShareScreen: async (value: boolean) => {
    const currentState = get();
    const roomId = currentState.roomId;
    const localStream = currentState.stream.localStream;
    const mode = currentState.mode;

    if (!roomId) {
      console.error("[Call] RoomId not found");
      return;
    }
    if (mode !== "video") {
      console.error("[Call] Screen sharing only available in video calls");
      return;
    }

    if (value) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        // Mix mic + system audio
        let mixedAudioTrack: MediaStreamTrack | null = null;
        const micTrack = localStream?.getAudioTracks()[0];
        if (micTrack && screenAudioTrack) {
          const audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();
          const micSource = audioContext.createMediaStreamSource(new MediaStream([micTrack]));
          const sysSource = audioContext.createMediaStreamSource(
            new MediaStream([screenAudioTrack]),
          );
          micSource.connect(destination);
          sysSource.connect(destination);
          mixedAudioTrack = destination.stream.getAudioTracks()[0];
        } else {
          mixedAudioTrack = screenAudioTrack || micTrack || null;
        }

        // Replace tracks — delegate to protocol-specific store
        if (get().callMode === "sfu") {
          const sfuStore = useSfuCallStore.getState();
          for (const producer of sfuStore.sfu.producers.values()) {
            if (producer.closed) continue;
            if (producer.kind === "video") {
              await producer.replaceTrack({ track: screenTrack });
            }
            if (producer.kind === "audio" && mixedAudioTrack) {
              await producer.replaceTrack({ track: mixedAudioTrack });
            }
          }
        } else {
          const replaceStream = new MediaStream([
            ...(mixedAudioTrack ? [mixedAudioTrack] : []),
            screenTrack,
          ]);
          await useP2pCallStore.getState().replaceTracksInPeers(replaceStream, "both");
        }

        screenTrack.onended = () => {
          get().actionToggleTrack("shareScreen", false);
        };

        const newLocalStream = new MediaStream();
        if (localStream) {
          localStream.getAudioTracks().forEach((t) => newLocalStream.addTrack(t));
        }
        newLocalStream.addTrack(screenTrack);

        set((prev) => ({
          ...prev,
          stream: { ...prev.stream, localStream: newLocalStream },
          action: { ...prev.action, isSharingScreen: true, isCameraEnabled: false },
        }));

        currentState.socket?.emit("call:share-screen", {
          roomId,
          actionUserId: useAuthStore.getState().user?.id,
          isSharing: true,
        });
      } catch (err) {
        console.error("[Call] User cancelled screen share or error:", err);
        set((prev) => ({
          ...prev,
          action: { ...prev.action, isSharingScreen: false },
        }));
      }
    } else {
      // Restore camera
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        const cameraTrack = cameraStream.getVideoTracks()[0];
        const micTrack = cameraStream.getAudioTracks()[0];

        // Replace tracks — delegate to protocol-specific store
        if (get().callMode === "sfu") {
          await useSfuCallStore.getState().replaceTracksInProducers(cameraStream);
        } else {
          await useP2pCallStore.getState().replaceTracksInPeers(cameraStream, "both");
        }

        const currentLocalStream = get().stream.localStream;
        currentLocalStream?.getVideoTracks().forEach((track) => {
          if (track.label.includes("screen") || track.label.includes("Screen")) {
            track.stop();
          }
        });

        set((prev) => ({
          ...prev,
          stream: { ...prev.stream, localStream: cameraStream },
          action: { ...prev.action, isSharingScreen: false, isCameraEnabled: true },
        }));

        currentState.socket?.emit("call:share-screen", {
          roomId,
          actionUserId: useAuthStore.getState().user?.id,
          isSharing: false,
        });
      } catch (err) {
        console.error("[Call] Error reverting to camera:", err);
        set((prev) => ({
          ...prev,
          action: { ...prev.action, isSharingScreen: false },
        }));
      }
    }
  },

  // ─── Track toggles ────────────────────────────────────────────────────────

  actionToggleTrack: async (action, value) => {
    const localStream = get().stream.localStream;
    if (!localStream && action !== "shareScreen") {
      console.error("[Call] Stream not created");
      return;
    }
    switch (action) {
      case "mic":
        localStream?.getAudioTracks().forEach((t) => { t.enabled = value; });
        set((prev) => ({ ...prev, action: { ...prev.action, isMicEnabled: value } }));
        break;
      case "video":
        localStream?.getVideoTracks().forEach((t) => { t.enabled = value; });
        set((prev) => ({ ...prev, action: { ...prev.action, isCameraEnabled: value } }));
        break;
      case "speaker":
        localStream?.getAudioTracks().forEach((t) => { t.enabled = value; });
        set((prev) => ({
          ...prev,
          action: { ...prev.action, isSpeakerphoneEnabled: value },
        }));
        break;
      case "shareScreen":
        await get().handleShareScreen(value);
        break;
    }
  },

  setUserIdGhimmed: (userId) => {
    set((prev) => ({ ...prev, action: { ...prev.action, userIdGhimmed: userId } }));
  },

  // ─── Device management ────────────────────────────────────────────────────

  getDevices: async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
      const videoInputs = devices.filter((d) => d.kind === "videoinput");

      set((prev) => ({
        ...prev,
        devices: {
          ...prev.devices,
          audioInputs,
          audioOutputs,
          videoInputs,
          selectedAudioInput:
            prev.devices.selectedAudioInput || audioInputs[0]?.deviceId || "",
          selectedAudioOutput:
            prev.devices.selectedAudioOutput || audioOutputs[0]?.deviceId || "",
          selectedVideoInput:
            prev.devices.selectedVideoInput || videoInputs[0]?.deviceId || "",
        },
      }));
    } catch (error) {
      console.error("[Call] Error getting devices:", error);
    }
  },

  setDevice: async (type, deviceId) => {
    set((prev) => ({
      ...prev,
      devices: {
        ...prev.devices,
        [type === "audioInput"
          ? "selectedAudioInput"
          : type === "audioOutput"
            ? "selectedAudioOutput"
            : "selectedVideoInput"]: deviceId,
      },
    }));

    if (type === "audioInput" || type === "videoInput") {
      const currentState = get();
      const currentStream = currentState.stream.localStream;
      if (!currentStream) return;

      currentStream.getTracks().forEach((t) => t.stop());

      const constraints = {
        audio: {
          deviceId: {
            exact:
              type === "audioInput" ? deviceId : currentState.devices.selectedAudioInput,
          },
        },
        video:
          currentState.mode === "video"
            ? {
                deviceId: {
                  exact:
                    type === "videoInput" ? deviceId : currentState.devices.selectedVideoInput,
                },
              }
            : false,
      };

      try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        set((prev) => ({ ...prev, stream: { ...prev.stream, localStream: newStream } }));

        // Delegate track replacement to the active protocol store
        if (get().callMode === "sfu") {
          await useSfuCallStore.getState().replaceTracksInProducers(newStream);
        } else {
          await useP2pCallStore.getState().replaceTracksInPeers(newStream, "both");
        }
      } catch (error) {
        console.error("[Call] Error switching device:", error);
      }
    }
  },

  // ─── Call state initialization ────────────────────────────────────────────

  updateCallState: async (state) => {
    const currentUser = useAuthStore.getState().user;
    const socket = state.socket;

    if (state.status === "accepted") {
      _startDurationTicker(set, () => get().action.startedAt);
      return () => _stopDurationTicker();
    }

    // Prevent status downgrade on socket reconnect
    const currentStatus = get().status;
    if (
      (currentStatus === "accepted" || currentStatus === "ended") &&
      (state.status === "incoming" || state.status === "calling" || state.status === "idle")
    ) {
      return;
    }

    const effectiveCallMode = state.callMode || get().callMode;
    let canonicalRoomId = state.roomId;
    let canonicalMembers: CallMember[] = state.members ?? [];
    let elapsedSeconds = 0;
    let canonicalStartedAt: string | null = get().action.startedAt;

    if (state.status === "joined" && socket) {
      set((prev) => ({ ...prev, socket: state.socket }));

      const joinCallId = (state as any).callId || get().callId;
      let joinHistory: any = null;

      if (joinCallId) {
        canonicalRoomId = await new Promise<string>((resolve) => {
          const fallback = setTimeout(() => resolve(state.roomId ?? ""), 3000);
          socket.emit(
            "call:join",
            { roomId: state.roomId, callId: joinCallId },
            (response: any) => {
              clearTimeout(fallback);
              if (response?.ok) joinHistory = response.history || null;
              resolve(
                response?.ok && response?.room?.room_id
                  ? response.room.room_id
                  : state.roomId,
              );
            },
          );
        });
      }

      if (joinHistory?.members?.length > 0) {
        canonicalMembers = joinHistory.members;
      }

      if (joinHistory?.started_at) {
        canonicalStartedAt = joinHistory.started_at;
        elapsedSeconds = Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(joinHistory.started_at).getTime()) / 1000,
          ),
        );
      }

      if (effectiveCallMode === "sfu") {
        await useSfuCallStore.getState().initSFU();
        socket?.emit("signal", {
          type: "join",
          roomId: canonicalRoomId,
          target: "sfu",
        });
      }

      if (effectiveCallMode === "p2p") {
        setTimeout(async () => {
          await get().acceptCall({
            roomId: canonicalRoomId,
            members: state.members,
            currentUser,
            socket: state.socket,
            callId: joinCallId,
          });
        }, 1000);
      }
    } else if (state.status === "calling" && socket) {
      if (effectiveCallMode === "sfu") {
        canonicalRoomId = await new Promise<string>((resolve) => {
          const fallback = setTimeout(() => resolve(state.roomId ?? ""), 3000);
          socket.emit(
            "call:request",
            {
              actionUserId: currentUser?.id || "",
              membersIds: state.members?.map((m: CallMember) => m.id) || [],
              roomId: state.roomId,
              callType: state.mode,
            },
            (response: any) => {
              clearTimeout(fallback);
              if (response?.startedAt) canonicalStartedAt = response.startedAt;
              resolve(
                response?.ok && response?.room?.room_id
                  ? response.room.room_id
                  : state.roomId ?? "",
              );
            },
          );
        });
        await useSfuCallStore.getState().initSFU();
        socket?.emit("signal", {
          type: "join",
          roomId: canonicalRoomId,
          target: "sfu",
        });
      } else {
        socket?.emit("call:request", {
          actionUserId: currentUser?.id || "",
          membersIds: state.members?.map((m: CallMember) => m.id) || [],
          roomId: state.roomId,
          callType: state.mode,
        });
      }
    }

    set((prev) => ({
      ...prev,
      ...state,
      roomId: canonicalRoomId,
      members: canonicalMembers,
      action: {
        ...prev.action,
        ...(state.action ?? {}),
        duration: elapsedSeconds,
        startedAt: canonicalStartedAt,
      },
      ...(state.status === "joined" ? { status: "accepted" } : {}),
    }));

    // Start the canonical duration ticker once we have a startedAt anchor.
    // Caller hits this on "calling" (after call:request resolves with startedAt);
    // callee hits this on "joined" (transitioned to accepted via line 1049).
    if (canonicalStartedAt && (state.status === "joined" || state.status === "calling")) {
      _startDurationTicker(set, () => get().action.startedAt);
    }
  },
}));

export default useCallStore;
