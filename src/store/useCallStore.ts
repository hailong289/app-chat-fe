import { create, UseBoundStore, StoreApi } from "zustand";
import { CallMember, CallState } from "./types/call.state";
import Helpers from "@/libs/helpers";
import { isTauriRuntime } from "@/libs/helpers";
import useAuthStore from "./useAuthStore";
import {
  buildGuestUserFromSession,
  getGuestCallMeta,
  getGuestCallToken,
  isGuestCallSupportedMode,
  isGuestSfuCallMode,
  clearGuestCallSession,
  shouldSkipAuthenticatedApis,
} from "@/libs/guest-call-auth";
import { tokenStorage } from "@/utils/tokenStorage";
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

// Mutex for camera upgrade. Two rapid clicks (or a StrictMode double-invoke)
// would otherwise fire two concurrent getUserMedia({video}) calls — one
// captures the device, the other times out with `AbortError: Timeout
// starting video source`. Coalesce by reusing the in-flight promise.
let _upgradeVideoInFlight: Promise<void> | null = null;

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

/** Poll until recv transport is ready, then pull existing SFU producers. */
function _scheduleSfuGetProducers(delayMs = 0) {
  const emitGetProducers = (attempt = 0) => {
    const { sfu: sfuNow } = useSfuCallStore.getState();
    const { roomId, socket, callId } = useCallStore.getState();
    if (sfuNow.recvTransport && sfuNow.device && roomId && socket) {
      socket.emit("signal", {
        type: "getProducers",
        roomId,
        callId: callId ?? undefined,
        target: "sfu",
      });
      return;
    }
    if (attempt === 8 && roomId && socket && sfuNow.device && !sfuNow.recvTransport) {
      socket.emit("signal", { type: "join", roomId, callId: callId ?? undefined, target: "sfu" });
    }
    if (attempt < 25) {
      setTimeout(() => emitGetProducers(attempt + 1), 120);
    }
  };
  if (delayMs <= 0) {
    emitGetProducers();
  } else {
    setTimeout(() => emitGetProducers(), delayMs);
  }
}

/** Prevent duplicate guest/late-join SFU bootstrap (React StrictMode). */
let _sfuJoinBootstrapPromise: Promise<void> | null = null;

/** Auth user id or guest session id — used for call socket payloads. */
function getCallActorUserId(): string | undefined {
  return (
    useAuthStore.getState().user?.id ?? buildGuestUserFromSession()?.id ?? undefined
  );
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
    const raw = localStorage.getItem(CALL_ACTIVE_KEY);
    return raw && raw !== "pending" ? raw : null;
  } catch {
    return null;
  }
}

/** Resolved call id from localStorage (excludes stale "pending" placeholder). */
export function getStoredActiveCallId(): string | null {
  return _getActiveCallId();
}

function _isTauriRuntime() {
  return isTauriRuntime();
}

async function _getTauriWebviewWindowApi(): Promise<{
  getByLabel: (label: string) => Promise<any>;
  create: (label: string, options: Record<string, any>) => any;
} | null> {
  try {
    // Tauri v2 official API path.
    const webview = await import("@tauri-apps/api/webviewWindow");
    if (webview?.WebviewWindow) {
      return {
        getByLabel: (label: string) => webview.WebviewWindow.getByLabel(label),
        create: (label: string, options: Record<string, any>) =>
          new webview.WebviewWindow(label, options),
      };
    }
  } catch {}

  try {
    // Fallback for builds relying on global injection.
    const tauriWindow = (window as any).__TAURI__?.window;
    if (tauriWindow?.WebviewWindow) {
      return {
        getByLabel: (label: string) => tauriWindow.WebviewWindow.getByLabel(label),
        create: (label: string, options: Record<string, any>) =>
          new tauriWindow.WebviewWindow(label, options),
      };
    }
  } catch {}

  return null;
}

