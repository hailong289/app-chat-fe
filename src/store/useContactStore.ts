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
      onlineUserIds: new Set<string>(),
      suggestions: [],
      friends: [],
      error: null,
      contact: null,
      page: 1,
      limit: 20,
      getAllContacts: async () => {
        // Defensive coalesce — `db.contacts.toArray()` can return
        // undefined transiently when the call-popup window mounts
        // before the per-user IndexedDB has been opened (proxy hits
        // an edge case during initial cold-start). Treat it as an
        // empty list instead of crashing on `.map`.
        const allContacts = (await db.contacts.toArray()) ?? [];
        // Reconcile with the live `onlineUserIds` Set BEFORE setting state.
        // `db.contacts` lags the in-memory state by up to a few hundred ms
        // because `socketHandleOnline` writes via a fire-and-forget
        // `upsertOne(...).catch(...)`. If we trust the db read literally,
        // any caller invoked right after a STATUS event arrives reads stale
        // `isOnline: false` and wipes the online dot ~2s after it appeared.
        // Source of truth is the Set — overlay it onto whatever the db says.
        const set_ = get().onlineUserIds;
        const safeSet =
          set_ instanceof Set ? set_ : new Set<string>();
        const reconciled = allContacts.map((c) =>
          safeSet.has(c.id) === c.isOnline
            ? c
            : { ...c, isOnline: safeSet.has(c.id) },
        );
        set({
          contacts: reconciled,
          online: reconciled
            .filter((c) => c.isOnline)
            .sort((a, b) => {
              const tier = (c: typeof a) =>
                c.chatPartner ? 0 : c.friendship === "ACCEPTED" ? 1 : 2;
              const ta = tier(a);
              const tb = tier(b);
              if (ta !== tb) return ta - tb;
              return (a.fullname || "").localeCompare(b.fullname || "");
            }),
        });
        get().syncEligibleContacts();
        return reconciled;
      },
      syncChatPartners: async () => {
        const myId = useAuthStore.getState().user?.id;
        if (!myId) return;
        const rooms = useRoomStore.getState().rooms;
        const seen = new Set<string>();
        type ContactType = import("./types/contact.type").ContactType;
        const records: ContactType[] = [];

        // Walk every member of every room and assemble an upsert batch. We
        // don't query db.contacts per-member (would be O(N) hits) — Dexie's
        // upsertMany handles "new vs existing" via primary key so spraying
        // the whole list is fine. We only set fields we know from the room
        // member shape; the rest stay as the existing values for known
        // contacts, or empty defaults for new ones.
        for (const room of rooms) {
          for (const m of (room.members ?? []) as any[]) {
            if (!m?.id || m.id === myId || seen.has(m.id)) continue;
            seen.add(m.id);
            records.push({
              _id: "",
              id: m.id,
              fullname: m.name ?? "",
              avatar: m.avatar ?? null,
              email: "",
              phone: null,
              updatedAt: "",
              createdAt: "",
              gender: null,
              status: "",
              dateOfBirth: null,
              friendship: "INVALID",
              actionUserId: null,
              isOnline: false,
              onlineAt: null,
              chatPartner: true,
            });
          }
        }
        if (records.length === 0) return;

        // Merge: don't clobber existing fields (friendship, isOnline) for
        // members already in db.contacts — only set chatPartner=true and
        // top up missing fields. Walk one-by-one so we can read existing.
        for (const r of records) {
          const existing = await getOne(db.contacts, r.id);
          if (existing) {
            if (existing.chatPartner === true) continue;
            existing.chatPartner = true;
            await upsertOne(db.contacts, existing);
          } else {
            await upsertOne(db.contacts, r);
          }
        }
        await get().getAllContacts();
        set({
          online: get()
            .contacts.filter((c) => c.isOnline)
            // Chat partners (people I've messaged with) first; then friends;
            // then everyone else. Within each tier, sort alphabetically so
            // the order is stable and predictable.
            .sort((a, b) => {
              const tier = (c: typeof a) =>
                c.chatPartner ? 0 : c.friendship === "ACCEPTED" ? 1 : 2;
              const ta = tier(a);
              const tb = tier(b);
              if (ta !== tb) return ta - tb;
              return (a.fullname || "").localeCompare(b.fullname || "");
            }),
        });
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
      fetchFriendSuggestions: async (limit = 10) => {
        try {
          const res: any = await ContactService.getFriendSuggestions(limit);
          const list = (res?.data?.metadata?.suggestions ??
            []) as import("./types/contact.type").FriendSuggestionType[];
          set({ suggestions: list });
          return list;
        } catch (err) {
          console.warn("[contacts] fetchFriendSuggestions failed:", err);
          return [];
        }
      },
      isUserOnline: (userId: string) => {
        // Coerce defensively in case the Set rehydrated as a plain object.
        const s = get().onlineUserIds;
        if (s instanceof Set) return s.has(userId);
        if (s && typeof s === "object" && Array.isArray((s as any).items)) {
          return (s as any).items.includes(userId);
        }
        return false;
      },
      socketHandleOnline: (data: {
        id: string;
        isOnline: boolean;
        onlineAt?: string | null;
      }) => {
        // Update the universal onlineUserIds Set first — this powers
        // online dots on conversations with people who aren't in the
        // contacts list. Create a new Set so zustand subscribers re-render.
        const prevSet = get().onlineUserIds;
        const safePrev = prevSet instanceof Set ? prevSet : new Set<string>();
        const had = safePrev.has(data.id);
        if (had !== data.isOnline) {
          const next = new Set(safePrev);
          if (data.isOnline) next.add(data.id);
          else next.delete(data.id);
          set({ onlineUserIds: next });
        }

        // Then sync the contact-specific record (if we have one). Update
        // the contacts array IN-PLACE — calling getAllContacts() (which
        // reloads from IndexedDB) before our pending upsertOne write has
        // landed creates a read-after-write race that surfaces in the UI
        // as the online dot flickering on every event. Mutate state
        // directly with a fresh array; persist to IndexedDB as a
        // fire-and-forget side effect.
        const contacts = get().contacts;
        const idx = contacts.findIndex((c) => c.id === data.id);
        if (idx === -1) return;
        const existing = contacts[idx];
        if (
          existing.isOnline === data.isOnline &&
          (existing.onlineAt ?? null) === (data.onlineAt ?? null)
        ) {
          return;
        }
        const updated = {
          ...existing,
          isOnline: data.isOnline,
          onlineAt: data.onlineAt ?? null,
        };
        const newContacts = contacts.slice();
        newContacts[idx] = updated;
        // Persist asynchronously; UI doesn't wait on this.
        upsertOne(db.contacts, updated).catch(() => {});
        set({
          contacts: newContacts,
          online: newContacts
            .filter((c) => c.isOnline)
            // Chat partners (people I've messaged with) first; then friends;
            // then everyone else. Within each tier, sort alphabetically so
            // the order is stable and predictable.
            .sort((a, b) => {
              const tier = (c: typeof a) =>
                c.chatPartner ? 0 : c.friendship === "ACCEPTED" ? 1 : 2;
              const ta = tier(a);
              const tb = tier(b);
              if (ta !== tb) return ta - tb;
              return (a.fullname || "").localeCompare(b.fullname || "");
            }),
        });
      },
      /**
       * Apply a bulk presence response from the BE (`status:online:bulk`).
       * Each entry has the same shape as a single STATUS event so we just
       * fan out to `socketHandleOnline`. Single source of truth — there's
       * no separate code path for "bulk" vs "single" updates.
       */
      socketHandleOnlineBulk: (
        users: Array<{
          id: string;
          isOnline: boolean;
          onlineAt?: string | null;
        }>,
      ) => {
        if (!Array.isArray(users)) return;
        users.forEach((u) =>
          get().socketHandleOnline({
            id: u.id,
            isOnline: u.isOnline,
            onlineAt: u.onlineAt ?? null,
          }),
        );
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
      name: "contact-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist pagination cursors. Everything else (contacts,
      // friends, online, onlineUserIds, suggestions, inviteds, sent,
      // searchResults) is live data driven by IndexedDB + socket events.
      // Persisting them caused a "flash of stale data" on every reload:
      // the rehydrated `online` array briefly rendered last session's
      // online users, then `getAllContacts` reconciled them away
      // (because `onlineUserIds` is empty until the bulk poll arrives),
      // leaving the list empty for ~1-2s until the poll response. Drop
      // them all and let the post-mount load + bulk poll fill state.
      partialize: (state) => ({ page: state.page, limit: state.limit }) as typeof state,
    },
  ),
);

export default useContactStore;
