import { create } from "zustand";
import { CallMember, CallState } from "./types/call.state";
import Helpers from "@/libs/helpers";
import useAuthStore from "./useAuthStore";
import { User } from "@/types/auth.type";

const useCallStore = create<CallState>()((set, get) => ({
  roomId: null,
  status: "idle",
  mode: "audio",
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
  answer: null,
  openCall: (payload) => {
    // calling: người gọi
    const { roomId, mode, members, currentUser, socket } = payload;
    const memberMap = members.map((m: User) => ({
      id: m.id,
      fullname: m.fullname,
      avatar: m.avatar,
      is_caller: m.id == currentUser.id,
      status: m.id == currentUser.id ? "started" : "pending",
    }));
    const encodedMemberInfo = Helpers.enCryptUserInfo(memberMap);
    window.open(
      `/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${mode}&status=calling&isCaller=true`,
      "",
      "width=800,height=600"
    );
    socket?.emit("call:request", {
      actionUserId: currentUser.id,
      membersIds: members.map((m: User) => m.id),
      roomId: roomId,
      callType: mode,
    });
  },
  handleRequestCall: async (payload: any) => {
    // incoming: người bị gọi
    const { roomId, members, actionUserId, callType } = payload;
    const encodedMemberInfo = Helpers.enCryptUserInfo(members);
    window.open(
      `/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${callType}&status=incoming`,
      "",
      "width=800,height=600"
    );
  },
  acceptCall: async (payload) => {
    // accepted: người bị gọi
    const { roomId, members, currentUser, socket } = payload;
    const actionUserId = currentUser.id;
    const membersNew = members.map((m: CallMember) => ({
      ...m,
      status: m.id === currentUser.id ? "started" : m.status,
    }));
    set({ status: "accepted", members: membersNew });
    Helpers.updateURLParams("status", "accepted");
    Helpers.updateURLParams("members", Helpers.enCryptUserInfo(membersNew));
    const otherMembers = membersNew.filter(
      (m: CallMember) => m.id !== currentUser.id
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
      });
    }
  },
  handleAcceptCall: async (payload: any) => {
    // accepted: người gọi
    const { roomId, offer, members, actionUserId } = payload;
    console.log("handleAcceptCall", payload);
    const socket = get().socket;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      console.error("User not authenticated, cannot handle call event");
      return;
    }
    
    // Use members from payload if available, otherwise fallback to store
    const membersToCheck = members || get().members;
    
    // Update members in store to reflect the new status
    if (members) {
        set({ members });
    }

    const userStarted = membersToCheck.find(
      (m: CallMember) => m.id === currentUser.id && m.status === "started"
    );
    
    if (!userStarted) {
      console.log("User is not started (pending), skipping P2P connection establishment.");
      return;
    }
    
    // Nhận offer từ người gọi
    const offerDescription = Helpers.decryptUserInfo(offer);
    const pc = await get().handleCreatePeerConnection(roomId, actionUserId);
    
    if (pc.signalingState !== "stable") {
        console.warn("Peer connection not stable", pc.signalingState);
        // If we are in 'have-local-offer', it means we (the caller) already created an offer?
        // But here we are receiving an offer from the callee (in this architecture).
        // If we are the caller, we shouldn't have a local offer set for *this* peer connection 
        // unless we are renegotiating.
        // But wait, handleCreatePeerConnection creates a NEW pc if not exists.
        // If it exists, it returns it.
        
        // If we are the caller, we might have created the PC in openCall?
        // No, openCall just opens the window.
        // The PC is created when we receive 'call:accepted' (here) or when we initiate?
        // In this app, it seems the Caller waits for Callee to 'accept' and send an Offer?
        // Let's check acceptCall.
        // acceptCall (Callee) -> creates PC -> creates Offer -> emits 'call:accepted'.
        // handleAcceptCall (Caller) -> receives Offer -> sets Remote -> creates Answer -> emits 'call:answer'.
        
        // So Caller should be in 'stable' state initially.
        if (pc.signalingState === 'have-local-offer') {
             // This is weird. Maybe we are renegotiating?
             // Or maybe we are the Callee and we received our own offer back? No.
             console.warn("Rolling back local offer to accept remote offer");
             try {
                await pc.setLocalDescription({type: "rollback"});
             } catch (e) {
                 console.error("Rollback failed:", e);
             }
        }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerCreated = await pc.createAnswer();
    await pc.setLocalDescription(answerCreated);
    socket?.emit("call:answer", {
      roomId: roomId,
      answer: Helpers.enCryptUserInfo(answerCreated),
      members: Helpers.enCryptUserInfo(members),
      targetUserId: actionUserId,
    });
    set({
      status: "accepted",
      answer: Helpers.enCryptUserInfo(answerCreated),
      members: members,
    });
    Helpers.updateURLParams("status", "accepted");
  },
  endCall: async (payload: any) => {
    const { roomId, actionUserId, status } = payload;
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
    });
    // close window
    window.opener && window.close();
  },
  handleEndCall: (payload: any) => {
    const { roomId, actionUserId, members } = payload;
    const currentUser = useAuthStore.getState().user;

    // Case 1: Mình là người kết thúc cuộc gọi -> Dọn dẹp và đóng cửa sổ
    if (currentUser && actionUserId === currentUser.id) {
      get().stream.localStream?.getTracks().forEach((track) => track.stop());
      get().stream.remoteStreams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      get().stream.peerConnections.forEach((pc) => pc.close());

      set({
        status: "ended",
        roomId: null,
        stream: {
          localStream: null,
          remoteStreams: new Map<string, MediaStream>(),
          peerConnections: new Map<string, RTCPeerConnection>(),
        },
        members: members,
      });
      window.opener && window.close();
      return;
    }

    // Case 2: Người khác kết thúc cuộc gọi
    const isCallerEnded = members.some(
      (m: CallMember) => m.is_caller && m.status === "ended"
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
        members: members,
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
    window.opener && window.close();
  },
  eventCall: async (event: string, payload: any) => {
    const authStore = useAuthStore.getState();
    const currentUser = authStore.user;
    const status = get().status;
    if (!currentUser) {
      console.warn("User not authenticated, cannot handle call event");
      return;
    }
    // if (!window.opener && event !== "request") {
    //   return;
    // }
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
            "Cannot set remote answer: peer connection is stable but has no local description"
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
            new RTCSessionDescription(answerDescription)
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
        console.log("Received candidate from", actionUserId, candidate);
        const key = `${roomId}-${actionUserId}`;
        const iceCandidate = new RTCIceCandidate(candidate);
        const pc = get().stream.peerConnections.get(key);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(iceCandidate);
            console.log("✅ Added Late ICE Candidate directly");
          } catch (err) {
            console.error("❌ Error adding late candidate:", err);
            console.error("Candidate:", candidate);
            console.error("Remote Description SDP:", pc.remoteDescription.sdp);
          }
        } else {
          console.log("⏳ Queuing ICE candidate (waiting for remoteDescription)...");
          const pendingCandidates = get().pendingCandidates;
          if (!pendingCandidates.has(key)) {
            pendingCandidates.set(key, []);
          }
          pendingCandidates.get(key)!.push(iceCandidate);
        }
        break;
      case "end":
        await get().handleEndCall(payload);
        break;
    }
  },
  handleCreateLocalStream: async () => {
    if (get().stream.localStream) {
      return;
    }
    const currentState = get();
    const constraints: MediaStreamConstraints = {
      audio: currentState.devices.selectedAudioInput ? { deviceId: { exact: currentState.devices.selectedAudioInput } } : true,
      video: currentState.mode === "video" ? (currentState.devices.selectedVideoInput ? { deviceId: { exact: currentState.devices.selectedVideoInput } } : true) : false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({ stream: { ...get().stream, localStream: stream } });
      
      // Add tracks to existing peer connections if they were created before the stream
      const peerConnections = get().stream.peerConnections;
      peerConnections.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          // Check if track already exists in sender
          const senders = pc.getSenders();
          const hasTrack = senders.some(s => s.track?.id === track.id);
          if (!hasTrack) {
             pc.addTrack(track, stream);
          }
        });
      });

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
      get().configPeerConnection as RTCConfiguration
    );
    // Khi nhận được ICE Candidate từ bên kia
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate to", actionUserId);
        socket?.emit("call:candidate", {
          candidate: event.candidate,
          roomId,
          actionUserId,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE Connection State (${key}):`, pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
            console.error(`ICE connection failed for ${key}.`);
        }
    };

    pc.onconnectionstatechange = () => {
        console.log(`Connection State (${key}):`, pc.connectionState);
    };

    // Khi nhận được Stream từ bên kia
    pc.ontrack = (event) => {
      const streamFromEvent = event.streams[0];
      set((prev) => {
        const currentStream = prev.stream.remoteStreams.get(key);
        let finalStream = currentStream;

        if (streamFromEvent) {
          finalStream = streamFromEvent;
        } else {
          if (currentStream) {
            if (!currentStream.getTracks().find((t) => t.id === event.track.id)) {
              currentStream.addTrack(event.track);
            }
            finalStream = currentStream;
          } else {
            finalStream = new MediaStream([event.track]);
          }
        }
        
        // Force update by creating a new Map
        const updatedRemoteStreams = new Map(prev.stream.remoteStreams);
        updatedRemoteStreams.set(key, finalStream!);
        
        // Also ensure we trigger a re-render by updating a timestamp or similar if needed
        // But Zustand should handle the new Map reference.
        
        return {
          stream: {
            ...prev.stream,
            remoteStreams: updatedRemoteStreams,
          },
        };
      });
    };

    // Thêm tracks vào local stream
    const localStream = get().stream.localStream;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        // Check if track already exists
        const senders = pc.getSenders();
        const hasTrack = senders.some(s => s.track?.id === track.id);
        if (!hasTrack) {
            pc.addTrack(track, localStream);
        }
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
    if (state.status === "accepted") {
      set({ action: { ...get().action, duration: 0 } });
      const interval = setInterval(() => {
        set((prev) => ({
          ...prev,
          action: { ...prev.action, duration: prev.action.duration + 1 },
        }));
      }, 1000);
      return () => clearInterval(interval);
    } else if (state.status === "joined" && state.socket) {
      set((prev) => ({
        ...prev,
        socket: state.socket,
      }));
      setTimeout(async () => {
        await get().acceptCall({
          roomId: state.roomId,
          members: state.members,
          currentUser: currentUser,
          socket: state.socket,
        });
      }, 1000);
    }
    set((prev) => ({
      ...prev,
      ...state,
    }));
  },
  flushPendingCandidates: async (roomId: string, actionUserId: string) => {
    const key = `${roomId}-${actionUserId}`;
    // if (!window.opener) {
    //   return;
    // }
    const pendingCandidates = get().pendingCandidates.get(key);
    const pc = get().stream.peerConnections.get(key);
    if (!pc) {
      console.error("Peer connection chưa được tạo");
      return;
    }
    const candidates = pendingCandidates || [];
    if (candidates && candidates.length > 0) {
      console.log(
        `✅ Flushing ${candidates.length} pending ICE candidates for room ${roomId}`
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
    value: boolean
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

        // 2. Thay thế track Video và Audio cho tất cả peer connections
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
            isSharing: true
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

        // 2. Thay thế track Screen đang chạy bằng Camera Track cho tất cả peer connections
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
            isSharing: false
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
      const audioInputs = devices.filter((device) => device.kind === "audioinput");
      const audioOutputs = devices.filter((device) => device.kind === "audiooutput");
      const videoInputs = devices.filter((device) => device.kind === "videoinput");

      set((prev) => ({
        ...prev,
        devices: {
          ...prev.devices,
          audioInputs,
          audioOutputs,
          videoInputs,
          selectedAudioInput: prev.devices.selectedAudioInput || audioInputs[0]?.deviceId || "",
          selectedAudioOutput: prev.devices.selectedAudioOutput || audioOutputs[0]?.deviceId || "",
          selectedVideoInput: prev.devices.selectedVideoInput || videoInputs[0]?.deviceId || "",
        },
      }));
    } catch (error) {
      console.error("Error getting devices:", error);
    }
  },
  setDevice: async (type, deviceId) => {
    set((prev) => ({
      ...prev,
      devices: { ...prev.devices, [type === 'audioInput' ? 'selectedAudioInput' : type === 'audioOutput' ? 'selectedAudioOutput' : 'selectedVideoInput']: deviceId },
    }));

    // If changing input device, we need to restart the stream
    if (type === 'audioInput' || type === 'videoInput') {
        const currentState = get();
        const currentStream = currentState.stream.localStream;
        
        if (currentStream) {
            // Stop current tracks
            currentStream.getTracks().forEach(track => track.stop());
            
            // Create new stream with selected devices
            const constraints = {
                audio: { deviceId: { exact: type === 'audioInput' ? deviceId : currentState.devices.selectedAudioInput } },
                video: currentState.mode === 'video' ? { deviceId: { exact: type === 'videoInput' ? deviceId : currentState.devices.selectedVideoInput } } : false
            };
            
            try {
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                
                // Replace tracks in peer connections
                const peerConnections = currentState.stream.peerConnections;
                for (const [key, pc] of peerConnections.entries()) {
                    const senders = pc.getSenders();
                    
                    const audioTrack = newStream.getAudioTracks()[0];
                    const videoTrack = newStream.getVideoTracks()[0];
                    
                    if (audioTrack) {
                        const audioSender = senders.find(s => s.track?.kind === 'audio');
                        if (audioSender) await audioSender.replaceTrack(audioTrack);
                    }
                    
                    if (videoTrack) {
                        const videoSender = senders.find(s => s.track?.kind === 'video');
                        if (videoSender) await videoSender.replaceTrack(videoTrack);
                    }
                }
                
                set((prev) => ({
                    ...prev,
                    stream: { ...prev.stream, localStream: newStream }
                }));
            } catch (error) {
                console.error("Error switching device:", error);
            }
        }
    }
  },
}));
export default useCallStore;
