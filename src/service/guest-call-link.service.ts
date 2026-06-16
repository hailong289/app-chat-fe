import apiService from "./api.service";

export interface CreateGuestCallLinkPayload {
  roomId: string;
  callId: string;
  callType: "video" | "audio";
  callMode?: "p2p" | "sfu";
  ttlMinutes?: number;
}

export interface GuestCallLinkResponse {
  token: string;
  url: string;
  jti: string;
  expiresAt: string;
  roomId: string;
  callId: string;
  callType: "video" | "audio";
  callMode: "p2p" | "sfu";
}

export default class GuestCallLinkService {
  static createLink(body: CreateGuestCallLinkPayload) {
    return apiService.post<{ metadata?: GuestCallLinkResponse } & GuestCallLinkResponse>(
      "/chat/call/guest-link",
      body,
    );
  }

  static revokeLink(jti: string) {
    return apiService.post<{ ok: boolean; jti: string }>(
      "/chat/call/guest-link/revoke",
      { jti },
    );
  }

  static verifyToken(token: string) {
    return apiService.get<{
      valid: boolean;
      reason?: string;
      guestId?: string;
      roomId?: string;
      callId?: string;
      callType?: "video" | "audio";
      callMode?: "p2p" | "sfu";
      expiresAt?: string;
    }>("/chat/call/guest-link/verify", { token });
  }
}
