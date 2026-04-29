"use client";

import { useRef, useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from "@heroui/react";
import {
  MicrophoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ComputerDesktopIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import { useSocket } from "@/components/providers/SocketProvider";
import useAuthStore from "@/store/useAuthStore";
import Helpers from "@/libs/helpers";
import useCallStore from "@/store/useCallStore";
import useP2pCallStore from "@/store/useP2pCallStore";
import useSfuCallStore from "@/store/useSfuCallStore";
import { CallMember } from "@/store/types/call.state";
import { useTranslation } from "react-i18next";
import { isTauriRuntime } from "@/libs/helpers";

function CallPageContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket } = useSocket("/call");
  const [isMounted, setIsMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { t } = useTranslation();
  const closeTauriOrBrowserWindow = useCallback(async (): Promise<boolean> => {
    if (isTauriRuntime()) {
      try {
        const { Window, getCurrentWindow } = await import("@tauri-apps/api/window");
        const current = getCurrentWindow();
        const labels = [current.label, "appCallWindow_out", "appCallWindow_inc"];

        for (const label of labels) {
          const win = new Window(label);
          if (!win) continue;
          try {
            await win.close();
          } catch {
            await win.destroy();
          }
          return true;
        }
      } catch {}
    } else if (window.opener) {
      window.close();
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const current = getCurrentWindow();
        unlisten = await current.onCloseRequested(async () => {
          try {
            await current.destroy();
          } catch {}
        });
      } catch {}
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  // callMode is stable for the lifetime of this call window (set from URL params
  // once and never changes). Use it to register only the relevant socket listeners.
  const callMode = (searchParams.get("callMode") as "p2p" | "sfu") || "p2p";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hasEndedRef = useRef(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  // Banner shown to the caller when the callee rejects or doesn't pick up.
  // Without this, the popup just closes the moment `call:end status=rejected/
  // missed` arrives and the caller never knows why the call ended.
  const [endNotice, setEndNotice] = useState<string | null>(null);
  // Transient per-event toasts shown at the top of the call window:
  // "X đã tham gia / rời / từ chối cuộc gọi". Each entry auto-dismisses
  // after 4s. Used for GROUP calls only — 1-on-1 rejection still uses
  // `endNotice` because it's terminal (the call closes immediately).
  const [callToasts, setCallToasts] = useState<
    Array<{ id: number; text: string }>
  >([]);
  const pushCallToast = useCallback((text: string) => {
    if (!text) return;
    const id = Date.now() + Math.random();
    setCallToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setCallToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);
  // Screen-share strip collapse toggle. When the strip is open it's 11rem
  // wide and shows participant tiles (own + remote cameras + pinned-screen).
  // When collapsed it shrinks to a thin handle at the right edge so the
  // shared screen takes the full window.
  //
  // Selective Rendering: when the strip is collapsed the camera tiles are
  // hidden — there's no point rendering or even receiving those frames.
  // We pause/resume the camera media path on toggle (see useEffect below).
  // Screen-share track stays running because the user is still watching it.
  // Audio also stays running so participants can keep talking.
  const [stripCollapsed, setStripCollapsed] = useState(false);
  // Map<key, muted> tracking the `muted` state of each remote peer's video
  // receiver track. WebRTC fires `mute` / `unmute` events on the receiver
  // track when the sender flips `track.enabled`, but those events don't
  // automatically trigger React re-renders. We listen explicitly and store
  // the result so the UI can swap to the avatar when the peer's camera is
  // off (no frames flowing) instead of showing an awkward black box.
  const [remoteVideoMutedMap, setRemoteVideoMutedMap] = useState<
    Map<string, boolean>
  >(new Map());
  // Set of userIds whose camera is currently off, derived from explicit
  // `call:camera-state` socket events. We can't rely on RTCRtpReceiver
  // `track.muted` alone because Chrome keeps RTP flowing (with black
  // frames) when the sender does `track.enabled = false` — the receiver's
  // mute event lags 5-10 seconds or never fires.
  const [cameraOffPeers, setCameraOffPeers] = useState<Set<string>>(new Set());
  // Set of userIds with their mic muted, derived from `call:mic-state` socket
  // events. Same rationale as cameraOffPeers — `track.enabled=false` on the
  // sender's audio doesn't propagate reliably to receivers (silent RTP keeps
  // flowing), so the explicit signal is the source of truth.
  const [micOffPeers, setMicOffPeers] = useState<Set<string>>(new Set());
  // Set of userIds currently speaking, derived from per-track Web Audio
  // analysis. Refreshed ~6×/s via requestAnimationFrame; threshold tuned
  // so background noise / breathing doesn't trigger false positives.
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  const {
    status: callStatus,
    error: callError,
    stream: { localStream, remoteStreams, localScreenStream, remoteScreenStreams },
    peersSharingScreen,
    action: {
      isMicEnabled,
      isCameraEnabled,
      isSpeakerphoneEnabled,
      duration,
      isSharingScreen,
      userIdGhimmed,
      screenSharerIdGhimmed,
    },
    devices,
    mode,
    members,
    roomId,
    handleCreateLocalStream,
    updateCallState,
    eventCall,
    actionToggleTrack,
    endCall,
    setUserIdGhimmed,
    setScreenSharerIdGhimmed,
    getDevices,
    setDevice,

  } = useCallStore();


  // ─── Active speaker detection (Web Audio level meter) ───────────────────
  //
  // For each audio track we have access to (own + remote streams), tap into
  // an AnalyserNode and sample the volume periodically. Anyone above the
  // threshold gets added to `speakingUsers`. The UI uses this Set to draw
  // a green ring around their tile so listeners know who's talking — common
  // in Meet / Zoom / Messenger group call UX.
  //
  // Threshold (~25 on byte-frequency scale) is tuned to ignore breathing /
  // keyboard noise while catching normal speech. Update interval is ~150ms
  // (6×/s) — fast enough to feel real-time, slow enough not to flicker.
  useEffect(() => {
    if (!isMounted) return;
    const audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const analysers: { userId: string; analyser: AnalyserNode }[] = [];

    if (localStream && currentUserId) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        const source = audioCtx.createMediaStreamSource(
          new MediaStream([audioTrack]),
        );
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analysers.push({ userId: currentUserId, analyser });
      }
    }
    remoteStreams.forEach((stream, key) => {
      const userId = roomId ? key.replace(`${roomId}-`, "") : key;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          const source = audioCtx.createMediaStreamSource(
            new MediaStream([audioTrack]),
          );
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          analysers.push({ userId, analyser });
        } catch {
          // Some browsers throw when wrapping a remote track that's already
          // attached to a video element — ignore, just skip detection.
        }
      }
    });

    let rafId = 0;
    let lastUpdate = 0;
    const SPEAKING_THRESHOLD = 25;
    const tick = (now: number) => {
      if (now - lastUpdate > 150) {
        const next = new Set<string>();
        for (const { userId, analyser } of analysers) {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
          const rms = Math.sqrt(sum / data.length);
          if (rms > SPEAKING_THRESHOLD) next.add(userId);
        }
        setSpeakingUsers((prev) => {
          if (
            prev.size === next.size &&
            [...prev].every((x) => next.has(x))
          )
            return prev;
          return next;
        });
        lastUpdate = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      audioCtx.close().catch(() => {});
    };
  }, [localStream, remoteStreams, currentUserId, roomId, isMounted]);

  // Subscribe to remote video tracks' mute/unmute events so the UI can swap
  // to the avatar when a peer turns their camera off. Placed after the
  // destructure of `remoteStreams` to avoid TDZ issues.
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const update = (key: string, muted: boolean) => {
      setRemoteVideoMutedMap((prev) => {
        if (prev.get(key) === muted) return prev;
        const next = new Map(prev);
        next.set(key, muted);
        return next;
      });
    };

    remoteStreams.forEach((stream, key) => {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        update(key, true);
        return;
      }
      update(key, videoTrack.muted);
      const onMute = () => update(key, true);
      const onUnmute = () => update(key, false);
      videoTrack.addEventListener("mute", onMute);
      videoTrack.addEventListener("unmute", onUnmute);
      cleanups.push(() => {
        videoTrack.removeEventListener("mute", onMute);
        videoTrack.removeEventListener("unmute", onUnmute);
      });
    });

    return () => cleanups.forEach((c) => c());
  }, [remoteStreams]);

  // ─── Selective Rendering: pause/resume camera media on strip collapse ────
  //
  // When the screen-share strip is collapsed the camera thumbnails aren't
  // visible; receiving + decoding their frames is wasted work. Pause the
  // camera media path on collapse and resume on expand. Screen track stays
  // running (user is still watching it as the main view) and audio stays
  // running so people can keep talking.
  //
  // Effective bandwidth saving:
  //   - SFU: client calls `consumer.pause()` locally (stops decode/render)
  //     AND emits a `pauseConsumer` signal to the SFU server, which calls
  //     `serverConsumer.pause()` → mediasoup stops forwarding RTP for this
  //     consumer. Real wire-level bandwidth saving (~100% for camera tile).
  //   - P2P: `track.enabled = false` at the receiver stops decode/render
  //     (CPU saving). To stop WIRE bandwidth in P2P you'd need to
  //     renegotiate `transceiver.direction = 'inactive'` which costs an
  //     offer/answer round-trip per toggle. Future work.
  const sharingNow = !!localScreenStream || peersSharingScreen.size > 0;
  useEffect(() => {
    // Strip only renders during screen-share, so the toggle is irrelevant
    // outside that mode — skip work and avoid disabling tracks elsewhere.
    if (!sharingNow) return;

    let cancelled = false;
    (async () => {
      if (callMode === "sfu") {
        const { sfu } = useSfuCallStore.getState();
        const callStore = useCallStore.getState();
        const sock = callStore.socket;
        const rId = callStore.roomId;
        for (const consumer of sfu.consumers.values()) {
          if (cancelled) return;
          if (consumer.kind !== "video") continue;
          // Skip remote screen producers — keep the screen visible.
          if (sfu.screenProducerIds.has(consumer.producerId)) continue;
          // Skip the camera that's currently pinned as main view —
          // pausing it would leave a black main area while the user is
          // actively watching that person.
          const ownerId = (
            consumer as { appData?: { userId?: string } }
          ).appData?.userId;
          if (userIdGhimmed && ownerId === userIdGhimmed) continue;
          try {
            if (stripCollapsed) {
              await consumer.pause();
              // Server-side pause: tells mediasoup to stop forwarding RTP
              // for this consumer. This is the actual bandwidth-saving step.
              sock?.emit("signal", {
                type: "pauseConsumer",
                target: "sfu",
                roomId: rId,
                consumerId: consumer.id,
              });
            } else {
              await consumer.resume();
              sock?.emit("signal", {
                type: "resumeConsumer",
                target: "sfu",
                roomId: rId,
                consumerId: consumer.id,
              });
            }
          } catch (err) {
            console.warn("[Call] Selective render: SFU pause/resume failed", err);
          }
        }
      } else {
        const peers = useP2pCallStore.getState().peerConnections;
        const pinnedKey = userIdGhimmed ? `${roomId}-${userIdGhimmed}` : null;
        for (const [key, pc] of peers) {
          // Don't disable the camera the user is actively watching as the
          // main view — they pinned it precisely to keep watching during
          // screen share.
          if (pinnedKey && key === pinnedKey) {
            const videoReceivers = pc
              .getReceivers()
              .filter((r) => r.track?.kind === "video");
            const cameraReceiver = videoReceivers[0];
            if (cameraReceiver?.track) cameraReceiver.track.enabled = true;
            continue;
          }
          // First video receiver is the camera (added in
          // handleCreatePeerConnection); subsequent video receivers (from
          // a screen-share renegotiation) are the screen — leave those
          // running. Audio receiver also stays untouched.
          const videoReceivers = pc
            .getReceivers()
            .filter((r) => r.track?.kind === "video");
          const cameraReceiver = videoReceivers[0];
          if (cameraReceiver?.track) {
            cameraReceiver.track.enabled = !stripCollapsed;
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stripCollapsed, callMode, sharingNow, userIdGhimmed, roomId]);

  // Stable handler refs — Socket.IO off() requires the exact same function reference
  // that was passed to on(). Inline arrow functions in both on() and off() create
  // different objects so listeners are never removed → they accumulate → events like
  // call:accepted fire multiple times → "setLocalDescription: stable state" errors.
  const onAccepted = useRef((p: any) => useCallStore.getState().eventCall("accepted", p));
  const onAnswer = useRef((p: any) => useCallStore.getState().eventCall("answer", p));
  const onCandidate = useRef((p: any) => useCallStore.getState().eventCall("candidate", p));
  // Callee rejected or didn't pick up → show a 3-second banner explaining why
  // the call ended, then run the normal teardown. For group calls (members
  // length > 2) we skip the delay since the call continues for everyone else;
  // the leaver is just removed silently from the grid.
  // Latest `pushCallToast` ref so the stable `useRef` socket handlers
  // below always call the current closure (state setters captured at
  // registration time would shadow re-renders).
  const pushCallToastRef = useRef(pushCallToast);
  pushCallToastRef.current = pushCallToast;

  // Latest `t` ref so the stable handlers can re-translate without being
  // re-registered when the language changes.
  const tRef = useRef(t);
  tRef.current = t;

  const onEnd = useRef((p: any) => {
    // Use `callMode` (p2p vs sfu) as the source of truth for "is this
    // a 1-on-1 call?". Counting members is unreliable: a sfu group
    // call can legitimately have only 2 people (e.g. 2-person group
    // chat that's still typed `group` server-side), and an auto-miss
    // broadcast might trim the members array. callMode is set at
    // call-start from the room type and never changes, so it gives us
    // a stable signal even when the broadcast payload is partial.
    const localMembers = useCallStore.getState().members ?? [];
    const callMode =
      (p.callMode as string | undefined) ??
      useCallStore.getState().callMode;
    const isOneOnOne = callMode === "p2p";

    const actor = ((p.members || localMembers) as CallMember[]).find(
      (m) => m.id === p.actionUserId,
    );
    const name = actor?.fullname || tRef.current("callPage.labels.unknownUser");
    if (
      (p.status === "rejected" || p.status === "missed") &&
      isOneOnOne
    ) {
      const text = tRef.current(
        p.status === "rejected"
          ? "callPage.toast.rejected"
          : "callPage.toast.missed",
        { name },
      );
      setEndNotice(text);
      setTimeout(() => useCallStore.getState().eventCall("end", p), 3000);
    } else {
      // Group call: surface a toast so the remaining participants see why
      // someone disappeared from the grid (rejected the invite, didn't
      // answer in time, or left mid-call). The call itself stays open —
      // teardown happens silently inside handleEndCall's partial-removal
      // branch.
      if (!isOneOnOne) {
        const key =
          p.status === "rejected"
            ? "callPage.toast.rejected"
            : p.status === "missed"
            ? "callPage.toast.missed"
            : "callPage.toast.left";
        pushCallToastRef.current(tRef.current(key, { name }));
      }
      // Forward the event with members backfilled from local state if
      // the broadcast omitted them — handleEndCall still uses members
      // for cleanup keys.
      useCallStore.getState().eventCall("end", {
        ...p,
        members: (p.members && p.members.length > 0)
          ? p.members
          : localMembers,
      });
    }
  });
  const onSignal = useRef((p: any) => useCallStore.getState().handleSFUSignal(p));
  const onMemberJoined = useRef((p: any) => {
    // Group calls: announce new joiners so others know someone hopped in.
    const member = (p.members || []).find(
      (m: CallMember) => m.id === p.actionUserId,
    );
    const name = member?.fullname;
    if (name && (p.members?.length ?? 0) > 2) {
      pushCallToastRef.current(
        tRef.current("callPage.toast.joined", { name }),
      );
    }
    useCallStore.getState().eventCall("member-joined", p);
  });
  // Remote user toggled screen share. Three things to update:
  //   (1) `peersSharingScreen` Set — drives the UI to swap to screen layout.
  //   (2) For P2P: pull the receiver's screen track out of the pre-allocated
  //       screen transceiver and stage it in `remoteScreenStreams`. ontrack
  //       only fires the first time the transceiver gets a track during
  //       initial negotiation; subsequent stop→share toggles just unmute the
  //       same track and don't refire ontrack, so we can't rely on that path.
  //   (3) For SFU: register the producerId so the upcoming `consume` for it
  //       routes to `remoteScreenStreams` instead of the camera Map.
  // On stop: drop entry from remoteScreenStreams (don't stop the track — for
  //   P2P the same track will be reused when sharing resumes; for SFU the
  //   consumer will be closed by the producer-closed signal).
  const onShareScreen = useRef((p: any) => {
    const userId: string | undefined = p.actionUserId;
    if (!userId) return;
    const store = useCallStore.getState();
    const stateRoomId = store.roomId;
    const key = stateRoomId ? `${stateRoomId}-${userId}` : null;

    if (p.isSharing) {
      // P2P: harvest the receiver track from our screen transceiver so the
      // strip element has something to bind srcObject to. Reuse the
      // existing remoteScreenStreams entry's MediaStream object if any so
      // we don't break already-mounted video elements bound to it; only
      // mutate tracks in place + bump the Map ref.
      if (key) {
        // Harvest from `remoteScreenTransceivers` (NOT `screenTransceivers`).
        // The latter stores OUR sender transceivers for screens WE share —
        // unrelated to receiving peers' screens. In multi-share scenarios
        // (both peers share simultaneously) the two roles collide on the
        // same peer key, so we keep them in separate Maps.
        const transceiver =
          useP2pCallStore.getState().remoteScreenTransceivers?.get(key);
        const track = transceiver?.receiver.track;
        if (track) {
          useCallStore.setState((prev) => {
            const existing = prev.stream.remoteScreenStreams.get(key);
            const target = existing ?? new MediaStream();
            target.getTracks().forEach((t) => {
              if (t.kind === track.kind && t !== track) {
                target.removeTrack(t);
              }
            });
            if (!target.getTracks().includes(track)) target.addTrack(track);
            const newRemoteScreenStreams = new Map(
              prev.stream.remoteScreenStreams,
            );
            newRemoteScreenStreams.set(key, target);
            return {
              stream: {
                ...prev.stream,
                remoteScreenStreams: newRemoteScreenStreams,
              },
            };
          });
        }
      }

      useCallStore.setState((prev) => {
        const next = new Set(prev.peersSharingScreen);
        next.add(userId);
        return { peersSharingScreen: next };
      });

      if (p.screenProducerId) {
        useSfuCallStore.setState((prev) => ({
          sfu: {
            ...prev.sfu,
            screenProducerIds: new Set([
              ...prev.sfu.screenProducerIds,
              p.screenProducerId,
            ]),
          },
        }));
        // Race-condition fix: the SFU `consume` for this producer might
        // already have arrived (and routed the track into the camera Map)
        // before this share-screen socket event got here. Migrate any
        // existing consumer's track to the screen Map retroactively.
        const consumers = useSfuCallStore.getState().sfu.consumers;
        for (const consumer of consumers.values()) {
          if (consumer.producerId !== p.screenProducerId) continue;
          useCallStore.setState((prev) => {
            if (!key) return prev;
            const cameraStream = prev.stream.remoteStreams.get(key);
            if (cameraStream) {
              try {
                cameraStream.removeTrack(consumer.track);
              } catch {}
            }
            // Same identity-preserving + drop-superseded-same-kind logic.
            const existing = prev.stream.remoteScreenStreams.get(key);
            const target = existing ?? new MediaStream();
            target.getTracks().forEach((t) => {
              if (t.kind === consumer.track.kind && t !== consumer.track) {
                target.removeTrack(t);
              }
            });
            if (!target.getTracks().includes(consumer.track)) {
              target.addTrack(consumer.track);
            }
            const newRemoteScreenStreams = new Map(
              prev.stream.remoteScreenStreams,
            );
            newRemoteScreenStreams.set(key, target);
            return {
              stream: {
                ...prev.stream,
                remoteScreenStreams: newRemoteScreenStreams,
              },
            };
          });
        }
      }
    } else {
      useCallStore.setState((prev) => {
        const next = new Set(prev.peersSharingScreen);
        next.delete(userId);
        const newRemoteScreenStreams = new Map(prev.stream.remoteScreenStreams);
        if (key) newRemoteScreenStreams.delete(key);
        return {
          peersSharingScreen: next,
          stream: {
            ...prev.stream,
            remoteScreenStreams: newRemoteScreenStreams,
          },
        };
      });
    }
  });
  const onBusy = useRef((p: any) => {
    const store = useCallStore.getState();
    const busyMember = store.members.find((m) => m.id === p.targetUserId);
    setBusyUser(busyMember?.fullname || "Người dùng");
    setTimeout(() => useCallStore.getState().eventCall("busy", p), 3000);
  });
  // Peer toggled their camera. Update the set so the tile swaps to avatar
  // (or back to live video) immediately, without waiting for track.muted.
  const onCameraState = useRef((p: any) => {
    const userId: string | undefined = p.actionUserId;
    if (!userId) return;
    setCameraOffPeers((prev) => {
      const next = new Set(prev);
      if (p.isCameraOn) next.delete(userId);
      else next.add(userId);
      return next;
    });
  });
  // Peer toggled their mic. Update the set so the tile shows a "muted" badge.
  const onMicState = useRef((p: any) => {
    const userId: string | undefined = p.actionUserId;
    if (!userId) return;
    setMicOffPeers((prev) => {
      const next = new Set(prev);
      if (p.isMicOn) next.delete(userId);
      else next.add(userId);
      return next;
    });
  });
  // Multi-device handoff: server tells THIS socket to release the call
  // because the same user just accepted/joined from another device.
  // Tear down local stream + close popup silently — don't emit call:end
  // (the call still continues on the other device).
  const onHandoff = useRef((_p: any) => {
    hasEndedRef.current = true;
    const store = useCallStore.getState();
    store.stream.localStream?.getTracks().forEach((t) => t.stop());
    store.stream.remoteStreams.forEach((s) =>
      s.getTracks().forEach((t) => t.stop()),
    );
    void closeTauriOrBrowserWindow().then((closed) => {
      if (!closed) router.push("/");
    });
  });

  // Register socket listeners based on callMode to prevent cross-protocol
  // event handling. P2P and SFU use completely different signaling paths:
  //   P2P:  call:accepted → offer/answer negotiation, call:answer, call:candidate
  //   SFU:  signal → mediasoup transport/produce/consume pipeline
  // Registering both sets simultaneously was the root cause of media mapping bugs.
  useEffect(() => {
    if (!socket) return;

    // Always-on: shared events for both modes
    socket.on("call:end", onEnd.current);
    socket.on("call:member-joined", onMemberJoined.current);
    socket.on("call:share-screen", onShareScreen.current);
    socket.on("call:busy", onBusy.current);
    socket.on("call:handoff", onHandoff.current);
    socket.on("call:camera-state", onCameraState.current);
    socket.on("call:mic-state", onMicState.current);

    if (callMode === "p2p") {
      socket.on("call:accepted", onAccepted.current);
      socket.on("call:answer", onAnswer.current);
      socket.on("call:candidate", onCandidate.current);
    }

    if (callMode === "sfu") {
      socket.on("signal", onSignal.current);
    }

    return () => {
      socket.off("call:end", onEnd.current);
      socket.off("call:member-joined", onMemberJoined.current);
      socket.off("call:share-screen", onShareScreen.current);
      socket.off("call:busy", onBusy.current);
      socket.off("call:handoff", onHandoff.current);
      socket.off("call:camera-state", onCameraState.current);
      socket.off("call:mic-state", onMicState.current);

      if (callMode === "p2p") {
        socket.off("call:accepted", onAccepted.current);
        socket.off("call:answer", onAnswer.current);
        socket.off("call:candidate", onCandidate.current);
      }

      if (callMode === "sfu") {
        socket.off("signal", onSignal.current);
      }
    };
  }, [socket, callMode]);

  // update local and remote stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      }
    }
    remoteStreams.forEach((stream, key) => {
      const remoteVideoElement = remoteVideoRefs.current.get(key);
      if (remoteVideoElement && stream) {
        // Only re-assign if stream changed to avoid interrupting ongoing playback
        if (remoteVideoElement.srcObject !== stream) {
          remoteVideoElement.srcObject = stream;
          remoteVideoElement.play().catch(() => {});
        }
      }
    });
  }, [localStream, remoteStreams, callStatus]);

  // update call state
  // This effect bootstraps the call state from URL params on popup mount.
  // It depends on `searchParams` so any URL change (e.g.
  // Helpers.updateURLParams) re-fires it. Mid-call we MUST NOT clobber the
  // live mid-call state — hardcoded `startedAt: null, duration: 0` would
  // wipe out the duration ticker anchor set by handleAcceptCall, leaving
  // the timer stuck at 00:00. Skip when the call is already in progress.
  useEffect(() => {
    if (!socket) return;
    const currentStatus = useCallStore.getState().status;
    if (currentStatus === "accepted" || currentStatus === "ended") {
      return; // call already in progress / over — don't re-bootstrap from URL
    }
    (async () => {
      await updateCallState({
        roomId: searchParams.get("roomId") || "",
        status: searchParams.get("status") as
          | "idle"
          | "calling"
          | "incoming"
          | "ended"
          | "accepted"
          | "declined"
          | "joined",
        mode: searchParams.get("callType") as "audio" | "video",
        callMode: (searchParams.get("callMode") as "p2p" | "sfu") || "p2p",
        callId: searchParams.get("callId") || null,
        members: Helpers.decryptUserInfo(
          searchParams.get("members") || "[]",
        ) as CallMember[],
        action: {
          isMicEnabled: true,
          isCameraEnabled: searchParams.get("callType") === "video",
          isSpeakerphoneEnabled: true,
          duration: 0,
          startedAt: null,
          isSharingScreen: false,
          userIdGhimmed: "",
          screenSharerIdGhimmed: "",
        },
        socket: socket,
      });
    })();
  }, [searchParams, socket]);

  useEffect(() => {
    if (!socket) return;
    if (
      callStatus === "incoming" ||
      callStatus === "calling" ||
      callStatus === "joined" ||
      callStatus === "accepted"
    ) {
      handleCreateLocalStream();
    }
    console.log("callStatus", callStatus);
  }, [callStatus, socket]);

  // Update audio output device - only on elements that already have a stream
  useEffect(() => {
    if (devices.selectedAudioOutput) {
      remoteVideoRefs.current.forEach((videoEl) => {
        if (videoEl && "setSinkId" in videoEl && videoEl.srcObject) {
          // @ts-ignore
          videoEl
            .setSinkId(devices.selectedAudioOutput)
            .catch((err: any) => console.error("Error setting sinkId:", err));
        }
      });
    }
  }, [devices.selectedAudioOutput, remoteStreams]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Close the window when the call ends. Must set hasEndedRef BEFORE closing
  // so that the beforeunload/pagehide handlers don't re-trigger endCall.
  // This is the single source of truth for window.close() — both the local
  // "End" button path and the remote "call:end" received path flow through here.
  useEffect(() => {
    if (callStatus === "ended") {
      hasEndedRef.current = true;
      void closeTauriOrBrowserWindow();
    }
  }, [callStatus, closeTauriOrBrowserWindow]);

  const handleEndCall = useCallback(() => {
    if (hasEndedRef.current) {
      return;
    }
    let status = "ended";
    const isCaller = searchParams.get("isCaller") === "true";
    // Clear video srcObject trước khi end call
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    remoteVideoRefs.current.forEach((videoRef) => {
      if (videoRef) {
        videoRef.srcObject = null;
      }
    });

    if (isCaller) {
      status = callStatus === "accepted" ? "ended" : "cancelled";
    } else {
      status = callStatus === "accepted" ? "ended" : "rejected";
    }

    hasEndedRef.current = true;

    endCall({
      roomId: roomId,
      actionUserId: currentUserId,
      status,
      callId: searchParams.get("callId") || "",
    });
  }, [callStatus, currentUserId, endCall, roomId, searchParams]);

  useEffect(() => {
    const handleWindowClose = () => {
      if (!hasEndedRef.current) {
        handleEndCall();
      }
    };

    window.addEventListener("beforeunload", handleWindowClose);
    window.addEventListener("pagehide", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
      window.removeEventListener("pagehide", handleWindowClose);
    };
  }, [handleEndCall]);

  // Note: in-page accept button has been removed. Receivers now go through
  // <IncomingCallModal /> in the main tab and the popup opens with
  // `status=joined` straight away — updateCallState's joined branch handles
  // the join flow (emit call:join → initSFU → emit signal join). No autoAccept
  // / handleAccept is needed here.

  const getUserInfo = useCallback((): {
    id: string;
    fullname: string;
    avatar: string;
  } => {
    const countMembers = members.length;
    if (countMembers === 2) {
      const user = members.find((m: CallMember) => m.id === currentUserId);
      if (user) {
        return {
          id: user.id,
          fullname: user.fullname,
          avatar: user.avatar,
        };
      }
      const unknownLabel = t("callPage.labels.unknown");
      return {
        id: "0",
        fullname: unknownLabel,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          unknownLabel,
        )}`,
      };
    }
    const groupLabel = t("callPage.labels.youAndOthers");
    return {
      id: "0",
      fullname: groupLabel,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        groupLabel,
      )}`,
    };
  }, [currentUserId, members, t]);

  const getUserInfoLabel = useCallback(() => {
    const countMembers = members.length;
    const isCaller =
      !!currentUserId &&
      members.some((m: CallMember) => m.id === currentUserId && m.is_caller);
    if (countMembers > 2) {
      if (isCaller) {
        return t("callPage.status.groupCaller", { count: countMembers - 1 });
      }
      return t("callPage.status.groupReceiver", { count: countMembers - 1 });
    }

    if (isCaller) {
      const callee = members.find(
        (m: CallMember) => m.id !== currentUserId && !m.is_caller,
      );
      return t("callPage.status.oneOnOneCaller", {
        name: callee?.fullname || t("callPage.labels.unknownUser"),
      });
    }

    const caller = members.find(
      (m: CallMember) => m.id !== currentUserId && m.is_caller,
    );
    return t("callPage.status.oneOnOneReceiver", {
      name: caller?.fullname || t("callPage.labels.unknownUser"),
    });
  }, [currentUserId, members, t]);

  // Helper function to get member info from stream key
  const getMemberFromStreamKey = (key: string): CallMember | null => {
    // Key format: `${roomId}-${actionUserId}`
    if (!roomId) return null;

    // Remove roomId prefix to get userId
    const userId = key.replace(`${roomId}-`, "");
    return members.find((m: CallMember) => m.id === userId) || null;
  };

  // Calculate grid layout based on number of streams
  const getGridLayout = (count: number) => {
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count === 3) return "grid-cols-2"; // 2 columns, 3rd row spans
    if (count === 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    return "grid-cols-4"; // 7+ streams
  };

  if (!isMounted) {
    return null;
  }

  if (!socket) {
    return (
      <div className="bg-dark h-screen w-full flex items-center justify-center">
        <p className="text-gray-500">{t("callPage.loading.connecting")}</p>
      </div>
    );
  }

  if (!members || callStatus === "idle" || callStatus === "joined") {
    return (
      <div className="bg-dark h-screen w-full flex items-center justify-center">
        <p className="text-gray-500">{t("callPage.loading.callInfo")}</p>
      </div>
    );
  }

  // Screen-share aware layout. When anyone (local or remote) is actively
  // broadcasting their screen, the screen takes the main full-frame area and
  // all camera tiles (including own) stack as a vertical strip on the right —
  // Messenger style. Picks local screen first, else the first remote sharer.
  //
  // Gate on `peersSharingScreen` Set, NOT on `remoteScreenStreams.size`. In
  // P2P we pre-allocate the screen transceiver at PC creation, so a (muted)
  // remote screen track already exists in `remoteScreenStreams` from the
  // start of every call — checking size would always render the screen view
  // even when no one is sharing.
  const isAnyScreenSharing =
    !!localScreenStream || peersSharingScreen.size > 0;
  let primaryScreenStream: MediaStream | null = null;
  let primaryScreenSharerKey: string | null = null;
  // Explicit screen pin wins over the default precedence. Lets the user
  // click a peer's screen tile in the strip to swap THAT screen to main —
  // without this, default picks own localScreenStream first, so clicking
  // peer's tile when you're also sharing would have no visible effect.
  if (
    screenSharerIdGhimmed &&
    (screenSharerIdGhimmed === currentUserId
      ? !!localScreenStream
      : peersSharingScreen.has(screenSharerIdGhimmed))
  ) {
    if (screenSharerIdGhimmed === currentUserId) {
      primaryScreenStream = localScreenStream;
    } else {
      const key = `${roomId}-${screenSharerIdGhimmed}`;
      primaryScreenStream = remoteScreenStreams.get(key) || null;
      primaryScreenSharerKey = key;
    }
  } else if (localScreenStream) {
    primaryScreenStream = localScreenStream;
  } else if (peersSharingScreen.size > 0) {
    const sharerId = Array.from(peersSharingScreen)[0];
    const key = `${roomId}-${sharerId}`;
    primaryScreenStream = remoteScreenStreams.get(key) || null;
    primaryScreenSharerKey = key;
  }
  const primaryScreenSharer: CallMember | null =
    primaryScreenSharerKey
      ? getMemberFromStreamKey(primaryScreenSharerKey)
      : null;

  // PIP overlay activation: prefer pin, fall back to active screen-share.
  // Hoisted here so the floating-local-PiP and the legacy bottom-pin strip
  // below can suppress themselves when the overlay takes the layout over.
  const pipPinnedKey = userIdGhimmed ? `${roomId}-${userIdGhimmed}` : null;
  const pipPinnedStream = pipPinnedKey
    ? remoteStreams.get(pipPinnedKey)
    : null;
  const isPipOverlayActive =
    (isAnyScreenSharing && !!primaryScreenStream) || !!pipPinnedStream;

  return (
    <div className="bg-dark h-screen w-full relative overflow-hidden">
      {/* PIP overlay. Mounts above the grid in either of two cases:
            (a) someone is sharing screen → main = screen, strip = cameras + screens
            (b) user pinned a camera → main = pinned camera, strip = others
          Pinning takes priority (per UX request: "ưu tiên giao diện pip
          khi có ghim"). Layout is the same in both cases — only the main
          view content differs. */}
      {isPipOverlayActive && (() => {
        const pinnedKey = pipPinnedKey;
        const pinnedStream = pipPinnedStream;
        const pinnedMember = pinnedKey
          ? getMemberFromStreamKey(pinnedKey)
          : null;
        const showCameraAsMain = !!pinnedStream;

        return (
          <div className="absolute inset-0 bg-black z-10 flex">
            {/* Main view */}
            <div className="flex-1 relative min-w-0">
              {showCameraAsMain && pinnedStream ? (
                <>
                  <video
                    // Pinned camera as main. Click reverts to screen-as-main.
                    // Register the element under the pinned user's key so the
                    // [localStream, remoteStreams] effect rebinds srcObject
                    // whenever the underlying MediaStream object reference
                    // changes. Without this registration, the inline ref
                    // only fires on mount → after my pc.ontrack rebuilds
                    // the remote stream (new MediaStream object), the
                    // element still points at the OLD stream → black tile.
                    ref={(el) => {
                      if (!pinnedKey) return;
                      if (el) {
                        remoteVideoRefs.current.set(pinnedKey, el);
                        if (pinnedStream && el.srcObject !== pinnedStream) {
                          el.srcObject = pinnedStream;
                          el.play().catch(() => {});
                        }
                      } else {
                        remoteVideoRefs.current.delete(pinnedKey);
                      }
                    }}
                    className="w-full h-full object-contain bg-black cursor-pointer"
                    autoPlay
                    playsInline
                    muted={!isSpeakerphoneEnabled}
                    onClick={() => setUserIdGhimmed("")}
                  />
                  {pinnedKey &&
                    (remoteVideoMutedMap.get(pinnedKey) === true ||
                      (pinnedMember?.id
                        ? cameraOffPeers.has(pinnedMember.id)
                        : false)) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
                      <Avatar
                        src={pinnedMember?.avatar}
                        name={pinnedMember?.fullname || t("callPage.labels.unknown")}
                        className="w-32 h-32 text-4xl"
                      />
                    </div>
                  )}
                </>
              ) : (
                <video
                  ref={(el) => {
                    if (
                      el &&
                      primaryScreenStream &&
                      el.srcObject !== primaryScreenStream
                    ) {
                      el.srcObject = primaryScreenStream;
                      el.play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-contain bg-black"
                  autoPlay
                  playsInline
                  muted={!isSpeakerphoneEnabled || !!localScreenStream}
                />
              )}
              {/* Header label */}
              <div className="absolute top-4 left-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full backdrop-blur-sm">
                {showCameraAsMain
                  ? pinnedMember?.fullname || t("callPage.labels.unknownUser")
                  : localScreenStream
                    ? "Bạn đang chia sẻ màn hình"
                    : `${primaryScreenSharer?.fullname || "Người dùng"} đang chia sẻ màn hình`}
              </div>
            </div>

            {/* Right strip — collapsible. When open, shows own + other
                cameras + screen tile (when pinned). When collapsed, shrinks
                to a thin handle so the shared screen takes the full window. */}
            <div
              className={`shrink-0 transition-[width] duration-200 bg-gray-950/80 relative ${
                stripCollapsed ? "w-3" : "w-44"
              }`}
            >
              {/* Toggle handle — sits half-out on the left edge of the strip.
                  Always visible, even when strip is collapsed, so the user
                  can re-open. */}
              <button
                type="button"
                aria-label={stripCollapsed ? "Mở danh sách" : "Thu danh sách"}
                onClick={() => setStripCollapsed((s) => !s)}
                className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-12 rounded-l-md bg-gray-800 hover:bg-gray-700 text-white text-base flex items-center justify-center shadow-lg z-10"
              >
                {stripCollapsed ? "‹" : "›"}
              </button>

              {!stripCollapsed && (
                <div className="flex flex-col gap-2 p-2 h-full overflow-y-auto">
                  {/* Own ("Bạn") tile — always rendered so the user sees a
                      tile representing themselves. When camera is off, swap
                      the <video> for the user's avatar. */}
                  {localStream && (() => {
                    const isOwnSpeaking =
                      !!currentUserId && speakingUsers.has(currentUserId);
                    return (
                    <div
                      className={`relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900 transition-all ${
                        isOwnSpeaking
                          ? "ring-2 ring-green-400 speaker-glow"
                          : "border border-white/40"
                      }`}
                    >
                      {isCameraEnabled ? (
                        <video
                          ref={(el) => {
                            if (el && localStream && el.srcObject !== localStream) {
                              el.srcObject = localStream;
                              el.play().catch(() => {});
                            }
                          }}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                          <div
                            className={`rounded-full ${
                              isOwnSpeaking ? "speaker-glow" : ""
                            }`}
                          >
                            <Avatar
                              src={currentUser?.avatar}
                              name={currentUser?.fullname || "Bạn"}
                              className="w-12 h-12 text-base"
                            />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 right-1 text-white text-[10px] font-medium px-1 py-0.5 bg-black/50 rounded truncate">
                        Bạn
                      </div>
                      {!isMicEnabled && (
                        <div className="absolute top-1 right-1 z-10 bg-red-500 rounded-full p-1 shadow-md">
                          <div className="relative w-3 h-3">
                            <MicrophoneIcon className="w-3 h-3 text-white" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-full h-0.5 bg-white rotate-45" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* Screen tiles — show every active share so the user can
                      switch which screen is in the main view. Skip ONLY the
                      share currently shown as main (avoid rendering the same
                      stream twice + identical srcObject binding).

                      Own-screen-in-PIP rule: show "Bạn (màn hình)" whenever
                      the user is sharing AND the main view is NOT showing
                      that same screen. Two cases collapse here:
                      (a) showCameraAsMain (camera pinned): screen is nowhere
                          in main → render in strip.
                      (b) screen-as-main but pinned to a peer's screen
                          (primaryScreenStream !== localScreenStream): own
                          screen is also not in main → render in strip.
                      Skip only when own screen is the actual main content. */}
                  {localScreenStream && (
                    showCameraAsMain || primaryScreenStream !== localScreenStream
                  ) && (
                    <div
                      className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900 border border-white/30 cursor-pointer"
                      onClick={() =>
                        setScreenSharerIdGhimmed(currentUserId || "")
                      }
                    >
                      <video
                        ref={(el) => {
                          if (
                            el &&
                            localScreenStream &&
                            el.srcObject !== localScreenStream
                          ) {
                            el.srcObject = localScreenStream;
                            el.play().catch(() => {});
                          }
                        }}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                      />
                      <div className="absolute bottom-1 left-1 right-1 text-white text-[10px] font-medium px-1 py-0.5 bg-black/50 rounded truncate">
                        Bạn (màn hình)
                      </div>
                    </div>
                  )}
                  {Array.from(peersSharingScreen).map((sharerId) => {
                    const key = `${roomId}-${sharerId}`;
                    const stream = remoteScreenStreams.get(key);
                    if (!stream) return null;
                    // Skip the share currently in main (when screen is main
                    // — i.e. no camera pinned). When a camera is pinned, all
                    // screens fall to the strip including the primary one.
                    if (!showCameraAsMain && key === primaryScreenSharerKey) {
                      return null;
                    }
                    const member = getMemberFromStreamKey(key);
                    return (
                      <div
                        key={`screen-strip-${key}`}
                        className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900 border border-white/30 cursor-pointer"
                        onClick={() => setScreenSharerIdGhimmed(sharerId)}
                      >
                        <video
                          ref={(el) => {
                            if (el && stream && el.srcObject !== stream) {
                              el.srcObject = stream;
                              el.play().catch(() => {});
                            }
                          }}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted={!isSpeakerphoneEnabled}
                        />
                        <div className="absolute bottom-1 left-1 right-1 text-white text-[10px] font-medium px-1 py-0.5 bg-black/50 rounded truncate">
                          {(member?.fullname || t("callPage.labels.unknownUser")) +
                            " (màn hình)"}
                        </div>
                      </div>
                    );
                  })}

                  {/* Other participants' cameras. Skip the pinned user
                      (already in main). Show avatar when their video track
                      has no frames flowing — either no video track at all
                      or the receiver track is muted (sender disabled cam). */}
                  {Array.from(remoteStreams.entries()).map(([key, stream]) => {
                    const member = getMemberFromStreamKey(key);
                    if (member?.id === userIdGhimmed) return null;
                    const hasVideoTrack = stream.getVideoTracks().length > 0;
                    const isVideoOff =
                      !hasVideoTrack ||
                      remoteVideoMutedMap.get(key) === true ||
                      (member?.id ? cameraOffPeers.has(member.id) : false);
                    const isSpeaking = !!member?.id && speakingUsers.has(member.id);
                    return (
                      <div
                        key={`strip-${key}`}
                        className={`relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900 cursor-pointer transition-all ${
                          isSpeaking
                            ? "ring-2 ring-green-400 speaker-glow"
                            : "hover:ring-2 hover:ring-white/40"
                        }`}
                        onClick={() => setUserIdGhimmed(member?.id || "")}
                      >
                        <video
                          ref={(el) => {
                            if (el && stream && el.srcObject !== stream) {
                              el.srcObject = stream;
                              el.play().catch(() => {});
                            }
                          }}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted={!isSpeakerphoneEnabled}
                        />
                        {isVideoOff && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 pointer-events-none">
                            <Avatar
                              src={member?.avatar}
                              name={member?.fullname || t("callPage.labels.unknown")}
                              className="w-12 h-12 text-base"
                            />
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 right-1 text-white text-[10px] font-medium px-1 py-0.5 bg-black/50 rounded truncate">
                          {member?.fullname || t("callPage.labels.unknownUser")}
                        </div>
                        {member?.id && micOffPeers.has(member.id) && (
                          <div className="absolute top-1 right-1 z-10 bg-red-500 rounded-full p-1 shadow-md">
                            <div className="relative w-3 h-3">
                              <MicrophoneIcon className="w-3 h-3 text-white" />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-full h-0.5 bg-white rotate-45" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Remote video (main view).
          Render whenever there are remote streams — regardless of whether
          the call started as audio or video. The <video> element plays both
          audio AND video; for streams that have no video track yet, we
          overlay an avatar so the UI doesn't show a confusing black box.
          callType (audio/video) only controls the initial camera state on
          accept; runtime UI is unified. */}
      <div className="absolute inset-0 bg-black">
        {remoteStreams.size > 0 || userIdGhimmed ? (
          userIdGhimmed || remoteStreams.size === 1 ? (
            // Single stream - full screen (Pinned or only one remote)
            (() => {
              const key = userIdGhimmed
                ? `${roomId}-${userIdGhimmed}`
                : Array.from(remoteStreams.keys())[0];
              const stream = remoteStreams.get(key);
              const member = getMemberFromStreamKey(key);

              if (!stream)
                return (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-gray-500">
                      {t("callPage.loading.stream")}
                    </p>
                  </div>
                );

              const videoRef = (el: HTMLVideoElement | null) => {
                if (el) {
                  remoteVideoRefs.current.set(key, el);
                  // Assign srcObject immediately on mount so streams that arrived
                  // before this element was rendered are shown without waiting for
                  // the useEffect to re-run (which only fires when deps change).
                  if (stream && el.srcObject !== stream) {
                    el.srcObject = stream;
                    el.play().catch(() => {});
                  }
                } else {
                  remoteVideoRefs.current.delete(key);
                }
              };

              const hasVideoTrack = stream.getVideoTracks().length > 0;
              const isVideoOff =
                !hasVideoTrack ||
                remoteVideoMutedMap.get(key) === true ||
                (member?.id ? cameraOffPeers.has(member.id) : false);
              const isSpeaking = !!member?.id && speakingUsers.has(member.id);

              return (
                <div
                  className={`relative w-full h-full transition-all ${
                    isSpeaking ? "ring-4 ring-green-400 ring-inset speaker-glow" : ""
                  }`}
                >
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain bg-black"
                    autoPlay
                    playsInline
                    muted={!isSpeakerphoneEnabled}
                    onClick={() =>
                      setUserIdGhimmed(userIdGhimmed ? "" : member?.id || "")
                    }
                  />
                  {/* No-video overlay: audio plays through the <video> element
                      but a black box is confusing — show the member's avatar
                      so the user knows who they're talking to. The
                      speaker-glow ring is applied directly around the avatar
                      (the outer ring on the full tile is barely visible at
                      screen edges in audio-only layout). */}
                  {isVideoOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
                      <div
                        className={`rounded-full ${
                          isSpeaking ? "speaker-glow" : ""
                        }`}
                      >
                        <Avatar
                          src={member?.avatar}
                          name={member?.fullname || t("callPage.labels.unknown")}
                          className="w-32 h-32 text-4xl"
                        />
                      </div>
                    </div>
                  )}
                  {/* User info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pointer-events-none">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member?.avatar}
                        name={member?.fullname || t("callPage.labels.unknown")}
                        className="w-10 h-10"
                      />
                      <span className="text-white text-lg font-semibold">
                        {member?.fullname || t("callPage.labels.unknownUser")}
                      </span>
                    </div>
                  </div>
                  {/* Big mic-muted badge removed — small per-tile
                      mic-off icons in the strip are enough indication.
                      A floating banner over the main view duplicated info
                      and obstructed the video. */}
                </div>
              );
            })()
          ) : (
            // Multiple streams - grid layout
            <div
              className={`w-full h-full grid ${getGridLayout(
                remoteStreams.size,
              )} gap-2 p-2`}
            >
              {Array.from(remoteStreams.entries()).map(([key, stream]) => {
                const member = getMemberFromStreamKey(key);
                const videoRef = (el: HTMLVideoElement | null) => {
                  if (el) {
                    remoteVideoRefs.current.set(key, el);
                    if (stream && el.srcObject !== stream) {
                      el.srcObject = stream;
                      el.play().catch(() => {});
                    }
                  } else {
                    remoteVideoRefs.current.delete(key);
                  }
                };

                const hasVideoTrack = stream.getVideoTracks().length > 0;
                const isVideoOff =
                  !hasVideoTrack ||
                  remoteVideoMutedMap.get(key) === true ||
                  (member?.id ? cameraOffPeers.has(member.id) : false);
                const isSpeaking =
                  !!member?.id && speakingUsers.has(member.id);

                return (
                  <div
                    key={key}
                    className={`relative w-full h-full bg-gray-900 rounded-lg overflow-hidden min-h-0 cursor-pointer transition-all ${
                      isSpeaking ? "ring-2 ring-green-400 speaker-glow" : ""
                    }`}
                    onClick={() => setUserIdGhimmed(member?.id || "")}
                  >
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted={!isSpeakerphoneEnabled}
                    />
                    {isVideoOff && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900 pointer-events-none">
                        <div
                          className={`rounded-full ${
                            isSpeaking ? "speaker-glow" : ""
                          }`}
                        >
                          <Avatar
                            src={member?.avatar}
                            name={member?.fullname || t("callPage.labels.unknown")}
                            className="w-16 h-16 text-2xl"
                          />
                        </div>
                      </div>
                    )}
                    {/* User info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pointer-events-none">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={member?.avatar}
                          name={
                            member?.fullname || t("callPage.labels.unknown")
                          }
                          className="w-6 h-6 text-xs"
                        />
                        <span className="text-white text-xs font-medium truncate">
                          {member?.fullname || t("callPage.labels.unknownUser")}
                        </span>
                      </div>
                    </div>
                    {/* Mic-muted badge */}
                    {member?.id && micOffPeers.has(member.id) && (
                      <div className="absolute top-2 right-2 z-10 bg-red-500 rounded-full p-1 shadow-md">
                        <div className="relative w-3 h-3">
                          <MicrophoneIcon className="w-3 h-3 text-white" />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-full h-0.5 bg-white rotate-45" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : callStatus === "accepted" && remoteStreams.size === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <Avatar
              src={getUserInfo().avatar}
              name={getUserInfo().fullname}
              className="w-32 h-32 text-4xl"
            />
            <p className="text-gray-300 text-base">
              {t("callPage.status.waitingForOthers")}
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar
              src={getUserInfo().avatar}
              name={getUserInfo().fullname}
              className="w-32 h-32 text-4xl"
            />
          </div>
        )}
      </div>

      {/* Local video (picture-in-picture) — only renders when the user's
          camera is currently on AND we're NOT in PIP overlay mode (active
          on screen-share OR pin). During overlay mode the local self-view
          is consolidated into the right strip as the "Bạn" tile, so
          rendering this floating PiP would duplicate + overlap the strip. */}
      {isCameraEnabled && localStream && remoteStreams.size > 0 && !isPipOverlayActive && (
        <div
          className="absolute bottom-24 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg z-20"
        >
          <video
            ref={(el) => {
              localVideoRef.current = el;
              if (el && localStream && el.srcObject !== localStream) {
                el.srcObject = localStream;
                el.play().catch(() => {});
              }
            }}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
        </div>
      )}

      {/* Other remote streams when one is pinned (legacy bottom strip).
          Suppressed when the new PIP overlay is active — the overlay's
          right-side strip already shows every other camera + screen tile,
          so rendering this would just duplicate them at the bottom-left. */}
      {userIdGhimmed && remoteStreams.size > 1 && !isPipOverlayActive && (
        <div className="absolute bottom-24 left-4 flex gap-2 z-20 overflow-x-auto max-w-[calc(100%-14rem)]">
          {Array.from(remoteStreams.entries()).map(([key, stream]) => {
            const member = getMemberFromStreamKey(key);
            if (member?.id === userIdGhimmed) return null;

            const videoRef = (el: HTMLVideoElement | null) => {
              if (el) {
                remoteVideoRefs.current.set(key, el);
                if (stream && el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play().catch(() => {});
                }
              } else {
                remoteVideoRefs.current.delete(key);
              }
            };

            return (
              <div
                key={key}
                className="w-32 h-24 rounded-lg overflow-hidden border border-white/50 bg-black cursor-pointer flex-shrink-0"
                onClick={() => setUserIdGhimmed(member?.id || "")}
              >
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted={!isSpeakerphoneEnabled}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Busy notification banner */}
      {busyUser && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-yellow-500 text-black px-6 py-3 rounded-full font-semibold shadow-lg text-sm whitespace-nowrap">
          {busyUser} đang bận — cuộc gọi sẽ tự đóng...
        </div>
      )}

      {/* Rejected / no-answer banner — shown for 3s before the popup closes */}
      {endNotice && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-yellow-500 text-black px-6 py-3 rounded-full font-semibold shadow-lg text-sm whitespace-nowrap">
          {endNotice} — {t("callPage.toast.willClose")}
        </div>
      )}

      {/* Stack of transient join/leave/reject toasts (group calls only).
          Stacks vertically below the rejected banner; each entry fades
          out after 4s. Pointer-events-none so they don't block the call
          controls underneath. */}
      {callToasts.length > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col gap-2 pointer-events-none">
          {callToasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-black/70 text-white px-4 py-2 rounded-full text-sm shadow-lg whitespace-nowrap"
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}

      {/* Call info overlay */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center z-10">
        <h2 className="text-white text-xl font-semibold mb-1">
          {callStatus === "accepted"
            ? t("callPage.status.connected")
            : getUserInfoLabel()}
        </h2>
        {callStatus === "accepted" && (
          <p className="text-gray-300 text-sm">{formatDuration(duration)}</p>
        )}
      </div>

      {/* Control buttons */}
      {/*
        Note: the in-page "incoming" Y/N screen has been removed — accept/reject
        is now handled by <IncomingCallModal /> in the main tab BEFORE this
        window opens. The popup always lands on status='joined' (or 'calling'
        for caller / 'accepted' once member-joined arrives).
      */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10">
        <Button
          color={isMicEnabled ? "danger" : "default"}
              className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                isMicEnabled ? "bg-primary" : "bg-white/20"
              }`}
              onPress={() =>
                actionToggleTrack("mic", isMicEnabled ? false : true)
              }
              isIconOnly
            >
              <MicrophoneIcon className={`h-6 w-6 text-white`} />
            </Button>
            {/* Camera button — always visible. In an audio-only call,
                clicking enable triggers `upgradeToVideo()` which adds a
                video track on the fly + produces / renegotiates. */}
            <Button
              color={isCameraEnabled ? "default" : "danger"}
              className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                isCameraEnabled ? "bg-primary" : "bg-white/20"
              }`}
              onPress={() =>
                actionToggleTrack("video", isCameraEnabled ? false : true)
              }
              isIconOnly
              aria-label={isCameraEnabled ? "Tắt camera" : "Bật camera"}
            >
              {isCameraEnabled ? (
                <VideoCameraIcon className="h-6 w-6 text-white" />
              ) : (
                <VideoCameraSlashIcon className="h-6 w-6 text-white" />
              )}
            </Button>
            <Button
              color="danger"
              className="rounded-full h-14 w-14 p-0"
              onPress={handleEndCall}
              isIconOnly
            >
              <PhoneXMarkIcon className="h-7 w-7" />
            </Button>
            <Button
              color={isSpeakerphoneEnabled ? "default" : "danger"}
              className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                isSpeakerphoneEnabled ? "bg-primary" : "bg-white/20"
              }`}
              onPress={() =>
                actionToggleTrack("speaker", !isSpeakerphoneEnabled)
              }
              isIconOnly
            >
              {isSpeakerphoneEnabled ? (
                <SpeakerWaveIcon className="h-6 w-6 text-white" />
              ) : (
                <SpeakerXMarkIcon className="h-6 w-6 text-white" />
              )}
            </Button>
            {callStatus === "accepted" && (
              <Button
                color="default"
                className={`rounded-full h-14 w-14 p-0 backdrop-blur-sm ${
                  isSharingScreen ? "bg-primary" : "bg-white/20"
                }`}
                onPress={() =>
                  actionToggleTrack("shareScreen", !isSharingScreen)
                }
                isIconOnly
              >
                <ComputerDesktopIcon className="h-6 w-6 text-white" />
              </Button>
            )}
            <Button
              isIconOnly
              className="rounded-full h-14 w-14 p-0 bg-white/20 backdrop-blur-sm"
              onPress={() => {
                getDevices();
                setIsSettingsOpen(true);
              }}
            >
              <Cog6ToothIcon className="h-6 w-6 text-white" />
            </Button>
      </div>

      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <ModalContent>
          <ModalHeader>{t("callPage.labels.deviceSettings")}</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Select
                label={t("callPage.labels.microphone")}
                selectedKeys={
                  devices.selectedAudioInput ? [devices.selectedAudioInput] : []
                }
                onChange={(e) => setDevice("audioInput", e.target.value)}
              >
                {devices.audioInputs.map((device) => (
                  <SelectItem key={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId}`}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label={t("callPage.labels.speaker")}
                selectedKeys={
                  devices.selectedAudioOutput
                    ? [devices.selectedAudioOutput]
                    : []
                }
                onChange={(e) => setDevice("audioOutput", e.target.value)}
              >
                {devices.audioOutputs.map((device) => (
                  <SelectItem key={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId}`}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label={t("callPage.labels.camera")}
                selectedKeys={
                  devices.selectedVideoInput ? [devices.selectedVideoInput] : []
                }
                onChange={(e) => setDevice("videoInput", e.target.value)}
              >
                {devices.videoInputs.map((device) => (
                  <SelectItem key={device.deviceId}>
                    {device.label || `Camera ${device.deviceId}`}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={() => setIsSettingsOpen(false)}>
              {t("callPage.labels.close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function CallPageContent() {
  return (
    <Suspense
      fallback={
        <div className="bg-dark h-screen w-full flex items-center justify-center">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      }
    >
      <CallPageContentInner />
    </Suspense>
  );
}

export default CallPageContent;
