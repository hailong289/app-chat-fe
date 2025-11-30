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
        startCall: (payload) => {
            const { roomId, mode, userCallee } = payload;
            const encodedUserInfo = Helpers.enCryptUserInfo(userCallee);
            window.open(`/call?roomId=${roomId}&userInfo=${encodedUserInfo}&callType=${mode}&status=calling`, '', 'width=800,height=600');
            set({ roomId, status: 'calling', mode, userInfo: userCallee });
        },
        endCall: (payload) => {
            const { roomId, callerId, calleeId, callType } = payload;
            set({ roomId, status: 'ended', mode: callType, userInfo: null });
            payload.callback({
                roomId,
                callerId,
                calleeId,
                callType,
            });
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
            console.log("eventCall", event, payload);
            const authStore = useAuthStore.getState();
            const currentUser = authStore.user;
            const isWindowOpen = get().isWindowOpen;
            
            if (!currentUser) {
                console.warn("User not authenticated, cannot handle call event");
                return;
            }

            const { actionUserId, callType, callee, caller, room, offer, answer, candidate } = payload;
            console.log("actionUserId", actionUserId, currentUser.id);
            switch (event) {
                case "start":
                    if (actionUserId !== currentUser.id) {
                        const encodedUserInfo = Helpers.enCryptUserInfo(caller);
                        const encodedOffer = Helpers.enCryptUserInfo(offer);
                        window.open(`/call?roomId=${room.room_id}&userInfo=${encodedUserInfo}&callType=${callType}&status=incoming&offer=${encodedOffer}`, '', 'width=500,height=600');
                        set({ roomId: room.room_id, status: 'incoming', mode: callType, userInfo: caller });
                    }
                    break;
                case "answer":
                    if (actionUserId !== currentUser.id && isWindowOpen) { // window open khác với window location
                        const pc = get().peerConnection;
                        if (!pc) {
                            console.error("Peer connection chưa được tạo");
                            return;
                        }
                        const answerDescription = new RTCSessionDescription(Helpers.decryptUserInfo(answer));
                        pc.setRemoteDescription(answerDescription);
                        console.log("answer", answerDescription);
                        set({ status: 'accepted', mode: callType, userInfo: callee });
                        Helpers.updateURLParams('status', 'accepted');
                        await get().flushPendingCandidates(room.room_id);
                    }
                    break;
                case "end":
                    set({ roomId: null, status: 'ended', mode: callType, userInfo: null });
                    break;
                case "candidate":
                    if (isWindowOpen) {
                        const pendingCandidates = get().pendingCandidates;
                        const iceCandidate = new RTCIceCandidate(candidate);
                        if (!pendingCandidates.has(room.room_id)) {
                          pendingCandidates.set(room.room_id, []);
                        }
                        pendingCandidates.get(room.room_id)!.push(iceCandidate);
                    }
                    break;
            }
        },
        openWindowCall: () => {
            set({ isWindowOpen: true });
        },
        closeWindowCall: () => {
            set({ isWindowOpen: false });
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
        handleReceiveOffer: async (offer: string, roomId: string, socket: Socket) => {
            await get().handleCreateLocalStream();
            await get().handleCreatePeerConnection(roomId, socket);
            const pc = get().peerConnection;
            if (!pc) {
                console.error("Peer connection chưa được tạo");
                return;
            }
            pc.setRemoteDescription(new RTCSessionDescription(Helpers.decryptUserInfo(offer)));
            await get().flushPendingCandidates(roomId);
            // await pc.setLocalDescription(await pc.createAnswer({}));
            // const answer = pc.localDescription;
            // socket?.emit('call:answer', {
            //     callerId: callerId,
            //     calleeId: calleeId,
            //     roomId: roomId,
            //     answer: answer,
            // });
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
        updateStatus: (status: 'idle' | 'calling' | 'incoming' | 'ended' | 'accepted' | 'declined') => {
            set({ status: status });
        },
        flushPendingCandidates: async (roomId: string) => {
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
        }
    })
);
export default useCallStore;