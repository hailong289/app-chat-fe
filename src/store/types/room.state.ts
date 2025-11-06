import { QueryRooms } from "@/types/room.type";

export interface RoomsState {
  type: "group" | "private" | "channel" | "all";
  isLoading: boolean;
  rooms: roomType[];
  error: string | null;
  room: roomType | null;
  getRooms: (queryParams?: QueryRooms) => Promise<roomType[]>;
  clearRooms: () => void;
  setRooms: (rooms: roomType[]) => void;
  getRoomById: (id: string) => Promise<roomType | undefined>;
  getRoomsByType: (type: string) => Promise<roomType[]>;
  changeRoomName: (id: string, name: string) => Promise<void>;
  leavingRoom: () => Promise<boolean>;
  deleteMember: (memberId: string) => Promise<void>;
  changeNickName: (memberId: string, name: string) => Promise<void>;
  setType: (type: "group" | "private" | "channel" | "all") => void;
  updateAvatar: (link: string) => Promise<void>;
  createRoom: (
    type: "group" | "private" | "channel",
    name: string | undefined,
    memberIds: string[]
  ) => Promise<void>;
  addMember: (memberIds: string[]) => Promise<void>;
  updateRoomSocket: (room: roomType) => void;
}

export type roomType = {
  id: string; // Primary key - must not be null
  roomId: string;
  type: "group" | "private" | "channel";
  name: string | null;
  avatar: string | null;
  members: roomMembers[];
  updatedAt: string;
  last_message: {
    id: string | null;
    content: string | null;
    createdAt: string | null;
    sender_fullname: string | null;
    sender_id: string | null;
  };
  is_read: boolean;
  unread_count: number;
  pinned: boolean;
  muted: boolean;
};

export type roomMembers = {
  id: string;
  name: string | null;
  role: string | null;
  avatar: string | null;
};
