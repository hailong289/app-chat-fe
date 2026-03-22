import { create } from "zustand";
import { CallMember, CallState } from "./types/call.state";
import Helpers from "@/libs/helpers";
import useAuthStore from "./useAuthStore";
import { User } from "@/types/auth.type";
import { Device } from "mediasoup-client";

// Module-level ref to the incoming call popup — persists across re-renders
let _openCallWindow: Window | null = null;

const useCallStore = create<CallState>()((set, get) => ({
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
    peerConnections: new Map<string, RTCPeerConnection>(),
  },
  sfu: {
    device: null,
    sendTransport: null,
    recvTransport: null,
    producers: new Map(),
    consumers: new Map(),
    pendingProduceCallbacks: new Map(),
  },
  pendingCandidates: new Map<string, RTCIceCandidate[]>(),
  action: {
    isMicEnabled: true,
    isCameraEnabled: false,
    isSpeakerphoneEnabled: true,
    duration: 0, // thời gian gọi
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
  openCall: (payload) => {
    // calling: người gọi
    const {
      roomId,
      mode,
      members,
      currentUser,
      socket,
      callMode = "p2p",
    } = payload;
    const memberMap = members.map((m: User) => ({
      id: m.id,
      fullname: m.fullname,
      avatar: m.avatar,
      is_caller: m.id == currentUser.id,
    }));
    const encodedMemberInfo = Helpers.enCryptUserInfo(memberMap);
    window.open(
      `/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${mode}&callMode=${callMode}&status=calling&isCaller=true`,
      "",
      "width=800,height=600",
    );
  },
  handleRequestCall: async (payload: any) => {
    // incoming: người bị gọi
    const { roomId, members, callType, callId, callMode = "p2p" } = payload;

    // Same-tab guard: nếu cửa sổ cuộc gọi đang mở thì chỉ focus, không mở thêm
    if (_openCallWindow && !_openCallWindow.closed) {
      _openCallWindow.focus();
      return;
    }

    // Multi-tab dedup: chỉ 1 tab được mở cửa sổ cuộc gọi cho cùng 1 callId
    const claimKey = `call_handled_${callId || "unknown"}`;
    const tryOpenWindow = () => {
      const claimTime = Number(localStorage.getItem(claimKey) || 0);
      if (Date.now() - claimTime < 60000) {
        if (_openCallWindow && !_openCallWindow.closed) _openCallWindow.focus();
        return;
      }
      localStorage.setItem(claimKey, Date.now().toString());
      setTimeout(() => localStorage.removeItem(claimKey), 60000);

      const encodedMemberInfo = Helpers.enCryptUserInfo(members);
      _openCallWindow = window.open(
        `/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${callType}&callMode=${callMode}&status=incoming&callId=${callId}`,
        "appCallWindow_inc",
        "width=800,height=600",
      );
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
  acceptCall: async (payload) => {
    // accepted: người bị gọi
    const { roomId, members, currentUser, socket, callId } = payload;
    const actionUserId = currentUser.id;

    // SFU calls: do the join flow instead of P2P signaling.
    // The acceptCall button on incoming SFU calls should behave like clicking "Tham gia".
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

    // P2P path
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
      // Tạo peer connection
      const pc = await get().handleCreatePeerConnection(roomId, member.id);
      // tạo offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // gửi offer đến người bị gọi
      socket?.emit("call:accepted", {
        membersIds: members.map((m: User) => m.id),
        actionUserId: actionUserId,
        roomId: roomId,
        targetUserId: member.id,
        offer: Helpers.enCryptUserInfo(offer),
        callId: callId,
      });
    }
  },
  handleAcceptCall: async (payload: any) => {
    // accepted: người gọi
    const { roomId, offer, members, actionUserId, callId } = payload;
    const socket = get().socket;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      console.error("User not authenticated, cannot handle call event");
      return;
    }
    const userStarted = members.find(
      (m: CallMember) => m.id === currentUser.id && m.status === "started",
    );
    if (!userStarted) {
      console.error("User not found in members");
      return;
    }
    // Nhận offer từ người gọi
    const offerDescription = Helpers.decryptUserInfo(offer);
    const pc = await get().handleCreatePeerConnection(roomId, actionUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerCreated = await pc.createAnswer();
    await pc.setLocalDescription(answerCreated);
    socket?.emit("call:answer", {
      roomId: roomId,
      answer: Helpers.enCryptUserInfo(answerCreated),
      members: Helpers.enCryptUserInfo(members),
      targetUserId: actionUserId,
    });
    set({ status: "accepted", answer: Helpers.enCryptUserInfo(answerCreated) });
    Helpers.updateURLParams("status", "accepted");
    Helpers.updateURLParams("callId", callId);
  },
  endCall: async (payload: any) => {
    const { roomId, actionUserId, status, callId } = payload;
    const socket = get().socket;
    const key = `${roomId}-${actionUserId}`;
    // xóa stream
    get()
      .stream.localStream?.getTracks()
      .forEach((track) => {
        track.stop();
      });
    get().stream.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    });
    // xóa peer connection
    get().stream.peerConnections.delete(key);

    set({
      status: "ended",
      roomId: null,
      stream: {
        localStream: null,
        remoteStreams: new Map<string, MediaStream>(),
        peerConnections: new Map<string, RTCPeerConnection>(),
      },
    });

    // socket emit end call
    socket?.emit("call:end", {
      roomId: roomId,
      actionUserId: actionUserId,
      status: status,
      callId: callId,
    });

    if (get().callMode === "sfu") {
      // Notify SFU server to clean up this participant before closing transports
      const currentRoomId = get().roomId;
      if (currentRoomId && socket) {
        socket.emit("signal", { type: "leave", roomId: currentRoomId, target: "sfu" });
      }
      get().sfu?.sendTransport?.close();
      get().sfu?.recvTransport?.close();
      set({
        sfu: {
          device: null,
          sendTransport: null,
          recvTransport: null,
          producers: new Map(),
          consumers: new Map(),
          pendingProduceCallbacks: new Map(),
        },
      });
    }
    // window.close is handled by page.tsx useEffect watching callStatus
  },
  handleEndCall: (payload: any) => {
    const { roomId, actionUserId, members } = payload;
    const isCallerEnded = members.some(
      (m: CallMember) => m.is_caller && m.status === "ended",
    );
    if (members.length > 2 && !isCallerEnded) {
      // nếu có nhiều hơn 2 người và người gọi không kết thúc cuộc gọi thì không kết thúc cuộc gọi
      console.log("Cuộc gọi có nhiều hơn 2 người, không kết thúc cuộc gọi");
      // xóa peer connection và stream
      const key = `${roomId}-${actionUserId}`;

      // Dừng tracks của stream trước khi xóa
      const streamToRemove = get().stream.remoteStreams.get(key);
      if (streamToRemove) {
        streamToRemove.getTracks().forEach((track) => {
          track.stop();
        });
      }

      // Đóng peer connection
      const pcToRemove = get().stream.peerConnections.get(key);
      if (pcToRemove) {
        pcToRemove.close();
      }

      // Tạo Map mới để trigger re-render trong Zustand
      const currentRemoteStreams = get().stream.remoteStreams;
      const newRemoteStreams = new Map(currentRemoteStreams);
      newRemoteStreams.delete(key);

      const currentPeerConnections = get().stream.peerConnections;
      const newPeerConnections = new Map(currentPeerConnections);
      newPeerConnections.delete(key);

      // Cập nhật state với Map mới
      set({
        stream: {
          ...get().stream,
          remoteStreams: newRemoteStreams,
          peerConnections: newPeerConnections,
        },
      });
      return;
    }
    // xóa stream
    get()
      .stream.localStream?.getTracks()
      .forEach((track) => {
        track.stop();
      });
    get().stream.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    });
    // xóa peer connection
    get().stream.peerConnections.forEach((pc) => {
      pc.close();
    });

    set({
      status: "ended",
      roomId: null,
      stream: {
        localStream: null,
        remoteStreams: new Map<string, MediaStream>(),
        peerConnections: new Map<string, RTCPeerConnection>(),
      },
    });
    // socket emit end call
    if (get().callMode === "sfu") {
      get().sfu?.sendTransport?.close();
      get().sfu?.recvTransport?.close();
      set({
        sfu: {
          device: null,
          sendTransport: null,
          recvTransport: null,
          producers: new Map(),
          consumers: new Map(),
          pendingProduceCallbacks: new Map(),
        },
      });
    }
    // window.close is handled by page.tsx useEffect watching callStatus
  },
  eventCall: async (event: string, payload: any) => {
    const authStore = useAuthStore.getState();
    const currentUser = authStore.user;
    const status = get().status;
    if (!currentUser) {
      console.warn("User not authenticated, cannot handle call event");
      return;
    }
    if (!window.opener && event !== "request") {
      return;
    }
    const { actionUserId, offer, answer, candidate, roomId, targetUserId } =
      payload;
    const socket = get().socket;
    switch (event) {
      case "request":
        if (window.opener) {
          return;
        }
        console.log("request", payload);
        await get().handleRequestCall(payload);
        break;
      case "accepted":
        await get().handleAcceptCall(payload);
        break;
      case "answer": {
        if (status !== "accepted") {
          console.error("Call not accepted, cannot handle answer event");
          return;
        }
        console.log("targetUserId", targetUserId);
        const answerDescription = Helpers.decryptUserInfo(answer);
        console.log("answerDescription", answerDescription);

        const key = `${roomId}-${actionUserId}`;
        const pc = get().stream.peerConnections.get(key);

        if (!pc) {
          console.error("Peer connection not found for answer");
          return;
        }

        // Verify the peer connection is in the correct state
        console.log("Peer connection signaling state:", pc.signalingState);
        console.log("Local description exists:", !!pc.localDescription);
        console.log("Remote description exists:", !!pc.remoteDescription);

        // The peer connection should have a local description (offer) set
        // and be in "have-local-offer" state to receive an answer
        if (pc.signalingState === "stable" && !pc.localDescription) {
          console.error(
            "Cannot set remote answer: peer connection is stable but has no local description",
          );
          return;
        }

        // If already have remote description, skip
        if (pc.remoteDescription) {
          console.warn("Remote description already set, skipping");
          await get().flushPendingCandidates(roomId, actionUserId);
          break;
        }

        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription(answerDescription),
          );
          await get().flushPendingCandidates(roomId, actionUserId);
        } catch (error) {
          console.error("Error setting remote description (answer):", error);
          throw error;
        }
        break;
      }
      case "end":
        await get().handleEndCall(payload);
        break;
      case "candidate":
        // console.log("candidate", candidate);
        const key = `${roomId}-${actionUserId}`;
        const iceCandidate = new RTCIceCandidate(candidate);
        const pc = get().stream.peerConnections.get(key);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(iceCandidate);
            // console.log("✅ Added Late ICE Candidate directly");
          } catch (err) {
            console.error("❌ Error adding late candidate:", err);
          }
        } else {
          // console.log("⏳ Queuing ICE candidate (waiting for remoteDescription)...");
          const pendingCandidates = get().pendingCandidates;
          if (!pendingCandidates.has(key)) {
            pendingCandidates.set(key, []);
          }
          pendingCandidates.get(key)!.push(iceCandidate);
        }
        break;
      case "member-joined":
        // Update member list and, for SFU callers waiting for someone to join,
        // transition from "calling" to "accepted" and start the call timer.
        set({ members: payload.members });
        if (get().status === "calling" && get().callMode === "sfu") {
          set({ status: "accepted", action: { ...get().action, duration: 0 } });
          Helpers.updateURLParams("status", "accepted");
          const interval = setInterval(() => {
            set((prev) => ({
              ...prev,
              action: { ...prev.action, duration: prev.action.duration + 1 },
            }));
          }, 1000);
          // Store cleanup reference
          setTimeout(() => clearInterval(interval), 24 * 60 * 60 * 1000);

          // Emit getProducers so the caller consumes all streams from the new member.
          // produce:broadcast may have arrived before recvTransport was ready and been
          // skipped, so we explicitly pull the producer list here as a safety net.
          // If recvTransport is not ready yet (still in SFU handshake), retry after a
          // short delay — createTransport(recv) is fired right after createTransport(send)
          // and should complete within a few hundred ms.
          const emitGetProducers = (attempt = 0) => {
            const { sfu: sfuNow, roomId: r, socket: s } = get();
            if (sfuNow?.recvTransport && sfuNow?.device && r && s) {
              s.emit("signal", { type: "getProducers", roomId: r, target: "sfu" });
            } else if (attempt < 10) {
              setTimeout(() => emitGetProducers(attempt + 1), 300);
            }
          };
          emitGetProducers();
        }
        break;
    }
  },
  handleCreateLocalStream: async () => {
    if (get().stream.localStream) {
      return;
    }
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({ stream: { ...get().stream, localStream: stream } });

      // If SFU sendTransport is already ready (race: transport was created before stream was captured),
      // produce tracks now so they aren't missed.
      // Guard: skip if tracks are already being produced (pendingProduceCallbacks) or already done (producers).
      const { sfu: sfuNow, callMode: nowCallMode } = get();
      if (
        nowCallMode === "sfu" &&
        sfuNow?.sendTransport &&
        !sfuNow.sendTransport.closed &&
        sfuNow.producers.size === 0 &&
        sfuNow.pendingProduceCallbacks.size === 0
      ) {
        // Race condition: sendTransport was created before getUserMedia resolved.
        // Produce tracks now and store the Producer objects so handleShareScreen
        // can call producer.replaceTrack() later.
        const newProducerEntries: [string, any][] = [];
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        if (audioTrack) {
          const ap = await sfuNow.sendTransport.produce({ track: audioTrack });
          newProducerEntries.push([ap.id, ap]);
        }
        if (videoTrack) {
          const vp = await sfuNow.sendTransport.produce({ track: videoTrack });
          newProducerEntries.push([vp.id, vp]);
        }
        if (newProducerEntries.length > 0) {
          const sfuLatest = get().sfu!;
          set({
            sfu: {
              ...sfuLatest,
              producers: new Map([...sfuLatest.producers, ...newProducerEntries]),
            },
          });
        }
      }

      // Populate devices list if empty
      if (currentState.devices.audioInputs.length === 0) {
        await get().getDevices();
      }
    } catch (error) {
      console.error("Error creating local stream:", error);
    }
  },
  handleCreatePeerConnection: async (roomId: string, actionUserId: string) => {
    const key = `${roomId}-${actionUserId}`;
    if (get().stream.peerConnections.has(key)) {
      return get().stream.peerConnections.get(key)!;
    }
    const socket = get().socket;
    const pc = new RTCPeerConnection(
      get().configPeerConnection as RTCConfiguration,
    );
    // Khi nhận được ICE Candidate từ bên kia
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("call:candidate", {
          candidate: event.candidate,
          roomId,
          actionUserId,
        });
      }
    };

    // Khi nhận được Stream từ bên kia
    pc.ontrack = (event) => {
      const currentRemoteStreams = get().stream.remoteStreams;
      if (!currentRemoteStreams.has(key)) {
        // nếu chưa có stream thì thêm vào map
        // Tạo Map mới để trigger re-render trong Zustand
        const newRemoteStreams = new Map(currentRemoteStreams);
        newRemoteStreams.set(key, event.streams[0]);
        set({ stream: { ...get().stream, remoteStreams: newRemoteStreams } });
      }
    };

    // Thêm tracks vào local stream
    const localStream = get().stream.localStream;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Tạo Map mới với các entries hiện có và thêm entry mới
    const currentPeerConnections = get().stream.peerConnections;
    const newPeerConnections = new Map(currentPeerConnections);
    newPeerConnections.set(key, pc);
    set({ stream: { ...get().stream, peerConnections: newPeerConnections } });
    return pc;
  },
  updateCallState: async (state) => {
    const currentUser = useAuthStore.getState().user;
    const socket = state.socket;
    if (state.status === "accepted") {
      set({ action: { ...get().action, duration: 0 } });
      const interval = setInterval(() => {
        set((prev) => ({
          ...prev,
          action: { ...prev.action, duration: prev.action.duration + 1 },
        }));
      }, 1000);
      return () => clearInterval(interval);
    }

    const effectiveCallMode = state.callMode || get().callMode;
    // Will be overridden with canonical room_id for late-joiners
    let canonicalRoomId = state.roomId;
    // Will be overridden from call:join ack for re-joiners:
    let canonicalMembers: CallMember[] = state.members ?? [];
    let elapsedSeconds = 0;

    if (state.status === "joined" && socket) {
      set((prev) => ({ ...prev, socket: state.socket }));

      const joinCallId = (state as any).callId || get().callId;
      let joinHistory: any = null; // captured from call:join ack

      // Emit call:join and use the ack to get the canonical room_id.
      // msg.roomId from the chat pipeline is the MongoDB _id (ObjectId), but the
      // call system (and other participants) use room.room_id (custom string).
      // Using the wrong roomId would put this client in a different socket/SFU room.
      if (joinCallId) {
        canonicalRoomId = await new Promise<string>((resolve) => {
          const fallback = setTimeout(() => resolve(state.roomId ?? ""), 3000);
          socket.emit(
            "call:join",
            { roomId: state.roomId, callId: joinCallId },
            (response: any) => {
              clearTimeout(fallback);
              if (response?.ok) {
                joinHistory = response.history || null;
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

      // Use the server's freshest member list so late-joining members (added after
      // the chat message was loaded) are included for correct stream→user mapping.
      if (joinHistory?.members?.length > 0) {
        canonicalMembers = joinHistory.members;
      }

      // Calculate elapsed duration so the timer starts at the right time,
      // not always from 0 (everyone joining mid-call would see 0:00).
      if (joinHistory?.started_at) {
        elapsedSeconds = Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(joinHistory.started_at).getTime()) / 1000,
          ),
        );
      }

      if (effectiveCallMode === "sfu") {
        // Tham gia SFU room với đúng room_id
        await get().initSFU();
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
            currentUser: currentUser,
            socket: state.socket,
            callId: joinCallId,
          });
        }, 1000);
      }
    } else if (state.status === "calling" && socket) {
      if (effectiveCallMode === "sfu") {
        // Emit call:request FIRST (with ack) to get canonical room.room_id,
        // then use it for signal:join so the SFU room is keyed by the correct ULID.
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
              resolve(
                response?.ok && response?.room?.room_id
                  ? response.room.room_id
                  : state.roomId ?? "",
              );
            },
          );
        });
        await get().initSFU();
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
      // For re-joiners: use server's latest members list and elapsed time.
      // Use prev.action as base (fully typed booleans) then override with state.action
      // fields and our calculated duration, avoiding undefined from Partial<CallAction>.
      members: canonicalMembers,
      action: {
        ...prev.action,
        ...(state.action ?? {}),
        duration: elapsedSeconds,
      },
      // Transition "joined" → "accepted" so the call UI renders
      ...(state.status === "joined" ? { status: "accepted" } : {}),
    }));

    // Start the duration timer for re-joiners. The "calling" path uses the
    // member-joined event to start it; "accepted" starts it in the branch above;
    // "joined" needs it started here after the status transitions to accepted.
    if (state.status === "joined") {
      const interval = setInterval(() => {
        set((prev) => ({
          ...prev,
          action: { ...prev.action, duration: prev.action.duration + 1 },
        }));
      }, 1000);
      setTimeout(() => clearInterval(interval), 24 * 60 * 60 * 1000);
    }

    // NOTE: For SFU group callers (status "calling"), we intentionally stay in "calling"
    // status until the first member joins (see member-joined event in eventCall).
  },
  flushPendingCandidates: async (roomId: string, actionUserId: string) => {
    const key = `${roomId}-${actionUserId}`;
    if (!window.opener) {
      return;
    }
    const pendingCandidates = get().pendingCandidates.get(key);
    const pc = get().stream.peerConnections.get(key);
    if (!pc) {
      console.error("Peer connection chưa được tạo");
      return;
    }
    const candidates = pendingCandidates || [];
    if (candidates && candidates.length > 0) {
      console.log(
        `✅ Flushing ${candidates.length} pending ICE candidates for room ${roomId}`,
      );
      for (const candidate of candidates) {
        try {
          await pc?.addIceCandidate(candidate);
          console.log("✅ ICE candidate added from queue:", candidate);
        } catch (err) {
          console.error("❌ Error adding queued ICE candidate:", err);
        }
      }
      get().pendingCandidates.delete(key);
    }
  },
  actionToggleTrack: async (
    action: "mic" | "video" | "speaker" | "shareScreen",
    value: boolean,
  ) => {
    const currentState = get();
    const localStream = currentState.stream.localStream;
    if (!localStream && action !== "shareScreen") {
      console.error("Stream chưa được tạo");
      return;
    }
    switch (action) {
      case "mic":
        localStream?.getAudioTracks().forEach((track: MediaStreamTrack) => {
          track.enabled = value;
        });
        set((prev) => ({
          ...prev,
          action: { ...prev.action, isMicEnabled: value },
        }));
        break;
      case "video":
        localStream?.getVideoTracks().forEach((track: MediaStreamTrack) => {
          track.enabled = value;
        });
        set((prev) => ({
          ...prev,
          action: { ...prev.action, isCameraEnabled: value },
        }));
        break;
      case "speaker":
        localStream?.getAudioTracks().forEach((track: MediaStreamTrack) => {
          track.enabled = value;
        });
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
  handleShareScreen: async (value: boolean) => {
    const currentState = get();
    const roomId = currentState.roomId;
    const localStream = currentState.stream.localStream;
    const mode = currentState.mode;

    if (!roomId) {
      console.error("RoomId không tồn tại");
      return;
    }

    if (mode !== "video") {
      console.error("Chỉ có thể share screen trong cuộc gọi video");
      return;
    }

    if (value) {
      // --- BẮT ĐẦU SHARE SCREEN ---
      try {
        // 1. Lấy stream màn hình
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true, // Thường tắt audio hệ thống để tránh vọng âm với Mic
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        // --- MIX AUDIO (Mic + System Audio) ---
        let mixedAudioTrack: MediaStreamTrack | null = null;
        const micTrack = localStream?.getAudioTracks()[0];

        if (micTrack && screenAudioTrack) {
          // Merge 2 tracks
          const audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();

          // Mic Source
          const micStream = new MediaStream([micTrack]);
          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(destination);

          // System Audio Source
          const sysStream = new MediaStream([screenAudioTrack]);
          const sysSource = audioContext.createMediaStreamSource(sysStream);
          sysSource.connect(destination);

          mixedAudioTrack = destination.stream.getAudioTracks()[0];
        } else {
          mixedAudioTrack = screenAudioTrack || micTrack || null;
        }

        // 2. Thay thế track Video (và Audio) — P2P: replace sender, SFU: replaceTrack on producer
        const { callMode: nowMode, sfu: sfuNow } = get();
        if (nowMode === "sfu" && sfuNow?.sendTransport) {
          // SFU: find the video producer and replace its track
          for (const producer of sfuNow.producers.values()) {
            if (producer.kind === "video" && !producer.closed) {
              await producer.replaceTrack({ track: screenTrack });
            }
            if (producer.kind === "audio" && !producer.closed && mixedAudioTrack) {
              await producer.replaceTrack({ track: mixedAudioTrack });
            }
          }
        } else {
          // P2P: replace track in each peer connection sender
          const peerConnections = currentState.stream.peerConnections;
          for (const [key, pc] of peerConnections.entries()) {
            const videoSender = pc
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (videoSender) {
              await videoSender.replaceTrack(screenTrack);
            }

            if (mixedAudioTrack) {
              const audioSender = pc
                .getSenders()
                .find((s) => s.track?.kind === "audio");
              if (audioSender) {
                await audioSender.replaceTrack(mixedAudioTrack);
              }
            }
          }
        }

        // 3. Xử lý khi người dùng bấm "Stop Sharing" trên thanh công cụ trình duyệt
        screenTrack.onended = () => {
          get().actionToggleTrack("shareScreen", false); // Gọi đệ quy để tắt
        };

        // 4. Lưu camera track để có thể quay lại sau
        const cameraTrack = localStream?.getVideoTracks()[0];

        // 5. Cập nhật Local Stream để UI hiển thị màn hình mình đang share
        if (localStream && cameraTrack) {
          // Tạo stream mới với audio từ localStream và video từ screen
          const newLocalStream = new MediaStream();
          // Thêm audio tracks từ localStream
          localStream.getAudioTracks().forEach((track) => {
            newLocalStream.addTrack(track);
          });
          // Thêm screen track
          newLocalStream.addTrack(screenTrack);

          set((prev) => ({
            ...prev,
            stream: { ...prev.stream, localStream: newLocalStream },
            action: {
              ...prev.action,
              isSharingScreen: true,
              isCameraEnabled: false,
            },
          }));
        } else {
          set((prev) => ({
            ...prev,
            stream: { ...prev.stream, localStream: screenStream },
            action: {
              ...prev.action,
              isSharingScreen: true,
              isCameraEnabled: false,
            },
          }));
        }

        // Emit event to notify others
        currentState.socket?.emit("call:share-screen", {
          roomId,
          actionUserId: useAuthStore.getState().user?.id,
          isSharing: true,
        });
      } catch (err) {
        console.error("User cancelled screen share or error:", err);
        // Reset lại nút toggle nếu user hủy
        set((prev) => ({
          ...prev,
          action: { ...prev.action, isSharingScreen: false },
        }));
      }
    } else {
      // --- DỪNG SHARE SCREEN (QUAY LẠI CAMERA) ---
      try {
        // 1. Lấy lại Camera Stream
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        const cameraTrack = cameraStream.getVideoTracks()[0];
        const micTrack = cameraStream.getAudioTracks()[0];

        // 2. Thay thế track Screen → Camera — P2P: replace sender, SFU: replaceTrack on producer
        const { callMode: nowMode2, sfu: sfuNow2 } = get();
        if (nowMode2 === "sfu" && sfuNow2?.sendTransport) {
          for (const producer of sfuNow2.producers.values()) {
            if (producer.kind === "video" && !producer.closed) {
              await producer.replaceTrack({ track: cameraTrack });
            }
            if (producer.kind === "audio" && !producer.closed) {
              await producer.replaceTrack({ track: micTrack });
            }
          }
        } else {
          const peerConnections = get().stream.peerConnections;
          for (const [key, pc] of peerConnections.entries()) {
            const videoSender = pc
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (videoSender) {
              await videoSender.replaceTrack(cameraTrack);
            }

            // Restore Audio Track
            const audioSender = pc
              .getSenders()
              .find((s) => s.track?.kind === "audio");
            if (audioSender) {
              await audioSender.replaceTrack(micTrack);
            }
          }
        }

        // 3. Dừng track màn hình cũ (để tắt đèn báo share của trình duyệt)
        const currentLocalStream = get().stream.localStream;
        currentLocalStream?.getVideoTracks().forEach((track) => {
          if (
            (track.kind === "video" && track.label.includes("screen")) ||
            track.label.includes("Screen")
          ) {
            track.stop();
          }
        });

        // 4. Cập nhật local stream với camera
        set((prev) => ({
          ...prev,
          stream: { ...prev.stream, localStream: cameraStream },
          action: {
            ...prev.action,
            isSharingScreen: false,
            isCameraEnabled: true,
          },
        }));

        // Emit event to notify others
        currentState.socket?.emit("call:share-screen", {
          roomId,
          actionUserId: useAuthStore.getState().user?.id,
          isSharing: false,
        });
      } catch (err) {
        console.error("Error reverting to camera:", err);
        set((prev) => ({
          ...prev,
          action: { ...prev.action, isSharingScreen: false },
        }));
      }
    }
  },
  setUserIdGhimmed: (userId: string) => {
    set((prev) => ({
      ...prev,
      action: { ...prev.action, userIdGhimmed: userId },
    }));
  },
  getDevices: async () => {
    try {
      // Request permission first to get labels if not already granted
      // This might trigger a permission prompt
      // await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput",
      );
      const audioOutputs = devices.filter(
        (device) => device.kind === "audiooutput",
      );
      const videoInputs = devices.filter(
        (device) => device.kind === "videoinput",
      );

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
      console.error("Error getting devices:", error);
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
    // If changing input device, we need to restart the stream
    if (type === "audioInput" || type === "videoInput") {
      const currentState = get();
      const currentStream = currentState.stream.localStream;

      if (currentStream) {
        // Stop current tracks
        currentStream.getTracks().forEach((track) => track.stop());

        // Create new stream with selected devices
        const constraints = {
          audio: {
            deviceId: {
              exact:
                type === "audioInput"
                  ? deviceId
                  : currentState.devices.selectedAudioInput,
            },
          },
          video:
            currentState.mode === "video"
              ? {
                  deviceId: {
                    exact:
                      type === "videoInput"
                        ? deviceId
                        : currentState.devices.selectedVideoInput,
                  },
                }
              : false,
        };

        try {
          const newStream =
            await navigator.mediaDevices.getUserMedia(constraints);

          // Replace tracks in peer connections
          const peerConnections = currentState.stream.peerConnections;
          for (const [key, pc] of peerConnections.entries()) {
            const senders = pc.getSenders();

            const audioTrack = newStream.getAudioTracks()[0];
            const videoTrack = newStream.getVideoTracks()[0];

            if (audioTrack) {
              const audioSender = senders.find(
                (s) => s.track?.kind === "audio",
              );
              if (audioSender) await audioSender.replaceTrack(audioTrack);
            }

            if (videoTrack) {
              const videoSender = senders.find(
                (s) => s.track?.kind === "video",
              );
              if (videoSender) await videoSender.replaceTrack(videoTrack);
            }
          }

          set((prev) => ({
            ...prev,
            stream: { ...prev.stream, localStream: newStream },
          }));
        } catch (error) {
          console.error("Error switching device:", error);
        }
      }
    }
  },
  initSFU: async () => {
    try {
      if (get().sfu?.device) return;

      const device = new Device();
      set({
        sfu: {
          ...get().sfu!,
          device,
        },
      });
      console.log("SFU Device initialized");
    } catch (error) {
      console.error("Failed to initialize SFU device:", error);
    }
  },
  handleSFUSignal: async (payload: any) => {
    const {
      type,
      ok,
      rtpCapabilities,
      sender,
      target,
      transportId,
      iceParameters,
      iceCandidates,
      dtlsParameters,
      producerId,
      kind,
      rtpParameters,
      consumerId,
      message,
    } = payload;
    const { socket, sfu, roomId, stream } = get();
    const userId = useAuthStore.getState().user?.id;

    if (ok === false) {
      // createTransport failure (participant missing) — re-join the SFU room to recover
      if (type === "createTransport" && socket && roomId) {
        console.warn(
          `[SFU] createTransport failed (${message}), re-joining SFU room...`,
        );
        socket.emit("signal", { type: "join", roomId, target: "sfu" });
      } else {
        console.error(`SFU Signal error (${type}):`, message);
      }
      return;
    }

    try {
    switch (type) {
      case "join": {
        const { socket: currentSocket, sfu: currentSfu, roomId: currentRoomId } = get();
        if (!currentSfu?.device) return;

        // Guard: skip load if already loaded (idempotent — handles reconnect/retry)
        if (!currentSfu.device.loaded) {
          await currentSfu.device.load({ routerRtpCapabilities: rtpCapabilities });
        }

        // Always emit createTransport — even on retry after a failed attempt
        currentSocket?.emit("signal", {
          type: "createTransport",
          roomId: currentRoomId,
          target: "sfu",
          direction: "send",
        });
        break;
      }

      case "createTransport": {
        if (!sfu?.device || !roomId) return;

        const isSend = !sfu.sendTransport;
        const transport = isSend
          ? sfu.device.createSendTransport({
              id: transportId,
              iceParameters,
              iceCandidates,
              dtlsParameters,
            })
          : sfu.device.createRecvTransport({
              id: transportId,
              iceParameters,
              iceCandidates,
              dtlsParameters,
            });

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket?.emit("signal", {
            type: "connectTransport",
            roomId,
            target: "sfu",
            transportId: transport.id,
            dtlsParameters,
          });
          // For now we assume success, ideally we'd wait for an ack from socket
          callback();
        });

        if (isSend) {
          transport.on(
            "produce",
            ({ kind, rtpParameters, appData }, callback, _errback) => {
              // Generate a unique requestId to match this callback when produce:me arrives
              const requestId =
                Math.random().toString(36).slice(2) +
                Date.now().toString(36);
              const currentSfu = get().sfu!;
              const newCallbacks = new Map(
                currentSfu.pendingProduceCallbacks,
              );
              newCallbacks.set(requestId, callback);
              set({ sfu: { ...currentSfu, pendingProduceCallbacks: newCallbacks } });

              socket?.emit("signal", {
                type: "produce",
                roomId,
                target: "sfu",
                transportId: transport.id,
                kind,
                rtpParameters,
                appData: { ...(appData as object), requestId },
              });
            },
          );

          // Use freshest sfu state to avoid overwriting producers/consumers added
          // concurrently by handleCreateLocalStream (stale `sfu` from top-level
          // destructure would lose any producers already stored there).
          set({ sfu: { ...get().sfu!, sendTransport: transport } });

          // Re-read stream fresh in case getUserMedia resolved while we were doing SFU handshake.
          // Guard: only produce if handleCreateLocalStream hasn't already produced (producers.size > 0)
          // or is currently producing (pendingProduceCallbacks.size > 0) to avoid duplicate producers
          // that cause router.canConsume() to fail on the consumer side.
          const freshStream = get().stream;
          const freshSfuForProduce = get().sfu!;
          if (
            freshStream.localStream &&
            freshSfuForProduce.producers.size === 0 &&
            freshSfuForProduce.pendingProduceCallbacks.size === 0
          ) {
            const audioTrack = freshStream.localStream.getAudioTracks()[0];
            const videoTrack = freshStream.localStream.getVideoTracks()[0];

            if (audioTrack) await transport.produce({ track: audioTrack });
            if (videoTrack) await transport.produce({ track: videoTrack });
          }

          // Also create receive transport
          socket?.emit("signal", {
            type: "createTransport",
            roomId,
            target: "sfu",
            direction: "recv",
          });
        } else {
          set({ sfu: { ...get().sfu!, recvTransport: transport } });
          // Request existing producers so late-joiners and re-joiners get all streams
          socket?.emit("signal", {
            type: "getProducers",
            roomId,
            target: "sfu",
          });
        }
        break;
      }

      case "produce": {
        if (target === "me") {
          // Call the stored callback so transport.produce() resolves
          const reqId = payload.appData?.requestId;
          if (reqId) {
            const { sfu: sfuNow } = get();
            const cb = sfuNow?.pendingProduceCallbacks?.get(reqId);
            if (cb) {
              cb({ id: producerId });
              const newCbs = new Map(sfuNow!.pendingProduceCallbacks);
              newCbs.delete(reqId);
              set({ sfu: { ...sfuNow!, pendingProduceCallbacks: newCbs } });
            }
          }
        } else if (target === "broadcast") {
          // Someone else started producing — consume their stream.
          // If recvTransport is not ready yet, skip: getProducers (emitted after recvTransport is
          // created) will include this producer and we'll consume it then.
          const { sfu: sfuNow, roomId: r, socket: s } = get();
          if (!sfuNow?.recvTransport || !sfuNow?.device) break;
          s?.emit("signal", {
            type: "consume",
            roomId: r,
            target: "sfu",
            transportId: sfuNow.recvTransport.id,
            producerId,
            rtpCapabilities: sfuNow.device.rtpCapabilities,
            userId: payload.userId, // pass producer's userId so BE echoes it back
          });
        }
        break;
      }

      case "getProducers": {
        // Consume all existing producers in the room (for late-join / re-join)
        const { socket: s, sfu: sfuNow, roomId: r } = get();
        if (!sfuNow?.recvTransport || !sfuNow?.device) return;
        const producers: Array<{ producerId: string; userId: string; kind: string }> =
          payload.producers || [];
        for (const { producerId: pid, userId: pUserId } of producers) {
          s?.emit("signal", {
            type: "consume",
            roomId: r,
            target: "sfu",
            transportId: sfuNow.recvTransport.id,
            producerId: pid,
            rtpCapabilities: sfuNow.device.rtpCapabilities,
            userId: pUserId,
          });
        }
        break;
      }

      case "consume": {
        const { sfu: sfuNow } = get();
        if (!sfuNow?.recvTransport) return;

        const consumer = await sfuNow.recvTransport.consume({
          id: consumerId,
          producerId,
          kind,
          rtpParameters,
        });

        // Re-read ALL state AFTER the await — two concurrent consume handlers (audio + video)
        // must each see the latest remoteStreams Map to avoid overwriting each other's track.
        // Also re-read sfu so the consumers Map spread uses the freshest state.
        const { stream: freshStream, roomId: freshR, sfu: freshSfu } = get();
        const trackUserId = payload.userId || producerId;
        const key = `${freshR}-${trackUserId}`;
        const newRemoteStreams = new Map(freshStream.remoteStreams);
        const existing = newRemoteStreams.get(key);
        if (existing) {
          // Add this track to the existing stream for the same user
          existing.addTrack(consumer.track);
        } else {
          newRemoteStreams.set(key, new MediaStream([consumer.track]));
        }

        set({
          stream: { ...freshStream, remoteStreams: newRemoteStreams },
          sfu: {
            ...(freshSfu ?? sfuNow),
            consumers: new Map(freshSfu?.consumers ?? sfuNow.consumers).set(consumer.id, consumer),
          },
        });
        break;
      }
    }
    } catch (error) {
      console.error(`[SFU] handleSFUSignal error in case "${type}":`, error);
      // If the join phase failed (e.g. device.load threw), retry the SFU join
      // so the user doesn't get stuck with no media.
      if (type === "join") {
        const { socket: s, roomId: r } = get();
        if (s && r) {
          console.warn("[SFU] Retrying SFU init due to error in case 'join'...");
          await get().initSFU();
          s.emit("signal", { type: "join", roomId: r, target: "sfu" });
        }
      }
    }
  },
}));
export default useCallStore;
