import { create } from "zustand";
import { RoomsState, roomType, User } from "./types/room.state";
import RoomService from "@/service/room.service";
import { QueryRooms } from "@/types/room.type";
import { db } from "@/libs/db";
import {
  deleteOne,
  getOne,
  updateOne,
  upsertMany,
  upsertOne,
} from "@/libs/crud";
import useMessageStore from "./useMessageStore";

const useRoomStore = create<RoomsState>()((set, get) => ({
  isLoading: false,
  rooms: [],
  error: null,
  room: null,
  type: "all",
  readedRooms: {},
  roomTypingUsers: {},
  // last_message_id: null,
  setType: (type: "group" | "private" | "channel" | "all") => set({ type }),

  getRooms: async (queryParams?: QueryRooms) => {
    set({ isLoading: true, error: null });

    // RoomService.getRooms trả về axios response
    const response: any = await RoomService.getRooms(queryParams || {});

    // Axios response có structure: response.data
    // API của bạn có thể trả về: { data: {...}, success: true } hoặc trực tiếp data
    const rooms = response.data.metadata || [];

    try {
      await upsertMany(db.rooms, rooms);
    } catch (error) {
      console.error("❌ Error saving rooms to IndexedDB:", error);
      // Continue anyway, data is already in state
    }

    // Sau khi lưu vào IndexedDB, load lại từ IndexedDB để đảm bảo state đồng bộ
    await get().getRoomsByType(get().type);

    set({
      isLoading: false,
      error: null,
    });

    return rooms;
  },

  // Clear rooms
  clearRooms: () => set({ rooms: [], error: null }),

  // Set rooms manually
  setRooms: (rooms) => set({ rooms }),
  // get room by id
  getRoomById: async (id: string) => {
    let room = get().rooms.find((r) => r.id === id);
    room ??= await getOne(db.rooms, id);
    set({ room });
    return room;
  },
  fetchAndUpdateRoom: async (roomId: string) => {
    console.log("🔄 [useRoomStore] fetchAndUpdateRoom called with:", roomId);
    try {
      const response: any = await RoomService.getRoomById(roomId);
      console.log("🔄 [useRoomStore] API Response:", response);
      if (response.data?.statusCode === 200 && response.data?.metadata) {
        get().updateRoomSocket(response.data.metadata);
      }
    } catch (e) {
      console.error("❌ [useRoomStore] Error fetching room:", e);
    }
  },
  getRoomsByType: async (type: string) => {
    let rooms;
    if (type == "all") {
      rooms = await db.rooms.toArray();
    } else {
      rooms = await db.rooms.where("type").equals(type).toArray();
    }
    const sortedRooms = rooms.toSorted((a, b) => {
      // Prioritize pinned rooms
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then sort by updatedAt
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    set({
      rooms: sortedRooms,
    });
    return sortedRooms;
  },
  // change room name
  changeRoomName: async (id: string, name: string) => {
    set({ isLoading: true });
    const body = {
      roomId: id,
      name: name,
    };
    await RoomService.changeRoomName(body);
    await updateOne(db.rooms, id, {
      name: name,
      updatedAt: new Date().toISOString(),
    });
    set({
      room: { ...get().room, name: name } as any,
    });
    get().getRoomsByType(get().type);
    set({ isLoading: false });
  },
  leavingRoom: async () => {
    const room = get().room;
    if (!room) return false;
    set({ isLoading: true });

    const body = {
      roomId: room.id || "",
    };
    const response: any = await RoomService.leaveRoom(body);
    if (response.data.statusCode != 200) {
      set({ isLoading: false, error: "Failed to leave room" });
      return false;
    }
    set({ isLoading: false, error: null });
    await deleteOne(db.rooms, room.id);
    const rooms = get().rooms.filter((r) => r.id !== room.id);
    get().getRoomsByType(get().type);
    set({
      room: rooms.length > 0 ? rooms[0] : null,
    });
    return true;
  },
  clearHistory: async (roomId?: string) => {
    const state = get();
    const targetRoomId = roomId ?? state.room?.id;
    if (!targetRoomId) return false;

    let room =
      roomId && roomId !== state.room?.id
        ? state.rooms.find((r) => r.id === targetRoomId)
        : state.room;

    if (!room) {
      room = await getOne(db.rooms, targetRoomId);
    }

    if (!room) return false;

    set({ isLoading: true, error: null });
    try {
      const response: any = await RoomService.clearHistory({
        roomId: targetRoomId,
      });
      if (response.data.statusCode !== 200) {
        throw new Error("Failed to clear history");
      }

      const messageStore = useMessageStore.getState();
      await messageStore.clearRoomMessages(targetRoomId);

      const updatedRoom = response.data.metadata ?? room;
      await upsertOne(db.rooms, updatedRoom);
      await get().getRoomsByType(state.type);

      set((current) => ({
        isLoading: false,
        error: null,
        room: current.room?.id === targetRoomId ? updatedRoom : current.room,
      }));
      return true;
    } catch (error) {
      console.error("❌ Error clearing chat history:", error);
      set({ isLoading: false, error: "Failed to clear chat history" });
      return false;
    }
  },
  deleteMember: async (memberId: string) => {
    set({ isLoading: true });
    try {
      const room = get().room;
      if (!room) throw new Error("No room selected");
      const updatedMembers = room.members.filter((mb) => mb.id !== memberId);
      const body = {
        roomId: room.id,
        memberIds: [memberId],
      };
      const response: any = await RoomService.deleteMembers(body);
      if (response.data.statusCode !== 200) {
        throw new Error("Failed to delete member from server");
      }
      await updateOne(db.rooms, room.id, {
        members: updatedMembers,
        updatedAt: new Date().toISOString(),
      });
      set({
        room: { ...room, members: updatedMembers },
      });
    } catch (error) {
      console.error("❌ Error deleting member:", error);
      set({ error: "Failed to delete member" });
    } finally {
      get().getRoomsByType(get().type);
      set({ isLoading: false });
    }
  },
  changeNickName: async (memberId: string, newName: string) => {
    set({ isLoading: true });
    const room = get().room;
    if (!room) return;
    room.updatedAt = new Date().toISOString();
    room.members = room.members.map((member) =>
      member.id === memberId ? { ...member, name: newName } : member,
    );
    if (room.type === "private" && room.id == memberId) {
      room.name = newName;
    }

    // Call API to update nickname
    const body = {
      roomId: room.id,
      memberId: memberId,
      name: newName,
    };

    const result: any = await RoomService.changeNickName(body);
    if (result.data.statusCode !== 200) {
      set({ isLoading: false, error: "Failed to change nickname" });
      return;
    }

    await updateOne(db.rooms, room.id, { ...room });
    set({
      room: { ...room },
      isLoading: false,
    });
    await get().getRoomsByType(get().type);
  },
  updateAvatar: async (link: string) => {
    set({ isLoading: true });
    const room = get().room;
    if (!room) return;
    room.updatedAt = new Date().toISOString();
    room.avatar = link;

    // Call API to update avatar
    const body = {
      roomId: room.id,
      link: link,
    };
    const result: any = await RoomService.changeAvatar(body);
    if (result.data.statusCode !== 200) {
      set({ isLoading: false, error: "Failed to change avatar" });
      return;
    }
    await updateOne(db.rooms, room.id, { ...room });
    set({
      room: { ...room },
      isLoading: false,
    });
    await get().getRoomsByType(get().type);
  },
  createRoom: async (
    type: "group" | "private" | "channel",
    name: string | undefined,
    memberIds: string[],
  ) => {
    set({ isLoading: true });
    const body = {
      type,
      name,
      memberIds,
    };
    const result: any = await RoomService.createRoom(body);
    if (result.data.statusCode !== 200) {
      set({ isLoading: false, error: "Failed to create room" });
      return;
    }
    await upsertOne(db.rooms, result.data.metadata);
    await get().getRoomsByType(get().type);
    set({ isLoading: false, room: result.data.metadata });
  },
  addMember: async (memberIds: string[]) => {
    set({ isLoading: true });
    const room = get().room;
    if (!room) return;
    // Call API to add members
    const body = {
      roomId: room.id,
      memberIds: memberIds,
    };
    const result: any = await RoomService.addMembers(body);
    if (result.data.statusCode !== 200) {
      set({ isLoading: false, error: "Failed to add members" });
      return;
    }
    await updateOne(db.rooms, room.id, { ...room });
    await get().getRoomsByType(get().type);
    set({ isLoading: false });
  },
  // handel socket
  updateRoomSocket: (data: roomType) => {
    // Nếu id của data bằng id của room hiện tại thì cập nhật luôn room
    if (get().room?.id === data.id) {
      set({ room: data });
    }
    const currentType = get().type;
    if (currentType === "all" || currentType === data.type) {
      set((state) => {
        const exists = state.rooms.some((r) => r.id === data.id);
        let rooms;
        if (exists) {
          // Nếu đã có thì update room trong state
          rooms = state.rooms.map((r) => (r.id === data.id ? data : r));
        } else {
          // Nếu chưa có thì thêm mới vào state
          rooms = [data, ...state.rooms];
        }
        return {
          ...state,
          rooms: rooms.toSorted((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          }),
        };
      });
    }
    // Luôn update vào IndexedDB và refresh lại state từ db
    upsertOne(db.rooms, data)
      .then(() => {
        get().getRoomsByType(currentType);
      })
      .catch((error) => {
        console.error("❌ Error updating room from socket (IndexedDB):", error);
        get().getRoomsByType(currentType);
      });
  },

  setRoomReaded: async (data: { lastMessageId: string; roomId: string }) => {
    try {
      // Cập nhật trong IndexedDB
      await updateOne(db.rooms, data.roomId, {
        last_read_id: data.lastMessageId,
        is_read: true,
        unread_count: 0,
      });
    } catch (error) {
      console.error("❌ Error updating room read status in IndexedDB:", error);
    }

    // Refresh state
    get().getRoomsByType(get().type);

    // Nếu là room hiện tại, refresh room detail
    if (data.roomId === get().room?.id) {
      get().getRoomById(data.roomId);
    }
  },
  markMessageAsRead: (roomId: string, messageId: string, socket: any) => {
    // Emit socket event
    socket?.emit("mark:read", {
      roomId,
      lastMessageId: messageId,
    });

    // Cập nhật local state và IndexedDB
    get().setRoomReaded({
      lastMessageId: messageId,
      roomId: roomId,
    });
  },
  roomDeleteSocket: (data: { roomId: string }) => {
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== data.roomId),
      room: state.room?.id === data.roomId ? null : state.room,
    }));
    // Delete room from IndexedDB
    deleteOne(db.rooms, data.roomId).catch(() => {});
    // Delete room messages from IndexedDB
    if (db.messages?.where && typeof db.messages.where === "function") {
      db.messages
        .where("roomId")
        .equals(data.roomId)
        .delete()
        .catch(() => {});
    }
  },
  roomTypingSocket: (data: { isTyping: boolean; socket: any }) => {
    const roomId = get().room?.roomId;
    if (!roomId) return;
    data.socket.emit("user:typing", {
      roomId,
      typing: data.isTyping,
    });
  },
  handleTypingEvent: ({
    user,
    typing,
    roomId,
  }: {
    user: User;
    typing: boolean;
    roomId: string;
  }) => {
    const currentTypingUsers = get().roomTypingUsers[roomId] || [];

    let updatedTypingUsers: User[];
    if (typing) {
      // Thêm user vào danh sách nếu chưa có
      if (currentTypingUsers.some((u) => u.id === user.id)) {
        updatedTypingUsers = currentTypingUsers;
      } else {
        updatedTypingUsers = [...currentTypingUsers, user];
      }
    } else {
      // Xóa user khỏi danh sách nếu có
      updatedTypingUsers = currentTypingUsers.filter((u) => u.id !== user.id);
    }
    set((state) => ({
      roomTypingUsers: {
        ...state.roomTypingUsers,
        [roomId]: updatedTypingUsers,
      },
    }));
  },
  updateBlockStatus: (
    roomId: string,
    isBlocked: boolean,
    blockByMine: boolean,
  ) => {
    set((state) => {
      const updatedRooms = state.rooms.map((r) => {
        if (r.id === roomId) {
          return { ...r, isBlocked, blockByMine };
        }
        return r;
      });

      let updatedRoom = state.room;
      if (state.room?.id === roomId) {
        updatedRoom = { ...state.room, isBlocked, blockByMine };
      }

      // Update IndexedDB
      getOne(db.rooms, roomId).then((room) => {
        if (room) {
          room.isBlocked = isBlocked;
          room.blockByMine = blockByMine;
          upsertOne(db.rooms, room);
        }
      });

      return { rooms: updatedRooms, room: updatedRoom };
    });
  },
  pinnedRoom: async (roomId: string, pinned: boolean) => {
    set({ isLoading: true });
    const body = { roomId, pinned };
    const result: any = await RoomService.pinnedRoom(body);
    if (result.data.statusCode !== 200) {
      set({ isLoading: false, error: "Failed to pin room" });
      return;
    }

    set((state) => {
      const updatedRooms = state.rooms.map((r) => {
        if (r.id === roomId) {
          return { ...r, pinned };
        }
        return r;
      });
      let updatedRoom = state.room;
      if (state.room?.id === roomId) {
        updatedRoom = { ...state.room, pinned };
      }

      // Update IndexedDB
      getOne(db.rooms, roomId).then((room) => {
        if (room) {
          room.pinned = pinned;
          upsertOne(db.rooms, room);
        }
      });

      return { rooms: updatedRooms, room: updatedRoom, isLoading: false };
    });
  },
  mutedRoom: async (roomId: string, muted: boolean) => {
    set({ isLoading: true });
    const body = { roomId, muted };
    const result: any = await RoomService.mutedRoom(body);
    if (result.data.statusCode !== 200) {
      set({ isLoading: false, error: "Failed to mute room" });
      return;
    }

    set((state) => {
      const updatedRooms = state.rooms.map((r) => {
        if (r.id === roomId) {
          return { ...r, muted };
        }
        return r;
      });
      let updatedRoom = state.room;
      if (state.room?.id === roomId) {
        updatedRoom = { ...state.room, muted };
      }

      // Update IndexedDB
      getOne(db.rooms, roomId).then((room) => {
        if (room) {
          room.muted = muted;
          upsertOne(db.rooms, room);
        }
      });

      return { rooms: updatedRooms, room: updatedRoom, isLoading: false };
    });
  },
  getRoomByRoomId: (roomId: string) => {
    const room = get().rooms.find((r) => r.id === roomId);
    return room;
  },
}));

export default useRoomStore;
