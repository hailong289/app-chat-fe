/**
 * Socket Event Constants for Call System
 * Standardized event names for P2P and SFU calls
 */

export const CallEvents = {
  // ========== P2P Call Lifecycle ==========
  CALL_REQUEST: "call:request",
  CALL_ACCEPT: "call:accept",
  CALL_DECLINE: "call:decline",
  CALL_END: "call:end",

  // ========== P2P Signaling ==========
  CALL_OFFER: "call:offer",
  CALL_ANSWER: "call:answer",
  CALL_CANDIDATE: "call:candidate",

  // ========== SFU Lifecycle ==========
  SFU_JOIN: "sfu:join",
  SFU_LEAVE: "sfu:leave",

  // ========== SFU Signaling ==========
  SFU_GET_RTP_CAPABILITIES: "sfu:getRtpCapabilities",
  SFU_CREATE_TRANSPORT: "sfu:createTransport",
  SFU_CONNECT_TRANSPORT: "sfu:connectTransport",
  SFU_PRODUCE: "sfu:produce",
  SFU_CONSUME: "sfu:consume",
  SFU_PAUSE_PRODUCER: "sfu:pauseProducer",
  SFU_RESUME_PRODUCER: "sfu:resumeProducer",
  SFU_CLOSE_PRODUCER: "sfu:closeProducer",

  // ========== Media Controls ==========
  CALL_TOGGLE_AUDIO: "call:toggleAudio",
  CALL_TOGGLE_VIDEO: "call:toggleVideo",
  CALL_SHARE_SCREEN: "call:shareScreen",

  // ========== Server Events (received from server) ==========
  CALL_ACCEPTED: "call:accepted",
  CALL_ENDED: "call:end",
  CALL_AUDIO_TOGGLED: "call:audioToggled",
  CALL_VIDEO_TOGGLED: "call:videoToggled",
  SFU_NEW_PRODUCER: "sfu:newProducer",
} as const;

export type CallEventType = (typeof CallEvents)[keyof typeof CallEvents];

// Type-safe event data interfaces
export interface CallRequestData {
  roomId: string;
  callType: "audio" | "video";
  membersIds?: string[];
  messageId?: string;
}

export interface CallAcceptData {
  callId: string;
  roomId: string;
}

export interface CallEndData {
  callId: string;
  roomId: string;
}

export interface CallOfferData {
  roomId: string;
  offer: RTCSessionDescriptionInit;
  actionUserId: string;
}

export interface CallAnswerData {
  roomId: string;
  answer: RTCSessionDescriptionInit;
  actionUserId: string;
}

export interface CallCandidateData {
  roomId: string;
  candidate: RTCIceCandidateInit;
  actionUserId: string;
}

export interface SfuJoinData {
  roomId: string;
}

export interface SfuCreateTransportData {
  roomId: string;
  direction: "send" | "recv";
}

export interface SfuConnectTransportData {
  transportId: string;
  dtlsParameters: any;
}

export interface SfuProduceData {
  roomId: string;
  transportId: string;
  kind: "audio" | "video";
  rtpParameters: any;
}

export interface SfuConsumeData {
  roomId: string;
  transportId: string;
  producerId: string;
  rtpCapabilities: any;
}

export interface MediaControlData {
  roomId: string;
  enabled: boolean;
}

export interface ShareScreenData {
  roomId: string;
  isSharing: boolean;
}
