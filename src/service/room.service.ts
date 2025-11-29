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
  static addMembers(body: { roomId: string; memberIds: string[] }) {
    console.log("🚀 ~ RoomService ~ addMembers ~ body:", body);
    return apiService.patch("/chat/rooms/add", body);
  }

  static createRoom(body: {
    type: "group" | "private" | "channel";
    name?: string;
    memberIds: string[];
  }) {
    return apiService.post("/chat/rooms", body);
  }
}
