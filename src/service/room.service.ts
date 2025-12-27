import { QueryRooms } from "@/types/room.type";
import apiService from "./api.service";
export default class RoomService {
  static getRooms(queryParams: QueryRooms) {
    return apiService.get("/chat/rooms", queryParams);
  }
  static changeRoomName(body: { roomId: string; name: string }) {
    return apiService.patch("/chat/rooms/name", body);
  }
  static leaveRoom(body: { roomId: string }) {
    return apiService.patch("/chat/rooms/leaving", body);
  }
  static deleteMembers(body: { roomId: string; memberIds: string[] }) {
    return apiService.patch("/chat/rooms/members/remove", body);
  }

  static changeNickName(body: {
    roomId: string;
    memberId: string;
    name: string;
  }) {
    return apiService.patch("/chat/rooms/nick-name", body);
  }
  static changeAvatar(body: { roomId: string; link: string }) {
    return apiService.patch("/chat/rooms/avatar", body);
  }
  static changeRole(body: { roomId: string; memberId: string; role: string }) {
    return apiService.patch("/chat/rooms/role", body);
  }
  static addMembers(body: { roomId: string; memberIds: string[] }) {
    return apiService.patch("/chat/rooms/add", body);
  }

  static createRoom(body: {
    type: "group" | "private" | "channel";
    name?: string;
    memberIds: string[];
  }) {
    return apiService.post("/chat/rooms", body);
  }
  static pinnedRoom(body: { roomId: string; pinned: boolean }) {
    return apiService.patch("/chat/rooms/pinned", body);
  }
  static mutedRoom(body: { roomId: string; muted: boolean }) {
    return apiService.patch("/chat/rooms/muted", body);
  }

  static clearHistory(body: { roomId: string }) {
    return apiService.patch("/chat/rooms/deleted", body);
  }

  // static
}
