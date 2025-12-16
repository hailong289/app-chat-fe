import { GetMessageType } from "./../types/message.type";
import apiService from "./api.service";

export default class MessageService {
  static getMessages({ roomId, queryParams }: GetMessageType) {
    return apiService.get(`/chat/messages/${roomId}`, queryParams);
  }

  static getDocuments({
    roomId,
    page = 1,
    limit = 20,
    type,
  }: {
    roomId: string;
    page?: number;
    limit?: number;
    type?: string;
  }) {
    return apiService.get(`/chat/documents/${roomId}`, { page, limit, type });
  }
}
