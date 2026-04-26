import { create, UseBoundStore, StoreApi } from "zustand";
import { SfuStoreState, SfuSessionState } from "./types/call-sfu.state";
import { Device } from "mediasoup-client";

// Circular import is safe: access is only inside action closures.
import useCallStore from "./useCallStore";

// Module-level Set prevents duplicate consumption (race condition guard).
// Both produce:broadcast and getProducers can fire for the same producerId
// concurrently. _consumingProducerIds is updated synchronously before any
// await, so concurrent async handlers always see the updated value.
const _consumingProducerIds = new Set<string>();

const EMPTY_SFU: SfuSessionState = {
  device: null,
  sendTransport: null,
  recvTransport: null,
  producers: new Map(),
  consumers: new Map(),
  pendingProduceCallbacks: new Map(),
  screenProducer: null,
  screenProducerIds: new Set<string>(),
};

const useSfuCallStore: UseBoundStore<StoreApi<SfuStoreState>> = create<SfuStoreState>()((set, get) => ({
  sfu: { ...EMPTY_SFU },

  initSFU: async () => {
    try {
      if (get().sfu.device) return; // already initialized
      const device = new Device();
      set((prev) => ({ sfu: { ...prev.sfu, device } }));
      console.log("[SFU] Device initialized");
    } catch (error) {
      console.error("[SFU] Failed to initialize device:", error);
    }
  },

  produceLocalStream: async (localStream) => {
    const { sfu } = get();
    if (!sfu.sendTransport || sfu.sendTransport.closed) return;
    if (sfu.producers.size > 0 || sfu.pendingProduceCallbacks.size > 0) return;

    const newProducerEntries: [string, any][] = [];
    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];

    if (audioTrack) {
      const ap = await sfu.sendTransport.produce({ track: audioTrack });
      newProducerEntries.push([ap.id, ap]);
    }
    if (videoTrack) {
      const vp = await sfu.sendTransport.produce({ track: videoTrack });
      newProducerEntries.push([vp.id, vp]);
    }

    if (newProducerEntries.length > 0) {
      set((prev) => ({
        sfu: {
          ...prev.sfu,
          producers: new Map([...prev.sfu.producers, ...newProducerEntries]),
        },
      }));
    }
  },

  replaceTracksInProducers: async (newStream) => {
    const { sfu } = get();
    const audioTrack = newStream.getAudioTracks()[0];
    const videoTrack = newStream.getVideoTracks()[0];

    for (const producer of sfu.producers.values()) {
      if (producer.closed) continue;
      if (producer.kind === "audio" && audioTrack) {
        await producer.replaceTrack({ track: audioTrack });
      }
      if (producer.kind === "video" && videoTrack) {
        await producer.replaceTrack({ track: videoTrack });
      }
    }
  },

  teardownSfu: () => {
    const { sfu } = get();
    const { socket, roomId } = useCallStore.getState();

    // Notify SFU server to remove this participant before closing transports
    if (roomId && socket) {
      socket.emit("signal", { type: "leave", roomId, target: "sfu" });
    }

    sfu.sendTransport?.close();
    sfu.recvTransport?.close();
    _consumingProducerIds.clear();

    set({ sfu: { ...EMPTY_SFU } });
  },

  handleSFUSignal: async (payload) => {
    const {
      type,
      ok,
      rtpCapabilities,
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

    if (ok === false) {
      if (type === "createTransport") {
        const { socket, roomId } = useCallStore.getState();
        console.warn(`[SFU] createTransport failed (${message}), re-joining SFU room...`);
        socket?.emit("signal", { type: "join", roomId, target: "sfu" });
      } else {
        console.error(`[SFU] Signal error (${type}):`, message);
      }
      return;
    }

    try {
      switch (type) {
        case "join": {
          const { socket: currentSocket, roomId: currentRoomId } = useCallStore.getState();
          const { sfu } = get();
          if (!sfu.device) return;

          // Guard: skip load if already loaded (handles reconnect/retry)
          if (!sfu.device.loaded) {
            await sfu.device.load({ routerRtpCapabilities: rtpCapabilities });
          }

          currentSocket?.emit("signal", {
            type: "createTransport",
            roomId: currentRoomId,
            target: "sfu",
            direction: "send",
          });
          break;
        }

        case "createTransport": {
          const { socket, roomId } = useCallStore.getState();
          const { sfu } = get();
          if (!sfu.device || !roomId) return;

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

          transport.on("connect", ({ dtlsParameters: dtls }, callback) => {
            socket?.emit("signal", {
              type: "connectTransport",
              roomId,
              target: "sfu",
              transportId: transport.id,
              dtlsParameters: dtls,
            });
            // Assume success (awaiting ack adds complexity without much benefit)
            callback();
          });

          if (isSend) {
            transport.on(
              "produce",
              ({ kind: k, rtpParameters: rtp, appData }, callback) => {
                const requestId =
                  Math.random().toString(36).slice(2) + Date.now().toString(36);

                set((prev) => {
                  const newCallbacks = new Map(prev.sfu.pendingProduceCallbacks);
                  newCallbacks.set(requestId, callback);
                  return { sfu: { ...prev.sfu, pendingProduceCallbacks: newCallbacks } };
                });

                socket?.emit("signal", {
                  type: "produce",
                  roomId,
                  target: "sfu",
                  transportId: transport.id,
                  kind: k,
                  rtpParameters: rtp,
                  appData: { ...(appData as object), requestId },
                });
              },
            );

            set((prev) => ({ sfu: { ...prev.sfu, sendTransport: transport } }));

            // Single source of truth: always route through produceLocalStream so
            // the producers Map stays in sync. If localStream isn't ready yet,
            // this returns early — handleCreateLocalStream will call it again
            // after getUserMedia resolves.
            const { stream: coordinatorStream } = useCallStore.getState();
            if (coordinatorStream.localStream) {
              await get().produceLocalStream(coordinatorStream.localStream);
            }

            // Create receive transport
            socket?.emit("signal", {
              type: "createTransport",
              roomId,
              target: "sfu",
              direction: "recv",
            });
          } else {
            set((prev) => ({ sfu: { ...prev.sfu, recvTransport: transport } }));
            // Request existing producers so late-joiners / re-joiners get all streams
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
            // Call stored callback so transport.produce() resolves
            const reqId = payload.appData?.requestId;
            if (reqId) {
              set((prev) => {
                const cb = prev.sfu.pendingProduceCallbacks.get(reqId);
                if (cb) cb({ id: producerId });
                const newCbs = new Map(prev.sfu.pendingProduceCallbacks);
                newCbs.delete(reqId);
                return { sfu: { ...prev.sfu, pendingProduceCallbacks: newCbs } };
              });
            }
          } else if (target === "broadcast") {
            // Someone else started producing — consume their stream.
            // If recvTransport is not ready yet, skip; getProducers (emitted
            // after recvTransport creation) will include this producer.
            const { socket: s, roomId: r } = useCallStore.getState();
            const { sfu: sfuNow } = get();
            if (!sfuNow.recvTransport || !sfuNow.device) break;

            s?.emit("signal", {
              type: "consume",
              roomId: r,
              target: "sfu",
              transportId: sfuNow.recvTransport.id,
              producerId,
              rtpCapabilities: sfuNow.device.rtpCapabilities,
              userId: payload.userId,
            });
          }
          break;
        }

        case "getProducers": {
          // Consume all existing producers (late-join / re-join)
          const { socket: s, roomId: r } = useCallStore.getState();
          const { sfu: sfuNow } = get();
          if (!sfuNow.recvTransport || !sfuNow.device) return;

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
          const { sfu: sfuSnapshot } = get();
          if (!sfuSnapshot.recvTransport) return;

          // Guard: skip if already consuming this producer.
          // _consumingProducerIds is updated synchronously (before any await)
          // so concurrent async handlers always see the current state.
          const alreadyConsuming =
            _consumingProducerIds.has(producerId) ||
            [...sfuSnapshot.consumers.values()].some(
              (c) => c.producerId === producerId,
            );
          if (alreadyConsuming) {
            console.warn(`[SFU] Already consuming producer ${producerId}, skipping duplicate`);
            break;
          }

          _consumingProducerIds.add(producerId);

          try {
            const consumer = await sfuSnapshot.recvTransport.consume({
              id: consumerId,
              producerId,
              kind,
              rtpParameters,
            });

            const trackUserId = payload.userId || producerId;
            // Tag the consumer with its source userId so selective-render
            // (the strip-collapsed pause loop) can skip the consumer that
            // matches the currently-pinned-as-main user — otherwise pinning
            // a remote camera + collapsing the strip pauses the very stream
            // the user is watching → main view goes black.
            try {
              (consumer as { appData: Record<string, unknown> }).appData = {
                ...((consumer as { appData?: Record<string, unknown> }).appData ??
                  {}),
                userId: trackUserId,
              };
            } catch {
              /* appData immutable in some mediasoup-client builds — fall back
                 to producer-only matching in the selective-render loop. */
            }
            // Routing: if this producerId was flagged as a screen-share by an
            // earlier `call:share-screen` socket event (`screenProducerIds`),
            // put the track in `remoteScreenStreams` so the screen-share UI
            // picks it up. Otherwise it's camera/mic — same path as before.
            const isScreen = get().sfu.screenProducerIds.has(producerId);

            // Update coordinator's remoteStreams using functional set() so
            // that concurrent audio and video consume handlers for the same
            // user always see the latest state. Without functional set, the
            // second handler overwrites the first instead of calling
            // addTrack() → black screen on the second track.
            //
            // We always re-emit the Map (even when adding a track to an
            // existing stream) so React's stream-content checks (e.g. "does
            // this stream have a video track yet?") re-run. The stream
            // reference itself stays the same, so DOM bindings on `srcObject`
            // are not interrupted.
            useCallStore.setState((prevCoordinator) => {
              const key = `${prevCoordinator.roomId}-${trackUserId}`;
              // Stream-identity rule (mirror of the P2P pc.ontrack path):
              // reuse the existing MediaStream object so any <video> already
              // bound to it keeps showing fresh frames; mutate tracks in
              // place and only bump the outer Map reference. Drop prior
              // tracks of the same kind (a fresh consumer.track of the same
              // kind supersedes them — happens after a remote camera off/on
              // cycle that re-issues a consume).
              if (isScreen) {
                const existing = prevCoordinator.stream.remoteScreenStreams.get(key);
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
                  prevCoordinator.stream.remoteScreenStreams,
                );
                newRemoteScreenStreams.set(key, target);
                return {
                  stream: {
                    ...prevCoordinator.stream,
                    remoteScreenStreams: newRemoteScreenStreams,
                  },
                };
              }
              const existing = prevCoordinator.stream.remoteStreams.get(key);
              const target = existing ?? new MediaStream();
              target.getTracks().forEach((t) => {
                if (t.kind === consumer.track.kind && t !== consumer.track) {
                  target.removeTrack(t);
                }
              });
              if (!target.getTracks().includes(consumer.track)) {
                target.addTrack(consumer.track);
              }
              const newRemoteStreams = new Map(prevCoordinator.stream.remoteStreams);
              newRemoteStreams.set(key, target);
              return {
                stream: {
                  ...prevCoordinator.stream,
                  remoteStreams: newRemoteStreams,
                },
              };
            });

            // Update SFU store's consumer list (functional set for concurrency)
            set((prev) => {
              const newConsumers = new Map(prev.sfu.consumers);
              newConsumers.set(consumer.id, consumer);
              return { sfu: { ...prev.sfu, consumers: newConsumers } };
            });
          } finally {
            _consumingProducerIds.delete(producerId);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`[SFU] handleSFUSignal error in case "${type}":`, error);
      // If join phase failed (e.g. device.load threw), retry
      if (type === "join") {
        const { socket: s, roomId: r } = useCallStore.getState();
        if (s && r) {
          console.warn("[SFU] Retrying SFU init due to error in case 'join'...");
          await get().initSFU();
          s.emit("signal", { type: "join", roomId: r, target: "sfu" });
        }
      }
    }
  },
}));

export default useSfuCallStore;
