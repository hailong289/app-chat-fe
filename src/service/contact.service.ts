import { QueryContacts } from "@/types/contact.type";
import apiService from "./api.service";

export default class ContactService {
  static search(query: QueryContacts) {
    return apiService.get("/social/users/search", query);
  }
  static getFriends() {
    return apiService.get("/social/friends");
  }
}
