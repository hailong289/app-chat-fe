import { create } from "zustand";
import { CallState } from "./types/call.state";
import Helpers from "@/libs/helpers";
import useAuthStore from "./useAuthStore";
import { Socket } from "socket.io-client";

const useCallStore = create<CallState>()(
    (set, get) => ({
        roomId: null,
        status: 'idle',
        mode: 'audio',
        userInfo: null,
        error: null,
        isWindowOpen: false,
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        stream: {
            localStream: null,
            remoteStream: null,
            instanceStream: null,
        },
        peerConnection: null,
        pendingCandidates: new Map<string, RTCIceCandidate[]>(),
        action: {
            isMicEnabled: true,
            isCameraEnabled: false,
            isSpeakerphoneEnabled: true,
            duration: 0, // thời gian gọi
        },
        openCall: (payload) => {
            const { roomId, mode, userCallee } = payload;
            const encodedUserInfo = Helpers.enCryptUserInfo(userCallee);
            window.open(`/call?roomId=${roomId}&userInfo=${encodedUserInfo}&callType=${mode}&status=calling`, '', 'width=800,height=600');
        },
        acceptCall: async (payload) => {
            const { roomId, callerId, calleeId, callType, socket } = payload;
            await get().handleCreatePeerConnection(roomId, socket);
            const pc = get().peerConnection;
            if (!pc) {
                console.error("Peer connection chưa được tạo");
                return; // trả về lỗi
            }
            const answerDescription = await pc.createAnswer({});
            await pc.setLocalDescription(answerDescription);
            const answer = pc.localDescription;
            socket?.emit('call:answer', {
                callerId: callerId,
                answer: Helpers.enCryptUserInfo(answer),
                calleeId: calleeId,
                roomId: roomId,
            });
            set({ status: 'accepted' });
            Helpers.updateURLParams('status', 'accepted');
        },
        eventCall: async (event: string, payload: any) => {
            const authStore = useAuthStore.getState();
            const currentUser = authStore.user;
            if (!currentUser) {
                console.warn("User not authenticated, cannot handle call event");
                return;
            }
            const { actionUserId, callType, callee, caller, room, offer, answer, candidate, roomId } = payload;
            switch (event) {
                case "start":
                    if (!window.opener && actionUserId !== currentUser.id) {
                        console.log("start", caller, offer);
                        const encodedUserInfo = Helpers.enCryptUserInfo(caller);
                        const encodedOffer = Helpers.enCryptUserInfo(offer);
                        window.open(`/call?roomId=${room.room_id}&userInfo=${encodedUserInfo}&callType=${callType}&status=incoming&offer=${encodedOffer}`, '', 'width=500,height=600');
                    }
                    break;
                case "answer":
                    if (window.opener && actionUserId !== currentUser.id) { // window open khác với window location
                        const pc = get().peerConnection;
                        if (!pc) {
                            console.error("Peer connection chưa được tạo");
                            return;
                        }
                        const answerDescription = Helpers.decryptUserInfo(answer);
                        pc.setRemoteDescription(new RTCSessionDescription(answerDescription));
                        console.log("answer", answerDescription);
                        set({ status: 'accepted' });
                        Helpers.updateURLParams('status', 'accepted');
                        await get().flushPendingCandidates(room.room_id);
                    }
                    break;
                case "end":
                    if (window.opener) {
                        const currentState = get();
                        
                        // Dừng tất cả tracks trong localStream
                        if (currentState.stream.localStream) {
                            currentState.stream.localStream.getTracks().forEach(track => {
                                track.stop();
                            });
                        }
                        
                        // Dừng tất cả tracks trong remoteStream
                        if (currentState.stream.remoteStream) {
                            currentState.stream.remoteStream.getTracks().forEach(track => {
                                track.stop();
                            });
                        }
                        
                        // Dừng tất cả tracks trong instanceStream
                        if (currentState.stream.instanceStream) {
                            currentState.stream.instanceStream.getTracks().forEach(track => {
                                track.stop();
                            });
                        }
                        
                        // Đóng peerConnection
                        if (currentState.peerConnection) {
                            currentState.peerConnection.close();
                        }
                        
                        set({ 
                            roomId: null, 
                            status: 'ended', 
                            mode: callType, 
                            userInfo: null,
                            peerConnection: null,
                            stream: {
                                localStream: null,
                                remoteStream: null,
                                instanceStream: null,
                            },
                            pendingCandidates: new Map<string, RTCIceCandidate[]>(),
                        });
                        window.close();
                    }               
                    break;
                case "candidate":
                    if (window.opener) { // window open khác với window location
                        console.log("candidate", candidate);
                        const iceCandidate = new RTCIceCandidate(candidate);
                        const pc = get().peerConnection;
                        if (pc && pc.remoteDescription) {
                            try {
                                await pc.addIceCandidate(iceCandidate);
                                console.log("✅ Added Late ICE Candidate directly");
                            } catch (err) {
                                console.error("❌ Error adding late candidate:", err);
                            }
                        } 
                        // Nếu chưa có Remote Description thì mới đem đi xếp hàng
                        else {
                            console.log("⏳ Queuing ICE candidate (waiting for remoteDescription)...");
                            const pendingCandidates = get().pendingCandidates;
                            if (!pendingCandidates.has(roomId)) {
                                pendingCandidates.set(roomId, []);
                            }
                            pendingCandidates.get(roomId)!.push(iceCandidate);
                        }
                    }
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
        handleCreateOffer: async (payload: any) => {
            const { callerId, calleeId, roomId, callType, callee, socket } = payload;
            set({ mode: callType });
            await get().handleCreateLocalStream();
            const stream = get().stream.localStream;
            if (!stream) {
                console.error("Stream chưa được tạo");
                return;
            }
            await get().handleCreatePeerConnection(roomId, socket);
            const pc = get().peerConnection;
            if (!pc) {
                console.error("Peer connection chưa được tạo");
                return;
            }
            await pc.setLocalDescription(await pc.createOffer());
            const offer = pc.localDescription;
            socket?.emit('call:start', {
                callerId: callerId,
                calleeId: calleeId,
                roomId: roomId,
                callType: callType,
                offer: offer,
                callee: callee,
            });
            set({ stream: { ...get().stream, localStream: stream  } });
        },
        handleReceiveOffer: async (payload: any) => {
            const { offer, roomId, socket, callType } = payload;
            set({ mode: callType });
            await get().handleCreateLocalStream();
            await get().handleCreatePeerConnection(roomId, socket);
            const pc = get().peerConnection;
            if (!pc) {
                console.error("Peer connection chưa được tạo");
                return;
            }
            const offerDescription = Helpers.decryptUserInfo(offer);
            console.log("offerDescription", offerDescription);
            pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
            await get().flushPendingCandidates(roomId);
        },
        handleCreatePeerConnection: async (roomId: string, socket: Socket) => {
            if (get().peerConnection) {
                return get().peerConnection as RTCPeerConnection;
            }
            const pc = new RTCPeerConnection({ iceServers: get().iceServers });

            // Khi nhận được ICE Candidate từ bên kia
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket?.emit('call:candidate', {
                        candidate: event.candidate,
                        roomId,
                    });
                }
            };

            // Khi nhận được Stream từ bên kia
            pc.ontrack = (event) => {
                set({ stream: { ...get().stream, remoteStream: event.streams[0] } });
            };

            // Thêm tracks vào local stream
            const localStream = get().stream.localStream;
            if (localStream) {
                localStream.getTracks().forEach((track) => {
                    pc.addTrack(track, localStream);
                });
            }

            set({ peerConnection: pc });
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
        flushPendingCandidates: async (roomId: string) => {
            if (!window.opener) {
                return;
            }
            const pendingCandidates = get().pendingCandidates;
            const pc = get().peerConnection;
            if (!pc) {
                console.error("Peer connection chưa được tạo");
                return;
            }
            const candidates = pendingCandidates.get(roomId);
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
                pendingCandidates.delete(roomId);
            }
        },
        actionToggleTrack: async (action: 'mic' | 'video' | 'speaker', value: boolean) => {
            const currentState = get();
            if (!currentState.stream.localStream) {
                console.error("Stream chưa được tạo");
                return;
            }
            switch (action) {
                case 'mic':
                    currentState.stream.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = value;
                    });
                    set((prev) => ({
                        ...prev,
                        action: { ...prev.action, isMicEnabled: value },
                    }));
                    break;
                case 'video':
                    currentState.stream.localStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = value;
                    });
                    set((prev) => ({
                        ...prev,
                        action: { ...prev.action, isCameraEnabled: value },
                    }));
                    break;
                case 'speaker':
                    currentState.stream.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = value;
                    });
                    set((prev) => ({
                        ...prev,
                        action: { ...prev.action, isSpeakerphoneEnabled: value },
                    }));
                    break;
            }
        },
    })
);
export default useCallStore;