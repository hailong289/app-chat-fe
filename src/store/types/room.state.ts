import { QueryRooms } from "@/types/room.type";
export type User = {
  id: string;
  name: string | null;
  avatar: string | null;
};
export interface RoomsState {
  type: "group" | "private" | "channel" | "all";
  isLoading: boolean;
  rooms: roomType[];
  error: string | null;
  room: roomType | null;
  roomTypingUsers: Record<string, User[]>;
  // last_message_id: string | null;
  getRooms: (queryParams?: QueryRooms) => Promise<roomType[]>;
  clearRooms: () => void;
  setRooms: (rooms: roomType[]) => void;
  getRoomById: (id: string) => Promise<roomType | undefined>;
  getRoomsByType: (type: string) => Promise<roomType[]>;
  changeRoomName: (id: string, name: string) => Promise<void>;
  leavingRoom: () => Promise<boolean>;
  clearHistory: (roomId?: string) => Promise<boolean>;
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
  setRoomReaded: (data: {
    lastMessageId: string;
    roomId: string;
  }) => Promise<void>;
  markMessageAsRead: (roomId: string, messageId: string, socket: any) => void;
  roomDeleteSocket: (data: { roomId: string }) => void;
  roomTypingSocket: (data: { isTyping: boolean; socket: any }) => void;
  handleTypingEvent: (data: {
    user: User;
    typing: boolean;
    roomId: string;
  }) => void;
  updateBlockStatus: (
    roomId: string,
    isBlocked: boolean,
    blockByMine: boolean
  ) => void;
  pinnedRoom: (roomId: string, pinned: boolean) => Promise<void>;
  mutedRoom: (roomId: string, muted: boolean) => Promise<void>;
  getRoomByRoomId: (roomId: string) => roomType | undefined;
}

export type roomType = {
  _id: string;
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
    sender: {
      id: string;
      name: string | null;
      avatar: string | null;
    };
    isMine: boolean;
  };
  is_read: boolean;
  unread_count: number;
  pinned: boolean;
  muted: boolean;
  last_read_id: string | null;
  pinned_messages: pinned_messagesType[];
  pinned_count: number;
  isBlocked: boolean;
  blockByMine: boolean;
  roomEvents: roomEventsType[];
};
export type roomEventsType = {
  timestamp: string;
  title: string;
  description: string;
  status: string;
  id: string;
};
export type pinned_messagesType = {
  id: string;
  content: string;
  type: string;
};

export type roomMembers = {
  id: string;
  name: string | null;
  role: "admin" | "member" | "owner" | "guest" | null;
  avatar: string | null;
};
