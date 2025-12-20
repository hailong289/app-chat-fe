import { QueryContacts } from "@/types/contact.type";
import apiService from "./api.service";

export default class ContactService {
  static search(query: QueryContacts) {
    return apiService.get("/social/users/search", query);
  }
  static getFriends() {
    return apiService.get("/social/users/friends");
  }
  static sendInvitation(userId: string) {
    return apiService.post("/social/friend-requests", {
      receiverId: userId,
    });
  }
  static friendRequessts({
    page,
    limit,
    type,
  }: {
    page?: number;
    limit?: number;
    type?: "sent" | "received";
  }) {
    return apiService.get("/social/friend-requests", { page, limit, type });
  }
  static acceptInvaitation(requestId: string) {
    return apiService.patch(`/social/friend-requests/${requestId}/accept`);
  }
  static rejectInvaitation(requestId: string) {
    return apiService.patch(`/social/friend-requests/${requestId}/reject`);
  }
  static getListFrineds() {
    return apiService.get("/social/users/friends");
  }
  static blockFriend(userId: string) {
    return apiService.patch(`/social/friends/${userId}/block`);
  }
  static unBlockFriend(userId: string) {
    return apiService.patch(`/social/friends/${userId}/open-blocked`);
  }
}
