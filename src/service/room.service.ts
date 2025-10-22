import { QueryRooms } from "@/types/room.type";
import apiService from "./api.service";
export default class RoomService {
  static getRooms(queryParams: QueryRooms) {
    return apiService.get("/chat/rooms", { params: queryParams });
  }
}
