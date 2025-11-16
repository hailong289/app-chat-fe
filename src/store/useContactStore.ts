import { metadata } from "./../app/settings/layout";
import { create } from "zustand";
import { ContactState } from "./types/contact.type";
import { createJSONStorage, persist } from "zustand/middleware";
import ContactService from "@/service/contact.service";
import { getOne, upsertMany, upsertOne } from "@/libs/crud";
import { db } from "@/libs/db";
import { ppid } from "process";
import { on } from "events";

const useContactStore = create<ContactState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      contacts: [],
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
        return allContacts;
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
          console.log("🚀 ~ dataContacts:", dataContacts);
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
        console.log("🚀 ~ contact:", contact);
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
        console.log("🚀 ~ friends:", friendsMapped);
        await upsertMany(db.contacts, friendsMapped);
        set({ friends: friendsMapped, isLoading: false });
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
            response.data.metadata.page ?? payload?.page ?? get().page ?? 1
          );
          const limit = Number(
            response.data.metadata.limit ?? payload?.limit ?? get().limit ?? 20
          );
          const dataContacts = requests.map((contact: any) => ({
            ...contact,
            friendship: contact.friendship?.status || "INVALID",
            actionUserId: contact.friendship?.actionUserId || null,
            isOnline: false,
          }));
          console.log("🚀 ~ dataContacts:", dataContacts);
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
      socketHandleOnline: (data: {
        id: string;
        isOnline: boolean;
        onlineAt: string | null;
      }) => {
        const contact = get().contacts.find((c) => c.id === data.id);
        if (!contact) return;
        contact.isOnline = data.isOnline;
        contact.onlineAt = data.onlineAt;
        upsertOne(db.contacts, contact);
        get().getAllContacts();
        set({
          online: get().contacts.filter((c) => c.isOnline),
        });
      },
    }),
    {
      name: "contact-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

export default useContactStore;
