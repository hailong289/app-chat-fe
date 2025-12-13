import { create } from "zustand";
import { CallMember, CallState } from "./types/call.state";
import Helpers from "@/libs/helpers";
import useAuthStore from "./useAuthStore";
import { User } from "@/types/auth.type";

const useCallStore = create<CallState>()(
    (set, get) => ({
        roomId: null,
        status: 'idle',
        mode: 'audio',
        members: [] as CallMember[],
        error: null,
        isWindowOpen: false,
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
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
        },
        socket: null,
        actionUserId: null,
        answer: null,
        openCall: (payload) => { // calling: người gọi
            const { roomId, mode, members, currentUser, socket } = payload;
            const memberMap = members.map((m: User) => ({
                id: m.id,
                fullname: m.fullname,
                avatar: m.avatar,
                is_caller: m.id == currentUser.id,
            }));
            const encodedMemberInfo = Helpers.enCryptUserInfo(memberMap);
            window.open(`/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${mode}&status=calling&isCaller=true`, '', 'width=800,height=600');
            socket?.emit('call:request', {
                actionUserId: currentUser.id,
                membersIds: members.map((m: User) => m.id),
                roomId: roomId,
                callType: mode,
            });
        },
        handleRequestCall: async (payload: any) => { // incoming: người bị gọi
            const { roomId, members, actionUserId, callType } = payload;
            const encodedMemberInfo = Helpers.enCryptUserInfo(members);
            window.open(`/call?roomId=${roomId}&members=${encodedMemberInfo}&callType=${callType}&status=incoming`, '', 'width=500,height=600');
        },
        acceptCall: async (payload) => { // accepted: người bị gọi
            const { roomId, members, currentUser, socket } = payload;
            const actionUserId = currentUser.id;
            const membersNew = members.map((m: CallMember) => ({
                ...m,
                status: m.id === currentUser.id ? 'started' : m.status,
            }));
            set({ status: 'accepted', members: membersNew });
            Helpers.updateURLParams('status', 'accepted');
            Helpers.updateURLParams('members', Helpers.enCryptUserInfo(membersNew));
            const otherMembers = membersNew.filter((m: CallMember) => m.id !== currentUser.id);
            for (const member of otherMembers) {
                // Tạo peer connection
                const pc = await get().handleCreatePeerConnection(roomId, member.id);
                // tạo offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                // gửi offer đến người bị gọi
                socket?.emit('call:accepted', {
                    membersIds: members.map((m: User) => m.id),
                    actionUserId: actionUserId,
                    roomId: roomId,
                    targetUserId: member.id,
                    offer: Helpers.enCryptUserInfo(offer),
                });
            }
            // // Tạo peer connection
            // const pc = await get().handleCreatePeerConnection(roomId, actionUserId);
            // // tạo offer
            // const offer = await pc.createOffer();
            // await pc.setLocalDescription(offer);
            // // gửi offer đến người gọi
            // socket?.emit('call:accepted', { // gửi offer đến người gọi
            //     membersIds: members.map((m: User) => m.id),
            //     actionUserId: actionUserId,
            //     roomId: roomId,
            //     offer: Helpers.enCryptUserInfo(offer),
            // });
        },
        handleAcceptCall: async (payload: any) => { // accepted: người gọi
            const { roomId, offer, members, actionUserId } = payload;
            const socket = get().socket;
            const currentUser = useAuthStore.getState().user;
            if (!currentUser) {
                console.error("User not authenticated, cannot handle call event");
                return;
            }
            const userStarted = members.find((m: CallMember) => m.id === currentUser.id && m.status === 'started');
            if (!userStarted) {
                console.error("User not found in members");
                return;
            }
            console.log('handleAcceptCall', userStarted);
            // Nhận offer từ người gọi
            const offerDescription = Helpers.decryptUserInfo(offer);
            const pc = await get().handleCreatePeerConnection(roomId, actionUserId);
            await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
            const answerCreated = await pc.createAnswer();
            await pc.setLocalDescription(answerCreated);
            socket?.emit('call:answer', {
                roomId: roomId,
                answer: Helpers.enCryptUserInfo(answerCreated),
                members: Helpers.enCryptUserInfo(members),
                targetUserId: actionUserId,
            });
            set({ status: 'accepted', answer: Helpers.enCryptUserInfo(answerCreated) });
            Helpers.updateURLParams('status', 'accepted');
        },
        endCall: async (payload: any) => {
            const { roomId, actionUserId, status } = payload;
            const socket = get().socket;
            const key = `${roomId}-${actionUserId}`;
            // xóa stream
            get().stream.localStream?.getTracks().forEach((track) => {
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
                status: 'ended',
                roomId: null,
                stream: {
                    localStream: null,
                    remoteStreams: new Map<string, MediaStream>(),
                    peerConnections: new Map<string, RTCPeerConnection>(),
                },
            });

            // socket emit end call
            socket?.emit('call:end', {
                roomId: roomId,
                actionUserId: actionUserId,
                status: status,
            });
            // close window
            window.opener && window.close();
        },
        handleEndCall: (payload: any) => {
            const { roomId, actionUserId, status } = payload;
            const key = `${roomId}-${actionUserId}`;
            // xóa stream
            get().stream.localStream?.getTracks().forEach((track) => {
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
                status: 'ended',
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
            if (!window.opener && event !== "request") {
                return;
            }
            const { actionUserId, offer, answer, candidate, roomId, targetUserId } = payload;
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
                    if (status !== 'accepted') {
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
                    if (pc.signalingState === 'stable' && !pc.localDescription) {
                        console.error("Cannot set remote answer: peer connection is stable but has no local description");
                        return;
                    }
                    
                    // If already have remote description, skip
                    if (pc.remoteDescription) {
                        console.warn("Remote description already set, skipping");
                        await get().flushPendingCandidates(roomId, actionUserId);
                        break;
                    }
                    
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(answerDescription));
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
                case "end":
                    await get().handleEndCall(payload);
                    break;
            }
        },
        handleCreateLocalStream: async () => {
            if (get().stream.localStream) {
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: get().mode === 'video', audio: true });
            set({ stream: { ...get().stream, localStream: stream  } });
        },
        handleCreatePeerConnection: async (roomId: string, actionUserId: string) => {
            const key = `${roomId}-${actionUserId}`;
            if (get().stream.peerConnections.has(key)) {
                return get().stream.peerConnections.get(key)!;
            }
            const socket = get().socket;
            const pc = new RTCPeerConnection({ iceServers: get().iceServers });
            // Khi nhận được ICE Candidate từ bên kia
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket?.emit('call:candidate', {
                        candidate: event.candidate,
                        roomId,
                        actionUserId,
                    });
                }
            };

            // Khi nhận được Stream từ bên kia
            pc.ontrack = (event) => {
                const currentRemoteStreams = get().stream.remoteStreams;
                if (!currentRemoteStreams.has(key)) { // nếu chưa có stream thì thêm vào map
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
        updateCallState: (state) => {
            if (state.status === 'accepted') {
                set({ action: { ...get().action, duration: 0 } });
                const interval = setInterval(() => {
                    set((prev) => ({
                        ...prev,
                        action: { ...prev.action, duration: prev.action.duration + 1 },
                    }));
                }, 1000);
                return () => clearInterval(interval);
            }
            set((prev) => ({
                ...prev,
                ...state,
            }));
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
                console.log(`✅ Flushing ${candidates.length} pending ICE candidates for room ${roomId}`);
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
        actionToggleTrack: async (action: 'mic' | 'video' | 'speaker' | 'shareScreen', value: boolean) => {
            const currentState = get();
            const roomId = currentState.roomId;
            const actionUserId = currentState.actionUserId;
            const localStream = currentState.stream.localStream;
            if (!localStream && action !== 'shareScreen') {
                console.error("Stream chưa được tạo");
                return;
            }
            switch (action) {
                case 'mic':
                    localStream?.getAudioTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = value;
                    });
                    set((prev) => ({
                        ...prev,
                        action: { ...prev.action, isMicEnabled: value },
                    }));
                    break;
                case 'video':
                    localStream?.getVideoTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = value;
                    });
                    set((prev) => ({
                        ...prev,
                        action: { ...prev.action, isCameraEnabled: value },
                    }));
                    break;
                case 'speaker':
                    localStream?.getAudioTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = value;
                    });
                    set((prev) => ({
                        ...prev,
                        action: { ...prev.action, isSpeakerphoneEnabled: value },
                    }));
                    break;
                case 'shareScreen':
                    // await get().handleShareScreen(roomId, actionUserId, value);
                    break;
            }
        },
        // handleShareScreen: async (roomId: string, actionUserId: string, localStream: MediaStream, value: boolean) => {
        //     const key = `${roomId}-${actionUserId}`;
        //     const pc = get().stream.peerConnections.get(key);
        //     if (value) {
        //         // --- BẮT ĐẦU SHARE SCREEN ---
        //         try {
        //             // 1. Lấy stream màn hình
        //             const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        //                 video: true, 
        //                 audio: false // Thường tắt audio hệ thống để tránh vọng âm với Mic
        //             });
        //             const screenTrack = screenStream.getVideoTracks()[0];

        //             // 2. Thay thế track Video hiện tại (Camera) bằng Screen Track
        //             if (pc) {
        //                 const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        //                 if (videoSender) {
        //                     await videoSender.replaceTrack(screenTrack);
        //                 }
        //             }

        //             // 3. Xử lý khi người dùng bấm "Stop Sharing" trên thanh công cụ trình duyệt
        //             screenTrack.onended = () => {
        //                 get().actionToggleTrack('shareScreen', false); // Gọi đệ quy để tắt
        //             };

        //             // 4. Cập nhật Local Stream để UI hiển thị màn hình mình đang share
        //             // (Tùy chọn: Nếu muốn UI vẫn hiện camera thì cần tách riêng stream)
        //             // Ở đây ta update vào localStream để đồng bộ logic
        //             if (localStream) {
        //                 const oldVideoTrack = localStream.getVideoTracks()[0];
        //                 if (oldVideoTrack) {
        //                     localStream.removeTrack(oldVideoTrack);
        //                     // oldVideoTrack.stop(); // Không stop camera nếu muốn switch lại nhanh
        //                 }
        //                 localStream.addTrack(screenTrack);
        //             }

        //             set((prev) => ({
        //                 ...prev,
        //                 stream: { ...prev.stream, localStream: screenStream }, // Cập nhật stream hiển thị
        //                 action: { ...prev.action, isSharingScreen: true, isCameraEnabled: false }, // Camera coi như tắt
        //             }));

        //         } catch (err) {
        //             console.error("User cancelled screen share or error:", err);
        //             // Reset lại nút toggle nếu user hủy
        //             set((prev) => ({
        //                 ...prev,
        //                 action: { ...prev.action, isSharingScreen: false },
        //             }));
        //         }
        //     } else {
        //         // --- DỪNG SHARE SCREEN (QUAY LẠI CAMERA) ---
        //         try {
        //             // 1. Lấy lại Camera Stream
        //             const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        //             const cameraTrack = cameraStream.getVideoTracks()[0];
        //             // 2. Thay thế track Screen đang chạy bằng Camera Track
        //             if (pc) {
        //                 const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        //                 if (videoSender) {
        //                     await videoSender.replaceTrack(cameraTrack);
        //                 }
        //             }

        //             // 3. Dừng track màn hình cũ (để tắt đèn báo share của trình duyệt)
        //             const currentLocalStream = get().stream.localStream;
        //             currentLocalStream?.getVideoTracks().forEach(track => track.stop());

        //             set((prev) => ({
        //                 ...prev,
        //                 stream: { ...prev.stream, localStream: cameraStream },
        //                 action: { ...prev.action, isSharingScreen: false, isCameraEnabled: true },
        //             }));

        //         } catch (err) {
        //             console.error("Error reverting to camera:", err);
        //         }
        //     }
        // },
       
    })
);
export default useCallStore;