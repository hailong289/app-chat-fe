import { metadata } from "./../app/settings/layout";
import { create } from "zustand";
import { ContactState } from "./types/contact.type";
import { createJSONStorage, persist } from "zustand/middleware";
import ContactService from "@/service/contact.service";
import { getOne, upsertMany } from "@/libs/crud";
import { db } from "@/libs/db";

const useContactStore = create<ContactState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      contacts: [],
      searchResults: [],
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
          console.log("🚀 ~ contacts:", contacts);
          await upsertMany(db.contacts, contacts);
          set({ searchResults: contacts, isLoading: false });
        } catch (error: any) {
          set({
            error: error?.message || "An error occurred",
            isLoading: false,
          });
        }
      },
      setContact: async (id: string) => {
        set({ isLoading: true, error: null });
        const contact = get().contacts.find((c) => c.id === id);
        console.log("🚀 ~ contact:", contact);
        set({ contact, isLoading: false });
      },
      getFriends: async () => {
        set({ isLoading: true, error: null });
        const response: any = await ContactService.getFriends();
        const friends = response.data.metadata.friends || [];
        console.log("🚀 ~ friends:", friends);
        await upsertMany(db.contacts, friends);
        set({ contacts: friends, isLoading: false });
        return friends;
      },
    }),
    {
      name: "contact-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

export default useContactStore;
