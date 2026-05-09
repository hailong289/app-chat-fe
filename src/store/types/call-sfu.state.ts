import * as mediasoupClient from "mediasoup-client";

export interface SfuSessionState {
  device: mediasoupClient.types.Device | null;
  sendTransport: mediasoupClient.types.Transport | null;
  recvTransport: mediasoupClient.types.Transport | null;
  producers: Map<string, mediasoupClient.types.Producer>;
  consumers: Map<string, mediasoupClient.types.Consumer>;
  pendingProduceCallbacks: Map<string, (params: { id: string }) => void>;
  /** Local screen-share producer (separate from camera/mic producers). */
  screenProducer: mediasoupClient.types.Producer | null;
  /**
   * IDs of remote producers known to be screen-share sources. Populated by
   * the `call:share-screen` socket event before the broadcast `consume`
   * arrives, so the consume handler can route the track to
   * `remoteScreenStreams` instead of the camera `remoteStreams`.
   */
  screenProducerIds: Set<string>;
}

export interface SfuStoreState {
  sfu: SfuSessionState;
  initSFU: () => Promise<void>;
  handleSFUSignal: (payload: any) => Promise<void>;
  replaceTracksInProducers: (newStream: MediaStream) => Promise<void>;
  teardownSfu: () => void;
  produceLocalStream: (localStream: MediaStream) => Promise<void>;
}
