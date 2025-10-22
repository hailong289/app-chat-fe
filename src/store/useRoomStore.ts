import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";
import { RoomsState } from "./types/room.state";
import RoomService from "@/service/room.service";
import { QueryRooms } from "@/types/room.type";

const useRoomStore = create<RoomsState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      rooms: [],
      error: null,

      getRooms: async (queryParams?: QueryRooms) => {
        set({ isLoading: true, error: null });
        try {
          // RoomService.getRooms trả về axios response
          const response: any = await RoomService.getRooms(queryParams || {});

          // Axios response có structure: response.data
          // API của bạn có thể trả về: { data: {...}, success: true } hoặc trực tiếp data
          const rooms =
            response.data?.data?.rooms ||
            response.data?.rooms ||
            response.data ||
            [];

          console.log("✅ Fetched rooms:", rooms);

          set({
            rooms,
            isLoading: false,
            error: null,
          });

          return rooms;
        } catch (error: any) {
          console.error("❌ Error fetching rooms:", error);
          const errorMessage =
            error.response?.data?.message ||
            error.message ||
            "Failed to fetch rooms";

          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Clear rooms
      clearRooms: () => set({ rooms: [], error: null }),

      // Set rooms manually
      setRooms: (rooms) => set({ rooms }),
    }),
    {
      name: "room-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

export default useRoomStore;
