import * as mediasoupClient from "mediasoup-client";

export interface SfuSessionState {
  device: mediasoupClient.types.Device | null;
  sendTransport: mediasoupClient.types.Transport | null;
  recvTransport: mediasoupClient.types.Transport | null;
  producers: Map<string, mediasoupClient.types.Producer>;
  consumers: Map<string, mediasoupClient.types.Consumer>;
  pendingProduceCallbacks: Map<string, (params: { id: string }) => void>;
}

export interface SfuStoreState {
  sfu: SfuSessionState;
  initSFU: () => Promise<void>;
  handleSFUSignal: (payload: any) => Promise<void>;
  replaceTracksInProducers: (newStream: MediaStream) => Promise<void>;
  teardownSfu: () => void;
  produceLocalStream: (localStream: MediaStream) => Promise<void>;
}