async function _focusTauriCallWindow() {
  if (!_openTauriCallLabel) return false;
  try {
    const webviewApi = await _getTauriWebviewWindowApi();
    if (!webviewApi) return false;
    const existing = await webviewApi.getByLabel(_openTauriCallLabel);
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
    const webviewApi = await _getTauriWebviewWindowApi();
    if (!webviewApi) return false;

    const existing = await webviewApi.getByLabel(label);
    if (existing) {
      _openTauriCallLabel = label;
      await existing.setFocus?.();
      return true;
    }

    const created = webviewApi.create(label, {
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
        urls: "stun:stun.relay.metered.ca:80",
      },
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
      {
        urls: "turn:jp.relay.metered.ca:80",
        username: "dd552a2f5dca99f4e390e0cc",
        credential: "/K8NuOaoQsL91LMT",
      },
      {
        urls: "turn:jp.relay.metered.ca:80?transport=tcp",
        username: "dd552a2f5dca99f4e390e0cc",
        credential: "/K8NuOaoQsL91LMT",
      },
      {
        urls: "turn:jp.relay.metered.ca:443",
        username: "dd552a2f5dca99f4e390e0cc",
        credential: "/K8NuOaoQsL91LMT",
      },
      {
        urls: "turns:jp.relay.metered.ca:443?transport=tcp",
        username: "dd552a2f5dca99f4e390e0cc",
        credential: "/K8NuOaoQsL91LMT",
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
    localScreenStream: null,
    remoteScreenStreams: new Map<string, MediaStream>(),
    // peerConnections removed — lives in useP2pCallStore
  },
  peersSharingScreen: new Set<string>(),
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
    screenSharerIdGhimmed: "",
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
  incomingCall: null,

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
    // No FE-level localStorage check here. Source of truth for "user is
    // already in a call" lives on the BE: handleCallRequest runs
    // validateInCallOrClearStale against Redis USER_IN_CALL + DB and
    // returns `caller_already_in_call` if so. Doing a localStorage check
    // here would just create stale-claim bugs — popup crashes (browser
    // killed, OS restart, etc.) leave CALL_ACTIVE_KEY set without any
    // live window/tauri ref, blocking new calls until manual cleanup.
    // The only thing FE still owns is the live popup/tauri ref check
    // above (prevents duplicate popup per browser tab).

    // Defensive: if the caller didn't pass `currentUser` (or store
    // hadn't hydrated yet), is_caller would crash on null. Bail
    // instead of opening a half-broken call window.
    if (!currentUser?.id) {
      console.warn("[openCall] missing currentUser, aborting");
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

    // Detect a truly active call. We can't trust localStorage in isolation —
    // a previous popup may have crashed without clearing CALL_ACTIVE_KEY,
    // leaving a stale callId that would block all future incoming calls.
    // localStorage is only meaningful when there's also a live window/tauri
    // ref OR an in-progress modal in this tab.
    const hasOpenPopup =
      (_openCallWindow && !_openCallWindow.closed) || !!_openTauriCallLabel;
    const hasActiveModal = !!useCallStore.getState().incomingCall;
    const staleClaim = !hasOpenPopup && !!_getActiveCallId();
    if (staleClaim) {
      console.warn(
        "[Call] Clearing stale CALL_ACTIVE_KEY (no live popup detected)",
      );
      _clearCallActive();
    }

    // `window.opener` is non-null when this code runs in the call popup
    // window — the popup IS an active call by definition, so any incoming
    // request is a secondary call.
    const isPopupContext =
      typeof window !== "undefined" && !!window.opener;
    const alreadyInCall = hasOpenPopup || hasActiveModal || isPopupContext;
    if (alreadyInCall) {
      // Secondary incoming call while user is busy — fire a Web
      // Notification. Click → end current call + switch to new call.
      // Auto-miss after 30s is handled server-side (Bull queue) so we
      // don't need a FE timer.
      console.log("[Call] Busy — sending Notification for", callId, payload);
      try {
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const caller =
            (members as any[])?.find((m) => m.is_caller) ||
            (members as any[])?.find((m) => m.id === actionUserId) ||
            (members as any[])?.[0];
          const callerName = caller?.fullname || "Người dùng";
          const isVideo = callType === "video";
          const isGroup = (members as any[])?.length > 2;
          const title = isGroup
            ? "Cuộc gọi nhóm đang chờ"
            : "Cuộc gọi đang chờ";
          const body = `${callerName} đang gọi ${
            isVideo ? "video" : "thoại"
          } — bấm để chuyển sang`;
          const notif = new Notification(title, {
            body,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/badge-72x72.png",
            tag: `waiting-call-${callId}`,
            requireInteraction: false,
          });

          notif.onclick = () => {
            try {
              window.focus();
              notif.close();

              const state = useCallStore.getState();
              const sock = state.socket;
              const myId = useAuthStore.getState().user?.id;

              if (isPopupContext) {
                // Đang ở popup window — popup này CHÍNH LÀ active call.
                // End current + navigate same window sang call mới.
                if (state.callId && state.roomId) {
                  sock?.emit("call:end", {
                    roomId: state.roomId,
                    actionUserId: myId,
                    status: "ended",
                    callId: state.callId,
                  });
                }
                const encoded = Helpers.enCryptUserInfo(members);
                window.location.href =
                  `/call?roomId=${roomId}` +
                  `&members=${encoded}` +
                  `&callType=${callType}` +
                  `&callMode=${callMode}` +
                  `&status=joined` +
                  `&callId=${callId}`;
                return;
              }

              // Main window — focus popup nếu có, để user end+accept ở đó.
              // Hoặc nếu đang chỉ có IncomingCallModal (chưa có popup),
              // promote thẳng waiting → incoming + accept.
              if (_openCallWindow && !_openCallWindow.closed) {
                _openCallWindow.focus();
                return;
              }
              if (_openTauriCallLabel) {
                void _focusTauriCallWindow();
                return;
              }
              // Reject incoming hiện tại (nếu có), promote new sang incoming, accept.
              const currentIncoming = state.incomingCall;
              if (currentIncoming) {
                sock?.emit("call:end", {
                  roomId: currentIncoming.roomId,
                  actionUserId: myId,
                  status: "rejected",
                  callId: currentIncoming.callId,
                });
              }
              useCallStore.setState({
                incomingCall: {
                  callId,
                  roomId,
                  callType,
                  callMode,
                  members,
                  actionUserId,
                  receivedAt: Date.now(),
                },
              });
              useCallStore.getState().acceptIncomingCall();
            } catch (err) {
              console.error("[Call] Notification onclick handler failed:", err);
            }
          };
        }
      } catch (err) {
        console.warn("[Call] Failed to fire Web Notification:", err);
      }
      return;
    }

    console.log("[Call] Showing IncomingCallModal for", callId, payload);

    // Show the IncomingCallModal — DON'T open the call window yet. The modal
    // mounted at the app root listens to `incomingCall` state and renders the
    // accept / reject UI. window.open() now fires only on accept.
    useCallStore.getState().updateCallState({
      incomingCall: {
        callId,
        roomId,
        callType,
        callMode,
        members,
        actionUserId,
        receivedAt: Date.now(),
      },
    });
  },

  // ─── Incoming call modal actions ─────────────────────────────────────────

  acceptIncomingCall: () => {
    const incoming = useCallStore.getState().incomingCall;
    if (!incoming) return;

 
    const claimKey = `call_handled_${incoming.callId || "unknown"}`;
    const claimTime = Number(localStorage.getItem(claimKey) || 0);
    if (Date.now() - claimTime < 60000) {
      if (_openCallWindow && !_openCallWindow.closed) _openCallWindow.focus();
      else if (_openTauriCallLabel) void _focusTauriCallWindow();
      useCallStore.getState().updateCallState({ incomingCall: null });
      return;
    }
    localStorage.setItem(claimKey, Date.now().toString());
    setTimeout(() => localStorage.removeItem(claimKey), 60000);

    const encodedMemberInfo = Helpers.enCryptUserInfo(incoming.members);

    const callUrl = `/call?roomId=${incoming.roomId}&members=${encodedMemberInfo}&callType=${incoming.callType}&callMode=${incoming.callMode}&status=joined&callId=${incoming.callId}`;

    if (_isTauriRuntime()) {
      void _openTauriCallWindow(callUrl, "appCallWindow_inc");
    } else {
      _openCallWindow = window.open(
        callUrl,
        "appCallWindow_inc",
        "width=800,height=600",
      );

      if (_openCallWindow) {
        _setCallActive(incoming.callId || "pending");
        const poll = setInterval(() => {
          if (!_openCallWindow || _openCallWindow.closed) {
            _clearCallActive();
            _openCallWindow = null;
            clearInterval(poll);
          }
        }, 1000);
      }
    }

    useCallStore.getState().updateCallState({ incomingCall: null });
  },

  rejectIncomingCall: () => {
    const state = useCallStore.getState();
    const incoming = state.incomingCall;
    if (!incoming) return;
    const actionUserId = useAuthStore.getState().user?.id;
    state.socket?.emit("call:end", {
      roomId: incoming.roomId,
      actionUserId,
      status: "rejected",
      callId: incoming.callId,
    });
    state.updateCallState({ incomingCall: null });
  },

  missIncomingCall: () => {
    const state = useCallStore.getState();
    const incoming = state.incomingCall;
    if (!incoming) return;
    const actionUserId = useAuthStore.getState().user?.id;
    state.socket?.emit("call:end", {
      roomId: incoming.roomId,
      actionUserId,
      status: "missed",
      callId: incoming.callId,
    });
    state.updateCallState({ incomingCall: null });
  },

  clearIncomingCall: () => {
    useCallStore.getState().updateCallState({ incomingCall: null });
  },

  // ─── Waiting call (secondary incoming while busy) actions ────────────────

  /**
   * Accept the waiting call: end the current active call, then join the
   * new one. Behavior depends on which window is running this:
   *
   *   - Popup context (window.opener present): the popup IS the active
   *     call's window. Emit call:end for THIS call, then navigate the
   *     popup to the new call URL — same window becomes the new call.
   *   - Main window: focus the existing popup if any (so the user can
   *     accept there), otherwise promote waitingCall → incomingCall and
   *     run acceptIncomingCall to open a new popup.
   */
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

    // P2P duplicate-invocation guard. We can't rely on status === "accepted"
    // here because updateCallState({status: "joined"}) flips the store status
    // to "accepted" BEFORE this function runs (the localStream-await block is
    // async). Use peerConnections — the canonical "have we already negotiated
    // with each peer?" signal — instead.
    const otherMembers = members
      .map((m: CallMember) => ({
        ...m,
        status: m.id === currentUser.id ? "started" : m.status,
      }))
      .filter((m: CallMember) => m.id !== currentUser.id);
    const existingPeers = useP2pCallStore.getState().peerConnections;
    const allPeersAlreadyCreated =
      otherMembers.length > 0 &&
      otherMembers.every((m: CallMember) => existingPeers.has(`${roomId}-${m.id}`));
    if (allPeersAlreadyCreated) return;

    const membersNew = members.map((m: CallMember) => ({
      ...m,
      status: m.id === currentUser.id ? "started" : m.status,
    }));
    set({ status: "accepted", members: membersNew });
    Helpers.updateURLParams("status", "accepted");
    Helpers.updateURLParams("members", Helpers.enCryptUserInfo(membersNew));

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

    // Stop all local tracks (camera/mic + screen-share if any)
    get().stream.localStream?.getTracks().forEach((track) => track.stop());
    get().stream.localScreenStream?.getTracks().forEach((track) => track.stop());
    // Stop all remote tracks
    get().stream.remoteStreams.forEach((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
    });
    get().stream.remoteScreenStreams.forEach((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
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

    if (isGuestSfuCallMode()) {
      clearGuestCallSession();
    }

    set({
      status: "ended",
      roomId: null,
      stream: {
        localStream: null,
        remoteStreams: new Map<string, MediaStream>(),
        localScreenStream: null,
        remoteScreenStreams: new Map<string, MediaStream>(),
      },
      peersSharingScreen: new Set<string>(),
    });
    // window.close is handled by page.tsx useEffect watching callStatus
  },

  handleEndCall: (payload: any) => {
    const { roomId, actionUserId, members, callId, status } = payload;
    const isGuest = isGuestSfuCallMode();

    // If we're showing the IncomingCallModal for this very call and the caller
    // cancelled (or the call was ended elsewhere) → close the modal silently.
    const incoming = get().incomingCall;
    if (incoming && (!callId || incoming.callId === callId)) {
      get().updateCallState({ incomingCall: null });
    }

    // Group calls (sfu mode) NEVER full-teardown when one person
    // leaves — even if that person was the caller. The remaining
    // participants stay in the call; the leaver is just removed from
    // the grid and, if they were the last remote peer, we fall back
    // to the "waiting for others" screen until someone joins or the
    // local user hangs up. Full teardown is reserved for 1-on-1
    // (p2p) calls where one peer leaving means the conversation is
    // genuinely over.
    //
    // Use `callMode` (set at openCall from room type) — counting
    // members is wrong: a 2-member group chat is still a group call,
    // and BE auto-miss broadcasts may omit/trim members.
    //
    // Guests always fully exit on any call:end — they can't continue alone.
    // forceEnd=true when BE decides the whole call is over (no active members).
    const forceFullTeardown = isGuest || payload.forceEnd === true;

    if (get().callMode === "sfu" && !forceFullTeardown) {
      // Multiple participants: only remove the user who left
      const key = `${roomId}-${actionUserId}`;

      // Auto-miss broadcasts a `call:end status='missed'` for every
      // member who didn't pick up — they never had a peer connection
      // / media stream / screen share to begin with, so the
      // Map.clone + setState dance below is pure churn that races
      // with concurrent updates for the people who ARE actively in
      // the call. Bail out early when there's nothing to dismantle.
      const hasStream = get().stream.remoteStreams.has(key);
      const hasScreenStream = get().stream.remoteScreenStreams.has(key);
      const hasPeer = useP2pCallStore.getState().peerConnections.has(key);
      const wasSharing = get().peersSharingScreen.has(actionUserId);
      const wasPinned = get().action.userIdGhimmed === actionUserId;
      if (!hasStream && !hasScreenStream && !hasPeer && !wasSharing && !wasPinned) {
        return;
      }

      const streamToRemove = get().stream.remoteStreams.get(key);
      if (streamToRemove) {
        streamToRemove.getTracks().forEach((track) => track.stop());
      }
      // Also drop their screen-share stream if they were sharing
      const screenStreamToRemove = get().stream.remoteScreenStreams.get(key);
      if (screenStreamToRemove) {
        screenStreamToRemove.getTracks().forEach((track) => track.stop());
      }

      // Close P2P connection for this user (no-op for SFU)
      const pc = useP2pCallStore.getState().peerConnections.get(key);
      if (pc) pc.close();

      const newRemoteStreams = new Map(get().stream.remoteStreams);
      newRemoteStreams.delete(key);
      const newRemoteScreenStreams = new Map(get().stream.remoteScreenStreams);
      newRemoteScreenStreams.delete(key);

      const newPeerConnections = new Map(useP2pCallStore.getState().peerConnections);
      newPeerConnections.delete(key);
      const newScreenTransceivers = new Map(useP2pCallStore.getState().screenTransceivers);
      newScreenTransceivers.delete(key);
      const newRemoteScreenTransceivers = new Map(
        useP2pCallStore.getState().remoteScreenTransceivers,
      );
      newRemoteScreenTransceivers.delete(key);
      useP2pCallStore.setState({
        peerConnections: newPeerConnections,
        screenTransceivers: newScreenTransceivers,
        remoteScreenTransceivers: newRemoteScreenTransceivers,
      });

      const newPeersSharingScreen = new Set(get().peersSharingScreen);
      newPeersSharingScreen.delete(actionUserId);

      // If the leaver was the pinned-as-main user, clear the pin —
      // otherwise the main view would resolve to a missing remoteStreams
      // entry and render "Loading stream..." forever.
      const currentGhimmed = get().action.userIdGhimmed;
      const wasPinnedLeaving = currentGhimmed === actionUserId;

      set({
        stream: {
          ...get().stream,
          remoteStreams: newRemoteStreams,
          remoteScreenStreams: newRemoteScreenStreams,
        },
        peersSharingScreen: newPeersSharingScreen,
        ...(wasPinnedLeaving
          ? { action: { ...get().action, userIdGhimmed: "" } }
          : {}),
      });
      // Intentionally NOT teardown when newRemoteStreams.size === 0 here:
      // for group calls we want to fall back to the "waiting for others"
      // screen so someone can rejoin. The local user can hang up
      // explicitly via the End button.
      return;
    }

    // Full teardown
    get().stream.localStream?.getTracks().forEach((track) => track.stop());
    get().stream.localScreenStream?.getTracks().forEach((track) => track.stop());
    get().stream.remoteStreams.forEach((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
    });
    get().stream.remoteScreenStreams.forEach((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
    });

    // Protocol-specific teardown
    if (get().callMode === "sfu") {
      useSfuCallStore.getState().teardownSfu();
    } else {
      useP2pCallStore.getState().teardownP2p();
    }

    _stopDurationTicker();

    if (isGuest) {
      clearGuestCallSession();
    }

    set({
      status: "ended",
      roomId: null,
      stream: {
        localStream: null,
        remoteStreams: new Map<string, MediaStream>(),
        localScreenStream: null,
        remoteScreenStreams: new Map<string, MediaStream>(),
      },
      peersSharingScreen: new Set<string>(),
    });
    // window.close is handled by page.tsx useEffect watching callStatus
  },

  // ─── Event dispatch hub ───────────────────────────────────────────────────
  // P2P-specific cases (accepted, answer, candidate) are delegated to useP2pCallStore.
  // SFU-specific cases go through handleSFUSignal → useSfuCallStore.

  eventCall: async (event: string, payload: any) => {
    const guestSession = isGuestSfuCallMode() ? buildGuestUserFromSession() : null;
    const currentUser = useAuthStore.getState().user ?? guestSession;
    const status = get().status;
    if (!currentUser) {
      console.warn("[Call] User not authenticated, cannot handle call event");
      return;
    }

    const allowWithoutOpener =
      isGuestSfuCallMode() || event === "request" || event === "busy";
    if (!window.opener && !allowWithoutOpener) {
      return;
    }

    const { actionUserId, answer, candidate, roomId, targetUserId } = payload;
    const socket = get().socket;

    switch (event) {
      case "request":
        // Popup window must ALSO process call:request now — otherwise a
        // user focused on the call popup wouldn't see the WaitingCallBanner
        // for a secondary incoming call. handleRequestCall detects the
        // popup context (window.opener present) and routes the payload to
        // `waitingCall` instead of `incomingCall`.
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

        // Use signalingState as the source of truth for "are we waiting for an
        // answer?". `pc.remoteDescription` is too coarse — during renegotiation
        // (audio→video upgrade) it was set by the previous round's answer, but
        // signalingState correctly flipped back to "have-local-offer" when we
        // set our new local offer. Old logic short-circuited on
        // `pc.remoteDescription` and never applied the renegotiation answer →
        // peers diverged on SDP and the new track never established.
        if (pc.signalingState !== "have-local-offer") {
          console.warn(
            `[P2P] Skipping answer: PC not in have-local-offer (state=${pc.signalingState})`,
          );
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
        console.log("Candidate", candidate);
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

          _scheduleSfuGetProducers(0);
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
    // Explicit audio processing flags. When the constraint is the literal
    // `true`, browsers default to enabling these — but as soon as we add
    // ANY field (like deviceId) the defaults are dropped on some browsers,
    // and the mic ends up sending raw audio that loops back through the
    // remote speaker → mic chain → echo. Always set them ourselves so the
    // behavior is deterministic across deviceId/no-deviceId.
    const audioConstraint: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(currentState.devices.selectedAudioInput
        ? { deviceId: { exact: currentState.devices.selectedAudioInput } }
        : {}),
    };
    const videoConstraint: MediaTrackConstraints | true =
      currentState.devices.selectedVideoInput
        ? { deviceId: { exact: currentState.devices.selectedVideoInput } }
        : true;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.error("[Call] getUserMedia not available (requires HTTPS or localhost)");
      return;
    }

    // Privacy: audio calls must NOT touch the camera. `track.enabled = false`
    // stops frames going out but the OS-level capture stays open and the
    // hardware indicator light stays on, which users (rightly) treat as a
    // privacy violation. So for audio mode we only request the mic; if the
    // user later flips the camera toggle, `upgradeToVideo()` (called from
    // `actionToggleTrack("video", true)`) captures the camera at that moment
    // and renegotiates. Video calls still grab both tracks up-front.
    let stream: MediaStream | null = null;
    if (currentState.mode === "audio") {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraint,
        });
      } catch (audioErr) {
        console.error("[Call] Could not get microphone:", audioErr);
        return;
      }
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraint,
          video: videoConstraint,
        });
      } catch (err) {
        console.warn(
          "[Call] Could not get audio+video, falling back to audio-only:",
          err,
        );
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraint,
          });
        } catch (audioErr) {
          console.error("[Call] Could not get microphone:", audioErr);
          return;
        }
      }
    }

    set({ stream: { ...get().stream, localStream: stream } });

    // SFU: produce tracks if sendTransport is already ready
    if (get().callMode === "sfu") {
      await useSfuCallStore.getState().produceLocalStream(stream);
      _scheduleSfuGetProducers(0);
    }

    if (currentState.devices.audioInputs.length === 0) {
      await get().getDevices();
    }
  },

  // ─── Screen sharing ───────────────────────────────────────────────────────

  handleShareScreen: async (value: boolean) => {
    const currentState = get();
    const userId = getCallActorUserId();

    if (!currentState.roomId) {
      console.error("[Call] RoomId not found");
      return;
    }

    if (value) {
      // ── Turn ON screen share ──
      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      } catch (err) {
        // User cancelled the OS picker, or no permission. Reset flag silently.
        console.warn("[Call] Screen capture aborted:", err);
        set((prev) => ({
          action: { ...prev.action, isSharingScreen: false },
        }));
        return;
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        console.error("[Call] No video track from getDisplayMedia");
        return;
      }

      // Auto-stop when the user clicks the browser's "Stop sharing" button.
      screenTrack.onended = () => {
        void get().actionToggleTrack("shareScreen", false);
      };

      // Update local state first so the sender's own UI flips into
      // screen-share layout immediately.
      set((prev) => ({
        stream: { ...prev.stream, localScreenStream: screenStream },
        peersSharingScreen: userId
          ? new Set([...prev.peersSharingScreen, userId])
          : prev.peersSharingScreen,
        action: { ...prev.action, isSharingScreen: true },
      }));

      // Publish + notify, in protocol-specific order:
      //
      // P2P: emit `call:share-screen` BEFORE the renegotiation. The
      // renegotiation path (`replaceScreenTrackInPeers`) emits a
      // `call:accepted` with renegotiate=true. Both events go through the
      // same Socket.IO connection (FIFO at the TCP level), and the BE
      // handler for share-screen is a thin relay while handleAccept makes
      // a gRPC call. So as long as we emit share-screen first, the receiver
      // is guaranteed to see it before the renegotiated offer arrives,
      // populating `peersSharingScreen` so `pc.ontrack` correctly routes
      // the new video track to remoteScreenStreams (not remoteStreams).
      //
      // SFU: emit AFTER produce because we need the producer id in the
      // payload for receiver-side routing. Race here is handled by the
      // migration logic in onShareScreen (moves an already-consumed track
      // from camera Map → screen Map if consume arrived first).
      if (currentState.callMode === "sfu") {
        // Wait for SFU send transport (guest join bootstrap may still be running).
        let sendTransport = useSfuCallStore.getState().sfu.sendTransport;
        const transportWaitStart = Date.now();
        while (
          (!sendTransport || sendTransport.closed) &&
          Date.now() - transportWaitStart < 10000
        ) {
          await new Promise((r) => setTimeout(r, 100));
          sendTransport = useSfuCallStore.getState().sfu.sendTransport;
        }
        if (!sendTransport || sendTransport.closed) {
          console.error("[Call] SFU sendTransport not ready for screen share");
          screenTrack.stop();
          set((prev) => ({
            stream: { ...prev.stream, localScreenStream: null },
            action: { ...prev.action, isSharingScreen: false },
          }));
          return;
        }

        let screenProducerId: string | undefined;
        try {
          const producer = await sendTransport.produce({
            track: screenTrack,
            appData: { source: "screen" },
          });
          screenProducerId = producer.id;
          useSfuCallStore.setState((prev) => ({
            sfu: { ...prev.sfu, screenProducer: producer },
          }));
        } catch (err) {
          console.error("[Call] SFU produce screen failed:", err);
          screenTrack.stop();
          return;
        }

        const { socket, roomId } = get();
        socket?.emit("call:share-screen", {
          roomId,
          actionUserId: userId ?? getCallActorUserId(),
          isSharing: true,
          screenProducerId,
        });
      } else {
        const { socket, roomId } = get();
        socket?.emit("call:share-screen", {
          roomId,
          actionUserId: userId ?? getCallActorUserId(),
          isSharing: true,
        });
        await useP2pCallStore.getState().replaceScreenTrackInPeers(screenTrack);
      }
    } else {
      // ── Turn OFF screen share ──
      if (currentState.callMode === "sfu") {
        const screenProducer = useSfuCallStore.getState().sfu.screenProducer;
        if (screenProducer && !screenProducer.closed) {
          screenProducer.close();
        }
        useSfuCallStore.setState((prev) => ({
          sfu: { ...prev.sfu, screenProducer: null },
        }));
      } else {
        // Drop the track from the screen transceiver (frames stop on the
        // wire, no renegotiation, transceiver stays for next time).
        await useP2pCallStore.getState().replaceScreenTrackInPeers(null);
      }

      currentState.stream.localScreenStream?.getTracks().forEach((t) => t.stop());

      set((prev) => {
        const nextPeers = new Set(prev.peersSharingScreen);
        if (userId) nextPeers.delete(userId);
        return {
          stream: { ...prev.stream, localScreenStream: null },
          peersSharingScreen: nextPeers,
          action: { ...prev.action, isSharingScreen: false },
        };
      });

      const { socket, roomId } = get();
      socket?.emit("call:share-screen", {
        roomId,
        actionUserId: userId ?? getCallActorUserId(),
        isSharing: false,
      });
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
      case "mic": {
        localStream?.getAudioTracks().forEach((t) => { t.enabled = value; });
        set((prev) => ({ ...prev, action: { ...prev.action, isMicEnabled: value } }));
        // Broadcast mic-state so peers can render a "mic muted" badge on
        // this user's tile. Same pattern as `call:camera-state` —
        // track.enabled=false at the source doesn't reliably propagate as
        // a track event on the receiver, so the explicit signal is the
        // only fast/correct path.
        const { socket: micSk, roomId: micRId } = get();
        const micUid = useAuthStore.getState().user?.id;
        if (micSk && micRId && micUid) {
          micSk.emit("call:mic-state", {
            roomId: micRId,
            actionUserId: micUid,
            isMicOn: value,
          });
        }
        break;
      }
      case "video": {
        // Privacy-respecting toggle:
        //   ON  + no track → upgradeToVideo() captures camera + renegotiates.
        //   ON  + track    → re-enable existing track (rare; only if a previous
        //                    OFF didn't fully tear down — see below).
        //   OFF            → STOP the track and remove it from localStream.
        //                    `track.enabled = false` was the old behavior, but
        //                    that only stops sending frames; the OS hardware
        //                    capture stays open and the camera indicator light
        //                    stays on, which users (rightly) read as a privacy
        //                    violation. Stopping the track releases the device.
        //                    Next ON goes through `upgradeToVideo()` again.
        const hasVideoTrack =
          (localStream?.getVideoTracks().length ?? 0) > 0;

        if (value && !hasVideoTrack) {
          await get().upgradeToVideo();
          // upgradeToVideo broadcasts camera-state implicitly via mode flip;
          // emit the explicit signal too so peers are in sync regardless.
          const { socket: skU, roomId: rIdU } = get();
          const uidU = useAuthStore.getState().user?.id;
          if (skU && rIdU && uidU) {
            skU.emit("call:camera-state", {
              roomId: rIdU,
              actionUserId: uidU,
              isCameraOn: true,
            });
          }
          break;
        }

        if (!value && localStream) {
          // Stop + detach video track so the camera indicator goes off.
          // Detach from senders (replaceTrack(null)) BEFORE stop() so the
          // peer doesn't see a flash of black/failed frames.
          const videoTracks = localStream.getVideoTracks();
          if (videoTracks.length > 0) {
            // 1. Detach from every PC sender (P2P mode — SFU pause is a TODO).
            //    Prefer the tracked camera sender; fall back to a kind-based
            //    search only for peers that haven't been registered yet.
            //    Defensive screen-track exclusion: also match against the
            //    local screen track directly so a stale `screenTransceivers`
            //    map can't trick us into stopping the wrong sender.
            const p2p = useP2pCallStore.getState();
            const localScreenTrack =
              get().stream.localScreenStream?.getVideoTracks()[0] ?? null;
            for (const [key, pc] of p2p.peerConnections) {
              if (pc.signalingState === "closed") continue;
              const screenSender = p2p.screenTransceivers.get(key)?.sender;
              const isScreenSender = (s: RTCRtpSender) =>
                s === screenSender ||
                (localScreenTrack !== null && s.track === localScreenTrack);
              const tracked = p2p.cameraSenders.get(key);
              const cameraSender =
                tracked && pc.getSenders().includes(tracked) && !isScreenSender(tracked)
                  ? tracked
                  : pc
                      .getSenders()
                      .find((s) => s.track?.kind === "video" && !isScreenSender(s));
              if (cameraSender) {
                try {
                  await cameraSender.replaceTrack(null);
                  if (tracked !== cameraSender) {
                    useP2pCallStore.setState((prev) => {
                      const next = new Map(prev.cameraSenders);
                      next.set(key, cameraSender);
                      return { cameraSenders: next };
                    });
                  }
                } catch (err) {
                  console.warn(`[P2P] camera off: replaceTrack(null) failed for ${key}:`, err);
                }
              }
            }
            // SFU: pause ONLY the camera video producer. Both camera and
            // screen are kind="video", so a naive `kind === "video"` filter
            // would also pause the screen producer → the user's own screen
            // share stops while they're still sharing it. Identify the
            // screen producer by its dedicated `sfu.screenProducer` ref
            // (set in handleShareScreen) and skip it.
            if (get().callMode === "sfu") {
              const sfuStore = useSfuCallStore.getState();
              const ownScreen = sfuStore.sfu.screenProducer;
              for (const producer of sfuStore.sfu.producers.values()) {
                if (producer.kind !== "video" || producer.closed) continue;
                if (ownScreen && producer.id === ownScreen.id) continue;
                try {
                  producer.pause();
                } catch (err) {
                  console.warn("[SFU] camera off: pause failed:", err);
                }
              }
            }
            // 2. Stop tracks → releases the OS device → indicator light off.
            for (const t of videoTracks) {
              try { t.stop(); } catch { /* already stopped */ }
              localStream.removeTrack(t);
            }
          }
        } else if (value && hasVideoTrack) {
          localStream?.getVideoTracks().forEach((t) => { t.enabled = true; });
        }

        set((prev) => ({ ...prev, action: { ...prev.action, isCameraEnabled: value } }));
        // Broadcast camera-state to peers so they can swap to the avatar
        // immediately. Relying on the receiver's `track.muted` event isn't
        // reliable: Chrome keeps RTP flowing even after `track.enabled=false`
        // (sends black frames), so the mute event takes 5-10s to fire if
        // ever — the avatar UX would lag noticeably without this signal.
        const { socket: sk, roomId: rId } = get();
        const uid = useAuthStore.getState().user?.id;
        if (sk && rId && uid) {
          sk.emit("call:camera-state", {
            roomId: rId,
            actionUserId: uid,
            isCameraOn: value,
          });
        }
        break;
      }
      case "speaker":
        // Speaker toggle controls REMOTE audio playback (`muted` attr on the
        // remote <video>/<audio> element is bound to `!isSpeakerphoneEnabled`).
        // It must NOT touch localStream — that would mute the user's mic, not
        // the speaker. Mic mute belongs to the "mic" case.
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
    // Pin camera → clear any active screen-pin (mutually exclusive: main
    // view shows ONE thing). Empty "" just clears the camera pin.
    set((prev) => ({
      ...prev,
      action: {
        ...prev.action,
        userIdGhimmed: userId,
        ...(userId ? { screenSharerIdGhimmed: "" } : {}),
      },
    }));
  },

  setScreenSharerIdGhimmed: (userId) => {
    // Pin a screen-share owner → clear any active camera-pin. Empty ""
    // clears the screen-pin and falls back to the default precedence
    // (own localScreenStream → first peer in peersSharingScreen).
    set((prev) => ({
      ...prev,
      action: {
        ...prev.action,
        screenSharerIdGhimmed: userId,
        ...(userId ? { userIdGhimmed: "" } : {}),
      },
    }));
  },

  // ─── Audio → Video upgrade ────────────────────────────────────────────────

  /**
   * Add a video track to an in-progress audio-only call. Called from the
   * "video" toggle when the localStream has no video track yet. Steps:
   *   1. getUserMedia({ video: true }) — separate stream so we don't disturb
   *      the existing audio track.
   *   2. Add video track to coordinator's localStream.
   *   3. SFU: produce the video track on the existing sendTransport (other
   *      members auto-consume via the broadcast 'produce' event).
   *   4. P2P: addTrack to each peer connection → renegotiation fires
   *      `negotiationneeded` → caller creates new offer → emit 'call:answer'
   *      via existing signaling.
   *   5. Flip mode → 'video', flag isCameraEnabled = true.
   */
  upgradeToVideo: async () => {
    // Coalesce concurrent calls. Without this, a rapid OFF→ON→OFF→ON click
    // sequence (or a StrictMode double-invoke) fires two getUserMedia calls
    // at once: the first claims the camera, the second times out with
    // `AbortError: Timeout starting video source` after ~5s.
    if (_upgradeVideoInFlight) return _upgradeVideoInFlight;

    const run = async (): Promise<void> => {
      const state = get();
      const existingStream = state.stream.localStream;
      if (!existingStream) {
        console.error("[Call] upgradeToVideo: no localStream");
        return;
      }
      if (existingStream.getVideoTracks().length > 0) {
        // Already has video — toggle it on instead.
        existingStream.getVideoTracks().forEach((t) => (t.enabled = true));
        set((prev) => ({
          ...prev,
          mode: "video",
          action: { ...prev.action, isCameraEnabled: true },
        }));
        return;
      }

      let videoTrack: MediaStreamTrack | null = null;
      // Retry strategy: the OS can take 200-700ms to release the camera
      // device after a previous track.stop() — `AbortError: Timeout starting
      // video source` is the typical symptom. Try up to 3 times with
      // increasing backoff. On the 2nd attempt drop the deviceId constraint
      // (some drivers refuse the exact deviceId after a release/reacquire
      // cycle but accept the default device fine).
      const baseConstraints: MediaStreamConstraints = {
        video: state.devices.selectedVideoInput
          ? { deviceId: { exact: state.devices.selectedVideoInput } }
          : true,
        audio: false,
      };
      const attempts: Array<{ delayMs: number; constraints: MediaStreamConstraints }> = [
        { delayMs: 0, constraints: baseConstraints },
        { delayMs: 400, constraints: { video: true, audio: false } },
        { delayMs: 1000, constraints: { video: true, audio: false } },
      ];
      let lastErr: unknown = null;
      for (const attempt of attempts) {
        if (attempt.delayMs > 0) {
          await new Promise((r) => setTimeout(r, attempt.delayMs));
        }
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia(
            attempt.constraints,
          );
          videoTrack = cameraStream.getVideoTracks()[0];
          if (videoTrack) break;
        } catch (err) {
          lastErr = err;
          const name = (err as { name?: string })?.name;
          // Only retry on transient device-busy errors. Permission denial
          // (NotAllowedError / SecurityError) won't change with retry.
          if (name !== "AbortError" && name !== "NotReadableError") break;
          console.warn(
            `[Call] upgradeToVideo: getUserMedia attempt failed (${name}), retrying...`,
          );
        }
      }
      if (!videoTrack) {
        console.error("[Call] upgradeToVideo: getUserMedia failed", lastErr);
        const name = (lastErr as { name?: string })?.name;
        // User-facing message keyed off the error name so they know how to
        // recover. The browser's own error doesn't surface anywhere visible.
        const message =
          name === "NotAllowedError" || name === "SecurityError"
            ? "Trình duyệt đã chặn truy cập camera. Hãy cấp quyền trong cài đặt site."
            : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Không tìm thấy camera nào trên thiết bị này."
            : name === "NotReadableError" || name === "AbortError"
            ? "Camera đang được ứng dụng khác sử dụng (Zoom/Teams/tab khác). Hãy đóng app đó rồi thử lại."
            : "Không thể bật camera. Hãy thử lại sau.";
        set((prev) => ({
          ...prev,
          error: message,
          action: { ...prev.action, isCameraEnabled: false },
        }));
        return;
      }

      if (!videoTrack) {
        console.error("[Call] upgradeToVideo: no video track returned");
        return;
      }

      // 1. Add to coordinator's localStream so the local <video> picks it up.
      existingStream.addTrack(videoTrack);

      // 2. Protocol-specific publish.
      try {
        if (state.callMode === "sfu") {
          // produceLocalStream guards against duplicate produce — we want to
          // fire a fresh produce specifically for the new video track.
          const sfuStore = useSfuCallStore.getState();
          const sendTransport = sfuStore.sfu.sendTransport;
          if (sendTransport && !sendTransport.closed) {
            const producer = await sendTransport.produce({ track: videoTrack });
            useSfuCallStore.setState((prev) => ({
              sfu: {
                ...prev.sfu,
                producers: new Map([...prev.sfu.producers, [producer.id, producer]]),
              },
            }));
          } else {
            console.warn(
              "[Call] upgradeToVideo: sendTransport not ready, video track not produced",
            );
          }
        } else {
          // P2P: prefer replaceTrack on the tracked camera sender — no
          // renegotiation needed. The camera sender is registered in
          // `cameraSenders` at PC creation (or in the fallback below the
          // first time it's added), so we can find it even when its track
          // was nulled out by a previous "camera off" toggle. Falling back
          // to a kind-based search would fail in that case (sender.track is
          // null) and create a duplicate video sender → SDP confusion +
          // remote camera not displaying. The screen sender (when sharing)
          // is excluded explicitly.
          const p2p = useP2pCallStore.getState();
          const peers = p2p.peerConnections;
          const localScreenTrack =
            state.stream.localScreenStream?.getVideoTracks()[0] ?? null;
          for (const [key, pc] of peers) {
            if (pc.signalingState === "closed") continue;
            const screenSender = p2p.screenTransceivers.get(key)?.sender;
            const isScreenSender = (s: RTCRtpSender) =>
              s === screenSender ||
              (localScreenTrack !== null && s.track === localScreenTrack);
            const tracked = p2p.cameraSenders.get(key);
            // Validate the tracked sender is still on this PC (defensive
            // against stale references after a re-create).
            const cameraSender =
              tracked && pc.getSenders().includes(tracked) && !isScreenSender(tracked)
                ? tracked
                : pc
                    .getSenders()
                    .find((s) => s.track?.kind === "video" && !isScreenSender(s));
            try {
              if (cameraSender) {
                await cameraSender.replaceTrack(videoTrack);
                // Refresh the tracked entry in case we discovered the sender
                // via the kind-based fallback (no entry yet for this peer).
                if (tracked !== cameraSender) {
                  useP2pCallStore.setState((prev) => {
                    const next = new Map(prev.cameraSenders);
                    next.set(key, cameraSender);
                    return { cameraSenders: next };
                  });
                }
              } else {
                // No video sender exists yet — first add for this peer
                // (e.g. audio-only call). Renegotiation required.
                const socket = state.socket;
                const newSender = pc.addTrack(videoTrack, existingStream);
                useP2pCallStore.setState((prev) => {
                  const next = new Map(prev.cameraSenders);
                  next.set(key, newSender);
                  return { cameraSenders: next };
                });
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const targetUserId = key.split("-")[1] || key;
                socket?.emit("call:accepted", {
                  roomId: state.roomId,
                  targetUserId,
                  offer: Helpers.enCryptUserInfo(offer),
                  callId: state.callId,
                  members: state.members,
                  renegotiate: true,
                });
              }
            } catch (err) {
              console.warn(
                `[P2P] upgradeToVideo: track publish failed for ${key}:`,
                err,
              );
            }
          }
        }
      } catch (err) {
        console.error("[Call] upgradeToVideo: publish failed", err);
      }

      // 3. Flip mode + flag.
      set((prev) => ({
        ...prev,
        mode: "video",
        action: { ...prev.action, isCameraEnabled: true },
      }));
      Helpers.updateURLParams("callType", "video");
    };

    _upgradeVideoInFlight = run().finally(() => {
      _upgradeVideoInFlight = null;
    });
    return _upgradeVideoInFlight;
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
          // Re-enable echo cancellation + noise suppression + AGC after
          // device switch, otherwise the new mic stream loses these flags.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
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
    const guestMeta = isGuestSfuCallMode() ? getGuestCallMeta() : null;
    const guestToken = guestMeta ? getGuestCallToken() : null;
    let currentUser = useAuthStore.getState().user;

    if (guestMeta && guestToken) {
      if (!isGuestCallSupportedMode(guestMeta.callMode)) {
        console.error("[updateCallState] guest call requires SFU mode");
        clearGuestCallSession();
        return;
      }
      currentUser = buildGuestUserFromSession() as NonNullable<
        ReturnType<typeof useAuthStore.getState>["user"]
      >;
    } else if (!currentUser && tokenStorage.get() && !shouldSkipAuthenticatedApis()) {
      // Trigger fetchMe if not already in flight, then poll.
      void useAuthStore.getState().fetchMe();
      const start = Date.now();
      while (Date.now() - start < 5000) {
        currentUser = useAuthStore.getState().user;
        if (currentUser) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!currentUser) {
        console.error(
          "[updateCallState] user still null after 5s, aborting",
        );
        return;
      }
    }
    if (!currentUser) {
      console.error("[updateCallState] no user + no guest session, aborting");
      return;
    }
    const socket = state.socket;

    if (state.status === "accepted") {
      // Apply incoming state (especially `action.startedAt` so the ticker
      // closure has something to anchor against). Without merging here, a
      // caller passing { status: "accepted", action: { startedAt: ... } }
      // would have the startedAt silently dropped, leaving the ticker stuck
      // at 00:00.
      set((prev) => ({
        ...prev,
        ...state,
        action: {
          ...prev.action,
          ...(state.action ?? {}),
        },
      }));
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

    const guestMetaForMode = isGuestSfuCallMode() ? getGuestCallMeta() : null;
    let effectiveCallMode =
      guestMetaForMode?.callMode === "sfu"
        ? "sfu"
        : state.callMode || get().callMode;
    let canonicalRoomId = state.roomId;
    let canonicalMembers: CallMember[] = state.members ?? [];
    let elapsedSeconds = 0;
    let canonicalStartedAt: string | null = get().action.startedAt;
    let resolvedCallId: string | null =
      (state as { callId?: string | null }).callId || get().callId || null;

    if (state.status === "joined" && socket) {
      const runJoinedBootstrap = async () => {
      set((prev) => ({ ...prev, socket: state.socket }));

      const joinCallId = (state as any).callId || get().callId;
      let joinHistory: any = null;
      // BE-snapshotted runtime state at the moment of joining: who is
      // currently sharing screen, who has camera off, who has mic off.
      // Lets the UI render correct tiles from frame 1 instead of waiting
      // for the next toggle event from each peer (which may never arrive
      // for a stable state — e.g. a 30-min steady screen-share would never
      // re-emit call:share-screen, leaving the late-joiner with the screen
      // routed into the camera Map).
      let joinCallState: {
        sharing: Array<{ userId: string; screenProducerId: string | null }>;
        cameraOff: string[];
        micOff: string[];
      } | null = null;

      if (joinCallId) {
        resolvedCallId = joinCallId;
        set((prev) => ({ ...prev, callId: joinCallId }));
        _setCallActive(joinCallId);

        canonicalRoomId = await new Promise<string>((resolve) => {
          const fallback = setTimeout(() => resolve(state.roomId ?? ""), 3000);
          const guestMeta = isGuestSfuCallMode() ? getGuestCallMeta() : null;
          socket.emit(
            "call:join",
            {
              roomId: state.roomId,
              callId: joinCallId,
              ...(guestMeta?.guestName
                ? { guestName: guestMeta.guestName }
                : {}),
            },
            (response: any) => {
              clearTimeout(fallback);
              if (response?.ok) {
                joinHistory = response.history || null;
                joinCallState = response.callState || null;
                if (response.callMode === "p2p" || response.callMode === "sfu") {
                  effectiveCallMode = response.callMode;
                }
              }
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

      if (joinHistory?.call_mode === "p2p" || joinHistory?.call_mode === "sfu") {
        effectiveCallMode = joinHistory.call_mode;
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

      // Commit room + members before SFU init so async signal handlers read
      // the canonical roomId (guest join / late-join race fix).
      set((prev) => ({
        ...prev,
        roomId: canonicalRoomId,
        members: canonicalMembers,
        callId: joinCallId ?? prev.callId,
        callMode: effectiveCallMode,
      }));

      // Seed the UI from the BE snapshot before any toggle event arrives.
      // Only `peersSharingScreen` + `screenProducerIds` are stored in
      // useCallStore / useSfuCallStore — cameraOff / micOff currently live
      // in component state (cameraOffPeers / micOffPeers). To avoid lifting
      // those into the store right now, we forward them via the URL params
      // pattern we already use for joined-state propagation; FE component
      // useEffect can pick them up. For a smaller scope, we just hydrate
      // the screen-share state here (the highest-impact bug).
      if (joinCallState) {
        const sharerIds = (joinCallState as {
          sharing: Array<{ userId: string; screenProducerId: string | null }>;
        }).sharing.map((s) => s.userId);
        const producerIds = (joinCallState as {
          sharing: Array<{ userId: string; screenProducerId: string | null }>;
        }).sharing
          .map((s) => s.screenProducerId)
          .filter((id): id is string => !!id);
        if (sharerIds.length > 0) {
          set((prev) => ({
            ...prev,
            peersSharingScreen: new Set([
              ...prev.peersSharingScreen,
              ...sharerIds,
            ]),
          }));
        }
        if (producerIds.length > 0) {
          useSfuCallStore.setState((prev) => ({
            sfu: {
              ...prev.sfu,
              screenProducerIds: new Set([
                ...prev.sfu.screenProducerIds,
                ...producerIds,
              ]),
            },
          }));
        }
      }

      if (effectiveCallMode === "sfu") {
        await useSfuCallStore.getState().initSFU();
        socket?.emit("signal", {
          type: "join",
          roomId: canonicalRoomId,
          callId: joinCallId ?? undefined,
          target: "sfu",
        });
        _scheduleSfuGetProducers();
      } else if (isGuestSfuCallMode()) {
        console.error("[updateCallState] guest join requires SFU call mode");
        clearGuestCallSession();
        return;
      }

      if (effectiveCallMode === "p2p") {
        // Wait for localStream to be ready before firing acceptCall — otherwise
        // handleCreatePeerConnection runs against a null localStream and the
        // PeerConnection is created with NO tracks → remote sees nothing.
        // The previous setTimeout(1000) was a race: getUserMedia can take
        // longer (mic/cam permission prompt, slow device init).
        void (async () => {
          const start = Date.now();
          while (Date.now() - start < 15000) {
            if (get().stream.localStream) break;
            await new Promise((r) => setTimeout(r, 100));
          }
          if (!get().stream.localStream) {
            console.error(
              "[P2P] localStream not ready after 15s, aborting accept",
            );
            return;
          }
          await get().acceptCall({
            roomId: canonicalRoomId,
            members: canonicalMembers,
            currentUser,
            socket: state.socket,
            callId: joinCallId,
          });
        })();
      }
      };

      if (!_sfuJoinBootstrapPromise) {
        _sfuJoinBootstrapPromise = runJoinedBootstrap().finally(() => {
          _sfuJoinBootstrapPromise = null;
        });
      }
      await _sfuJoinBootstrapPromise;
    } else if (state.status === "calling" && socket) {
      const requestPayload = {
        actionUserId: currentUser?.id || "",
        membersIds: state.members?.map((m: CallMember) => m.id) || [],
        roomId: state.roomId,
        callType: state.mode,
      };
      const onRequestAck = (response: {
        ok?: boolean;
        room?: { room_id?: string };
        callId?: string;
        startedAt?: string;
      }) => {
        if (response?.startedAt) canonicalStartedAt = response.startedAt;
        if (response?.callId) {
          resolvedCallId = response.callId;
          set((prev) => ({ ...prev, callId: response.callId! }));
          Helpers.updateURLParams("callId", response.callId);
          _setCallActive(response.callId);
        }
        if (response?.ok && response?.room?.room_id) {
          canonicalRoomId = response.room.room_id;
        }
      };

      if (effectiveCallMode === "sfu") {
        canonicalRoomId = await new Promise<string>((resolve) => {
          const fallback = setTimeout(() => resolve(state.roomId ?? ""), 3000);
          socket.emit(
            "call:request",
            requestPayload,
            (response: {
              ok?: boolean;
              room?: { room_id?: string };
              callId?: string;
              startedAt?: string;
            }) => {
              clearTimeout(fallback);
              onRequestAck(response);
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
        await new Promise<void>((resolve) => {
          const fallback = setTimeout(() => resolve(), 3000);
          socket.emit(
            "call:request",
            requestPayload,
            (response: {
              ok?: boolean;
              room?: { room_id?: string };
              callId?: string;
              startedAt?: string;
            }) => {
              clearTimeout(fallback);
              onRequestAck(response);
              resolve();
            },
          );
        });
      }
    }

    set((prev) => ({
      ...prev,
      ...state,
      roomId: canonicalRoomId,
      members: canonicalMembers,
      callId: resolvedCallId ?? prev.callId,
      callMode: effectiveCallMode,
      action: {
        ...prev.action,
        ...(state.action ?? {}),
        duration: elapsedSeconds,
        startedAt: canonicalStartedAt,
      },
      ...(state.status === "joined" ? { status: "accepted" } : {}),
    }));

    if (resolvedCallId) {
      Helpers.updateURLParams("callId", resolvedCallId);
      _setCallActive(resolvedCallId);
    }

    // Start the canonical duration ticker once we have a startedAt anchor.
    // Caller hits this on "calling" (after call:request resolves with startedAt);
    // callee hits this on "joined" (transitioned to accepted via line 1049).
    if (canonicalStartedAt && (state.status === "joined" || state.status === "calling")) {
      _startDurationTicker(set, () => get().action.startedAt);
    }
  },
}));

export default useCallStore;
