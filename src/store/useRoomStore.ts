import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";
import { RoomsState, roomType } from "./types/room.state";
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
const useRoomStore = create<RoomsState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      rooms: [],
      error: null,
      room: null,
      type: "all",
      setType: (type: "group" | "private" | "channel" | "all") => set({ type }),

      getRooms: async (queryParams?: QueryRooms) => {
        set({ isLoading: true, error: null });

        // RoomService.getRooms trả về axios response
        const response: any = await RoomService.getRooms(queryParams || {});

        // Axios response có structure: response.data
        // API của bạn có thể trả về: { data: {...}, success: true } hoặc trực tiếp data
        const rooms = response.data.metadata || [];

        console.log("✅ Fetched rooms:", rooms);

        await upsertMany(db.rooms, rooms);
        set({
          rooms,
          isLoading: false,
          error: null,
        });
        // await get().getRoomsByType(queryParams?.type || "");

        set({
          isLoading: false,
        });
        return rooms;
      },

      // Clear rooms
      clearRooms: () => set({ rooms: [], error: null }),

      // Set rooms manually
      setRooms: (rooms) => set({ rooms }),
      // get room by id
      getRoomById: async (id: string) => {
        const room = await getOne(db.rooms, id);
        set({ room });
        return room;
      },
      getRoomsByType: async (type: string) => {
        let rooms;
        if (type == "all") {
          console.log("🚀 ~ type:", type);
          rooms = await db.rooms.toArray();
        } else {
          rooms = await db.rooms.where("type").equals(type).toArray();
        }
        set({
          rooms: rooms.toSorted(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          ),
        });
        return rooms;
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
        console.log("🚀 ~ response:", response.data.statusCode == 200);
        if (response.data.statusCode != 200) {
          set({ isLoading: false, error: "Failed to leave room" });
          return false;
        }
        set({ isLoading: false, error: null });
        await deleteOne(db.rooms, room.id);
        const rooms = get().rooms.filter((r) => r.id !== room.id);
        get().getRoomsByType(get().type);
        console.log("🚀 ~ rooms:", rooms);
        set({
          room: rooms.length > 0 ? rooms[0] : null,
        });
        return true;
      },
      deleteMember: async (memberId: string) => {
        set({ isLoading: true });
        try {
          const room = get().room;
          if (!room) throw new Error("No room selected");
          const updatedMembers = room.members.filter(
            (mb) => mb.id !== memberId
          );
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
          member.id === memberId ? { ...member, name: newName } : member
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
        console.log("🚀 ~ result:", result);
        if (result.data.statusCode !== 200) {
          set({ isLoading: false, error: "Failed to change nickname" });
          return;
        }

        console.log("🚀 ~ room:", room);
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
        console.log("🚀 ~ result:", result);
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
        memberIds: string[]
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
        upsertOne(db.rooms, data);
        get().getRoomsByType(get().type);
      },
    }),

    {
      name: "room-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

export default useRoomStore;
