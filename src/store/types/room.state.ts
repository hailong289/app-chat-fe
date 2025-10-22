import { QueryRooms } from "@/types/room.type";

export interface RoomsState {
  isLoading: boolean;
  rooms: room[];
  error: string | null;
  getRooms: (queryParams?: QueryRooms) => Promise<room[]>;
  clearRooms: () => void;
  setRooms: (rooms: room[]) => void;
}

export type room = {
  id: string;
  roomId: string;
  type: "group" | "private" | "channel";
  name: string;
  avatar: string;
  members: roomMembers[];
};

export type roomMembers = {
  id: string;
  name: string;
  role: string;
  avatar: string;
};
