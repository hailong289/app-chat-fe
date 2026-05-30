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

    // Background prefetch: now that rooms are persisted to IDB, walk
    // them and warm the message cache for each. The user picks a chat
    // a moment later and the conversation paints instantly from
    // IndexedDB instead of waiting on `/api/chat/messages`. Skips
    // rooms with no `last_message` (genuinely empty rooms — no point
    // hitting the API to confirm "still empty"). Skips the currently
    // active room as well: the chat-switch effect already kicked off
    // its own `loadRoomFromCache` and we don't want a duplicate fetch.
    //
    // Fire-and-forget: don't block `getRooms()` resolution, the FE
    // sidebar should appear right after the first DB write. Errors
    // inside `warmRoomCaches` are swallowed silently — best-effort.
    const activeRoomId = get().room?.id;
    const targets = (rooms as Array<{ id?: string; last_message?: { id?: string | null } | null }>)
      .filter((r) => !!r.last_message?.id && !!r.id && r.id !== activeRoomId)
      .map((r) => r.id as string);
    if (targets.length > 0) {
      void useMessageStore
        .getState()
        .warmRoomCaches(targets, { limit: 20, concurrency: 3 });
    }

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
    // Defensive coalesce — same edge case as useContactStore: the
    // proxy can return undefined briefly during cold-start before
    // openDbForUser fires. Don't crash on .toSorted of undefined.
    let rooms;
    if (type == "all") {
      rooms = (await db.rooms.toArray()) ?? [];
    } else {
      rooms = (await db.rooms.where("type").equals(type).toArray()) ?? [];
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
    // Nếu id của data khớp với room hiện tại thì cập nhật luôn room
    const currentRoom = get().room;
    if (
      currentRoom &&
      (currentRoom.id === data.id ||
        currentRoom._id === data._id ||
        currentRoom.roomId === data.roomId ||
        currentRoom.id === data._id ||
        currentRoom._id === data.id ||
        currentRoom.roomId === data.id ||
        currentRoom.id === data.roomId)
    ) {
      set({ room: data });
    }
    const currentType = get().type;
    if (currentType === "all" || currentType === data.type) {
      set((state) => {
        const exists = state.rooms.some(
          (r) =>
            r.id === data.id ||
            r._id === data._id ||
            r.roomId === data.roomId ||
            r.id === data._id ||
            r._id === data.id
        );
        let rooms;
        if (exists) {
          // Nếu đã có thì update room trong state
          rooms = state.rooms.map((r) =>
            r.id === data.id ||
            r._id === data._id ||
            r.roomId === data.roomId ||
            r.id === data._id ||
            r._id === data.id
              ? { ...r, ...data }
              : r
          );
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
    // 1. Optimistically update Zustand store state immediately
    set((state) => {
      const updatedRooms = state.rooms.map((r) => {
        if (r.id === data.roomId || r._id === data.roomId || r.roomId === data.roomId) {
          return {
            ...r,
            last_read_id: data.lastMessageId,
            is_read: true,
            unread_count: 0,
          };
        }
        return r;
      });

      const updatedRoom =
        state.room &&
        (state.room.id === data.roomId ||
          state.room._id === data.roomId ||
          state.room.roomId === data.roomId)
          ? {
              ...state.room,
              last_read_id: data.lastMessageId,
              is_read: true,
              unread_count: 0,
            }
          : state.room;

      return {
        rooms: updatedRooms,
        room: updatedRoom,
      };
    });

    // 2. Perform IndexedDB write and await it to prevent race conditions
    try {
      await updateOne(db.rooms, data.roomId, {
        last_read_id: data.lastMessageId,
        is_read: true,
        unread_count: 0,
      });
    } catch (error) {
      console.error("❌ Error updating room read status in IndexedDB:", error);
    }

    // 3. Refresh rooms list from database
    await get().getRoomsByType(get().type);

    // Nếu là room hiện tại, refresh room detail
    if (data.roomId === get().room?.id) {
      get().getRoomById(data.roomId);
    }
  },
  applyMessageStatus: (evt) => {
    set((state) => {
      const rooms = state.rooms.map((r) => {
        if (
          r._id !== evt.roomId &&
          r.roomId !== evt.roomId &&
          r.id !== evt.roomId
        )
          return r;
        const members = (r.members ?? []).map((m) => {
          const mid = String(m.id ?? m.user_id ?? "");
          if (mid !== String(evt.userId)) return m;
          if (evt.kind === "read") {
            return {
              ...m,
              last_read_id: evt.upToMsgId,
              last_delivered_id: evt.upToMsgId,
            };
          }
          return { ...m, last_delivered_id: evt.upToMsgId };
        });
        return { ...r, members };
      });
      const room =
        state.room &&
        (state.room._id === evt.roomId ||
          state.room.roomId === evt.roomId ||
          state.room.id === evt.roomId)
          ? rooms.find(
              (r) =>
                r.id === state.room!.id ||
                r._id === state.room!._id ||
                r.roomId === state.room!.roomId
            ) ?? state.room
          : state.room;
      return { rooms, room };
    });

    // Persist status updates to IndexedDB to keep status ticks persistent across re-entry/refresh
    const targetRoom = get().room;
    const updatedRoom =
      get().rooms.find(
        (r) =>
          r.id === evt.roomId ||
          r._id === evt.roomId ||
          r.roomId === evt.roomId
      ) ||
      (targetRoom &&
      (targetRoom.id === evt.roomId ||
        targetRoom._id === evt.roomId ||
        targetRoom.roomId === evt.roomId)
        ? targetRoom
        : null);

    if (updatedRoom) {
      const dbRoomId = updatedRoom.id || updatedRoom._id || updatedRoom.roomId;
      if (dbRoomId) {
        updateOne(db.rooms, dbRoomId, { members: updatedRoom.members }).catch(
          (error) => {
            console.error("❌ Error updating room members status in IndexedDB:", error);
          }
        );
      }
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
  updatePinnedMessageFromSocket: (roomId: string, msg: { id: string; content: string; type?: string; pinned: boolean }) => {
    set((state) => {
      const targetRoom = state.rooms.find((r) => r.id === roomId || r.roomId === roomId);
      if (!targetRoom) return state;

      const pinnedMessages = targetRoom.pinned_messages || [];
      const exists = pinnedMessages.some((pm) => pm.id === msg.id);

      let updatedPinnedMessages: typeof pinnedMessages;
      if (msg.pinned && !exists) {
        updatedPinnedMessages = [...pinnedMessages, { id: msg.id, content: msg.content, type: msg.type || 'text' }];
      } else if (!msg.pinned && exists) {
        updatedPinnedMessages = pinnedMessages.filter((pm) => pm.id !== msg.id);
      } else {
        return state; // no change
      }

      const updatedRooms = state.rooms.map((r) =>
        r.id === targetRoom.id || r.roomId === roomId
          ? {
              ...r,
              pinned_messages: updatedPinnedMessages,
              pinned_count: updatedPinnedMessages.length,
            }
          : r,
      );

      const updatedRoom =
        state.room?.id === targetRoom.id
          ? { ...state.room, pinned_messages: updatedPinnedMessages, pinned_count: updatedPinnedMessages.length }
          : state.room;

      return { rooms: updatedRooms, room: updatedRoom };
    });
  },
  getRoomByRoomId: (roomId: string) => {
    const room = get().rooms.find((r) => r.id === roomId);
    return room;
  },
}));

export default useRoomStore;