import { metadata } from "./../app/settings/layout";
import { create } from "zustand";
import useAuthStore from "./useAuthStore";
import { ContactState } from "./types/contact.type";
import { createJSONStorage, persist } from "zustand/middleware";
import ContactService from "@/service/contact.service";
import { getOne, upsertMany, upsertOne } from "@/libs/crud";
import { db } from "@/libs/db";
import { socketEvent } from "@/types/socketEvent.type";
import useRoomStore from "./useRoomStore";

const useContactStore = create<ContactState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      contacts: [],
      eligibleContacts: [],
      searchResults: [],
      inviteds: [],
      sent: [],
      online: [],
      friends: [],
      error: null,
      contact: null,
      page: 1,
      limit: 20,
      getAllContacts: async () => {
        const allContacts = await db.contacts.toArray();
        set({ contacts: allContacts });
        get().syncEligibleContacts();
        return allContacts;
      },
      syncEligibleContacts: () => {
        const friends = get().friends;
        const rooms = useRoomStore.getState().rooms;
        const myId = useAuthStore.getState().user?.id;

        const eligibleMap = new Map<string, any>();

        // 1. Thêm bạn bè vào
        friends.forEach((f) => {
          eligibleMap.set(f.id, {
            id: f.id,
            fullname: f.fullname,
            avatar: f.avatar,
            friendship: f.friendship,
          });
        });

        // 2. Thêm những người trong các phòng chat (partners)
        rooms.forEach((room) => {
          room.members?.forEach((m) => {
            if (m.id !== myId && !eligibleMap.has(m.id)) {
              eligibleMap.set(m.id, {
                id: m.id,
                fullname: m.name,
                avatar: m.avatar,
                friendship: "INVALID", // Hoặc một flag nào đó chỉ ra chưa là bạn
              });
            }
          });
        });

        const result = Array.from(eligibleMap.values()).sort((a, b) =>
          a.fullname.localeCompare(b.fullname),
        );
        set({ eligibleContacts: result });
      },
      search: async (search: string) => {
        set({ isLoading: true, error: null });
        try {
          // Call ContactService.search to get contacts
          const query = {
            search,
            page: get().page,
            limit: get().limit,
          };
          const response: any = await ContactService.search(query);
          const contacts = response.data.metadata.users || [];
          const dataContacts = contacts.map((contact: any) => ({
            ...contact,
            friendship: "INVALID",
            isOnline: false,
          }));
          await upsertMany(db.contacts, dataContacts);
          set({ searchResults: dataContacts, isLoading: false });
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
        }
      },
      setContact: async (id: string) => {
        set({ isLoading: true, error: null });
        const contact = await getOne(db.contacts, id);
        set({ contact, isLoading: false });
      },
      getFriends: async () => {
        set({ isLoading: true, error: null });
        const response: any = await ContactService.getFriends();
        const friends = response.data.metadata.friends || [];
        const friendsMapped = friends.map((contact: any) => ({
          ...contact,
          friendship: contact.friendship?.status || "INVALID",
          actionUserId: contact.friendship?.actionUserId || null,
          isOnline: false,
        }));
        await upsertMany(db.contacts, friendsMapped);
        set({ friends: friendsMapped, isLoading: false });
        get().syncEligibleContacts();
        return friendsMapped;
      },
      sendInvitation: async ({
        userId,
        receiverId,
      }: {
        userId: string;
        receiverId: string;
      }) => {
        set({ isLoading: true, error: null });
        try {
          await ContactService.sendInvitation(receiverId);
          set({ isLoading: false });
          const contact = get().contacts.find((c) => c.id === receiverId);
          if (!contact) return;
          contact.friendship = "PENDING";
          contact.actionUserId = userId;
          await upsertOne(db.contacts, contact);
          await get().getAllContacts();
          set({ contact });
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
        }
      },
      friendRequessts: async (payload: {
        page?: number;
        limit?: number;
        type?: "sent" | "received";
      }) => {
        set({ isLoading: true, error: null });

        try {
          const response: any = await ContactService.friendRequessts(payload);
          const requests = response.data.metadata.friendRequests || [];
          const total = Number(response.data.metadata.total || 0);
          const page = Number(
            response.data.metadata.page ?? payload?.page ?? get().page ?? 1,
          );
          const limit = Number(
            response.data.metadata.limit ?? payload?.limit ?? get().limit ?? 20,
          );
          const dataContacts = requests.map((contact: any) => ({
            ...contact,
            friendship: contact.friendship?.status || "INVALID",
            actionUserId: contact.friendship?.actionUserId || null,
            isOnline: false,
          }));
          if (payload?.type === "sent") {
            set({ sent: dataContacts });
          } else {
            set({ inviteds: dataContacts });
          }
          await upsertMany(db.contacts, dataContacts);
          set({ isLoading: false });
          return { total, page, limit };
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
          // ensure we return the expected shape with numeric values
          const page = payload?.page ?? get().page ?? 1;
          const limit = payload?.limit ?? get().limit ?? 20;
          return { total: 0, page, limit };
        }
      },
      acceptInvitation: async (requestId: string) => {
        set({ isLoading: true, error: null });
        try {
          await ContactService.acceptInvaitation(requestId);
          const contact = await getOne(db.contacts, requestId);
          if (contact) {
            contact.friendship = "ACCEPTED";

            await upsertOne(db.contacts, contact);
            await get().getAllContacts();

            set({
              contact,
              inviteds: get().inviteds.filter((c) => c.id !== requestId),
            });
          }
          set({ isLoading: false });
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
        }
      },
      rejectInvitation: async (requestId: string) => {
        set({ isLoading: true, error: null });
        try {
          await ContactService.rejectInvaitation(requestId);
          const contact = await getOne(db.contacts, requestId);
          if (contact) {
            contact.friendship = "REJECTED";
            await upsertOne(db.contacts, contact);
            await get().getAllContacts();
            set({
              contact,
              inviteds: get().inviteds.filter((c) => c.id !== requestId),
              sent: get().sent.filter((c) => c.id !== requestId),
            });
          }
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
        }
      },
      BlockUser: async (requestId: string) => {
        set({ isLoading: true, error: null });
        try {
          await ContactService.blockFriend(requestId);
          const contact = await getOne(db.contacts, requestId);
          const room = await getOne(db.rooms, requestId);
          if (contact) {
            contact.friendship = "BLOCKED";
            await upsertOne(db.contacts, contact);
            await get().getAllContacts();
            set({
              contact,
              inviteds: get().inviteds.filter((c) => c.id !== requestId),
              sent: get().sent.filter((c) => c.id !== requestId),
            });
          }
          if (room) {
            room.isBlocked = true;
            room.blockByMine = true;
            await upsertOne(db.rooms, room);
          }
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
        }
      },
      UnlockBlockedUser: async (requestId: string) => {
        set({ isLoading: true, error: null });
        try {
          await ContactService.unBlockFriend(requestId);
          const contact = await getOne(db.contacts, requestId);
          const room = await getOne(db.rooms, requestId);
          if (contact) {
            contact.friendship = "INVALID";
            await upsertOne(db.contacts, contact);
            await get().getAllContacts();
            set({
              contact,
              inviteds: get().inviteds.filter((c) => c.id !== requestId),
              sent: get().sent.filter((c) => c.id !== requestId),
            });
          }
          if (room) {
            room.isBlocked = false;
            room.blockByMine = false;
            await upsertOne(db.rooms, room);
          }
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
        }
      },
      socketHandleOnline: (data: {
        id: string;
        isOnline: boolean;
        onlineAt?: string | null;
      }) => {
        const contact = get().contacts.find((c) => c.id === data.id);
        if (!contact) return;
        contact.isOnline = data.isOnline;
        contact.onlineAt = data.onlineAt ?? null;
        upsertOne(db.contacts, contact);
        get().getAllContacts();
        set({
          online: get().contacts.filter((c) => c.isOnline),
        });
      },
      checkOnlineStatus: (socket: any) => {
        // Filter: Only friends or people I've chatted with (in active rooms)
        const contacts = get().contacts;
        const friendIds = contacts
          .filter((c) => c.friendship === "ACCEPTED")
          .map((c) => c.id);

        // We can also get members from useRoomStore if needed, but let's start with friends
        // + anyone we have an existing open chat/room with (optional, but good for "recent chats")

        // Use a Set to avoid duplicates
        const idsToCheck = new Set(friendIds);

        // Add members from active rooms (recent chats)
        const rooms = useRoomStore.getState().rooms;
        rooms.forEach((room) => {
          // For private rooms, the other user ID is usually the room name or in members
          // Depending on how room.members is structured.
          // Assuming room.members is an array of objects with id.
          if (room.members) {
            // Check if members exist
            // ... inside checkOnlineStatus
            room.members.forEach((m: any) => {
              // Type as any for now or roomMemberType
              const myId = useAuthStore.getState().user?.id;
              if (m.id !== myId) {
                // Exclude self
                idsToCheck.add(m.id);
              }
            });
          }
        });

        // Convert back to array
        const ids = Array.from(idsToCheck);

        if (ids.length > 0) {
          socket.emit(socketEvent.USERSATUS, ids);
        }
      },
    }),
    {
      name: "contact-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    },
  ),
);

export default useContactStore;
