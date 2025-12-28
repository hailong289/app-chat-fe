import { GetMessageType } from "./../types/message.type";
import apiService from "./api.service";

export default class MessageService {
  static getMessages({ roomId, queryParams }: GetMessageType) {
    return apiService.get(`/chat/messages/${roomId}`, queryParams);
  }
}
