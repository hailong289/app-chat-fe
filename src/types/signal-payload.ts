/**
 * Unified Signal Payload for both P2P and SFU calls
 * Single event interface to rule them all!
 */

// ========== Core Signal Types ==========
export type SignalType =
  | "offer"
  | "answer"
  | "candidate"
  | "join" // SFU: Join room
  | "createTransport" // SFU: Create WebRTC transport
  | "connectTransport" // SFU: Connect transport
  | "produce" // SFU: Start producing media
  | "consume" // SFU: Start consuming media
  | "pause" // SFU: Pause producer
  | "resume" // SFU: Resume producer
  | "leave"; // SFU: Leave room

export type TargetType =
  | "sfu" // Route to SFU server
  | (string & {}); // userId for P2P routing (branded to preserve 'sfu' literal)

// ========== Main Signal Payload ==========
export interface SignalPayload {
  roomId: string;
  type: SignalType;
  target: TargetType;

  // For WebRTC P2P
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;

  // For SFU Operations
  transportId?: string;
  kind?: "audio" | "video";
  rtpParameters?: any;
  rtpCapabilities?: any;
  dtlsParameters?: any;
  producerId?: string;
  direction?: "send" | "recv";

  // Metadata
  sender?: string; // Set by server to identify who sent this
  userId?: string; // Current user ID
}

// ========== Response Payloads ==========
export interface SignalResponse {
  type: SignalType;
  sender: "sfu" | string; // Who is responding
  target: "me" | string;

  // P2P responses
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;

  // SFU responses
  ok?: boolean;
  message?: string;

  // SFU specific data
  rtpCapabilities?: any;
  transportId?: string;
  producerId?: string;
  consumerId?: string;
  iceParameters?: any;
  iceCandidates?: any;
  dtlsParameters?: any;
  rtpParameters?: any;
  kind?: "audio" | "video";
}

// ========== Type Guards ==========
export function isP2PSignal(target: TargetType): target is string {
  return target !== "sfu";
}

export function isSFUSignal(target: TargetType): target is "sfu" {
  return target === "sfu";
}
