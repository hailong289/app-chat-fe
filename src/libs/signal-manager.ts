/**
 * Frontend Signal Manager
 * Handles unified signal events for both P2P and SFU calls
 */

import { Socket } from "socket.io-client";
import { SignalPayload, SignalResponse } from "@/types/signal-payload";

export class SignalManager {
  private socket: Socket | null = null;
  private handlers: Map<string, (data: SignalResponse) => void> = new Map();

  constructor(socket: Socket | null) {
    this.socket = socket;
    this.setupListener();
  }

  /**
   * Setup unified signal listener
   */
  private setupListener() {
    if (!this.socket) return;

    this.socket.on("signal", (data: SignalResponse) => {
      console.log("[Signal] Received:", data.type, "from", data.sender);

      if (data.sender === "sfu") {
        this.handleSFUSignal(data);
      } else {
        this.handleP2PSignal(data);
      }
    });
  }

  /**
   * Send signal (unified method)
   */
  send(payload: SignalPayload) {
    if (!this.socket) {
      console.error("[Signal] Socket not connected");
      return;
    }

    console.log("[Signal] Sending:", payload.type, "to", payload.target);
    this.socket.emit("signal", payload);
  }

  /**
   * Register handler for specific signal type
   */
  on(type: string, handler: (data: SignalResponse) => void) {
    this.handlers.set(type, handler);
  }

  /**
   * Handle SFU server responses
   */
  private handleSFUSignal(data: SignalResponse) {
    const handler = this.handlers.get(`sfu:${data.type}`);
    if (handler) {
      handler(data);
    } else {
      console.warn(`[Signal] No handler for SFU signal type: ${data.type}`);
    }
  }

  /**
   * Handle P2P peer signals
   */
  private handleP2PSignal(data: SignalResponse) {
    const handler = this.handlers.get(`p2p:${data.type}`);
    if (handler) {
      handler(data);
    } else {
      console.warn(`[Signal] No handler for P2P signal type: ${data.type}`);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.socket) {
      this.socket.off("signal");
    }
    this.handlers.clear();
  }
}

// ========== Usage Example ==========

/*
// Initialize
const signalManager = new SignalManager(socket);

// Register handlers
signalManager.on('p2p:offer', (data) => {
  // Handle incoming P2P offer from another user
  handleP2POffer(data.sender, data.sdp);
});

signalManager.on('sfu:join', (data) => {
  // Handle SFU join response
  if (data.ok) {
    initializeSFUClient(data.rtpCapabilities);
  }
});

signalManager.on('sfu:produce', (data) => {
  // Handle SFU produce response
  if (data.ok) {
    console.log('Producer created:', data.producerId);
  }
});

// Send P2P signal
signalManager.send({
  roomId: 'room-123',
  type: 'offer',
  target: 'user-456',  // Send to specific user
  sdp: myOffer,
});

// Send SFU signal
signalManager.send({
  roomId: 'room-123',
  type: 'join',
  target: 'sfu',  // Send to SFU server
});

signalManager.send({
  roomId: 'room-123',
  type: 'produce',
  target: 'sfu',
  transportId: 'transport-123',
  kind: 'video',
  rtpParameters: params,
});
*/
