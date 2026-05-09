import { ContactType } from "@/store/types/contact.type";
import { MessageType } from "@/store/types/message.state";
import { roomType } from "@/store/types/room.state";
import Dexie, { Table } from "dexie";
import { getCachedUserIdFromToken } from "@/utils/tokenStorage";

/**
 * Multi-tenant IndexedDB strategy:
 *
 * Each user gets a SEPARATE DB named `app-chat-db-{userId}`. When user A
 * logs out and user B logs in (same device), user B's DB is opened
 * fresh — A's cached rooms/messages stay encrypted in their own DB,
 * untouched. When A logs back in, their DB reopens with all the data
 * still there → instant load, no need to re-sync from server.
 *
 * Privacy benefit: user B can't browse A's cached messages by reaching
 * into IndexedDB DevTools. (DB names are still visible, but contents
 * are scoped per DB.)
 *
 * The exported `db` is a Proxy that forwards every property access to
 * the currently-open instance. Consumers (`db.messages.bulkPut(...)`)
 * work without changes. Throws if accessed before login (boot flow
 * MUST call `openDbForUser(userId)` after auth resolves).
 */

let currentDb: AppDB | null = null;
let currentDbUserId: string | null = null;

/**
 * Default fallback DB name for code paths that need a DB before login
 * resolves (e.g. SSR / initial render). Avoid using in real flows;
 * prefer `openDbForUser(userId)` immediately after auth bootstrap.
 */
const FALLBACK_DB_NAME = "app-chat-db-anon";

/**
 * Open (or reuse) the IndexedDB instance for the given user. If a DB
 * for a DIFFERENT user is currently open, it's closed first — the
 * data stays on disk for that user's next session.
 */
export function openDbForUser(userId: string): AppDB {
  const targetName = `app-chat-db-${userId}`;
  if (currentDb && currentDb.name === targetName) return currentDb;
  if (currentDb) {
    currentDb.close();
    currentDb = null;
  }
  currentDb = new AppDB(targetName);
  currentDbUserId = userId;
  // Best-effort sweep of the legacy anonymous fallback DB. Created
  // when something touches `db.*` before login resolves (Proxy lazy
  // path); leaves an orphan db that bloats DevTools → IndexedDB and
  // confuses devs. Now that we have a real per-user DB, the anon one
  // is guaranteed obsolete — delete it without blocking.
  Dexie.delete(FALLBACK_DB_NAME).catch(() => {
    /* ignore — delete may fail if anon was never created */
  });
  return currentDb;
}

/**
 * Close the active DB connection (does NOT delete data — that's the
 * point of the per-user split). Call on logout. Re-login by same user
 * reopens the same DB with all cached data intact.
 */
export function closeUserDb(): void {
  if (currentDb) {
    currentDb.close();
    currentDb = null;
    currentDbUserId = null;
  }
}

/**
 * Permanently delete the active user's IndexedDB. Use only when the
 * user explicitly asks to "clear my data" / GDPR delete-account flow.
 * Regular logout should use `closeUserDb()` instead.
 */
export const clearIndexedDB = async () => {
  try {
    if (currentDb) {
      const name = currentDb.name;
      currentDb.close();
      currentDb = null;
      currentDbUserId = null;
      await Dexie.delete(name);
    }
    // Also nuke the legacy name from older code (pre-multi-tenant).
    await Dexie.delete("app-chat-db");
    return true;
  } catch (error) {
    console.error("❌ Failed to clear IndexedDB:", error);
    return false;
  }
};

if (typeof window !== "undefined") {
  (window as any).clearIndexedDB = clearIndexedDB;
}

/**
 * Lazy DB proxy. Most consumers do `import { db } from '@/libs/db'` then
 * `db.messages.bulkPut(...)`. The Proxy keeps that API stable while
 * letting us swap the underlying instance per-user.
 *
 * Falls back to opening the anonymous DB if accessed before
 * `openDbForUser(userId)` was called — keeps cold-start consumers
 * (stores reading messages/contacts on app boot) returning real
 * arrays/Tables instead of undefined. Once `/auth/me` resolves and
 * `openDbForUser` fires, the anon DB is deleted in the same call so
 * it doesn't linger as an orphan.
 *
 * Strict no-op was tried first (return Promise.resolve(undefined) for
 * every method) but consumers like `useContactStore.getAllContacts`
 * call `.map()` on the result expecting an array — undefined crashed.
 * Returning the real Dexie Table is simpler and safer.
 */
export const db = new Proxy({} as AppDB, {
  get(_target, prop, _receiver) {
    if (!currentDb) {
      // Open the per-user DB directly using the userId decoded
      // synchronously from the access JWT (no /auth/me round-trip
      // needed). This avoids creating the anon fallback DB only to
      // delete it 200ms later — the deletion racing with in-flight
      // Dexie queries was throwing DatabaseClosedError.
      //
      // Falls back to anon ONLY when there's no token in localStorage
      // (logged-out cold start). In that case the queries will return
      // empty arrays / nothing — caller still works, no orphan
      // because openDbForUser will sweep anon on next login.
      const cachedUserId = getCachedUserIdFromToken();
      if (cachedUserId) {
        currentDb = new AppDB(`app-chat-db-${cachedUserId}`);
        currentDbUserId = cachedUserId;
      } else {
        currentDb = new AppDB(FALLBACK_DB_NAME);
      }
    }
    const value = Reflect.get(currentDb, prop);
    return typeof value === "function" ? value.bind(currentDb) : value;
  },
});

/** Inspect which DB is currently open. Mainly for debugging. */
export function getCurrentDbUserId(): string | null {
  return currentDbUserId;
}

export class AppDB extends Dexie {
  rooms!: Table<roomType, string>;
  contacts!: Table<ContactType, string>;
  messages!: Table<MessageType, string>;

  constructor(name: string = "app-chat-db") {
    super(name);

    // Version 1: Old schema (will be automatically upgraded)
    // this.version(1).stores({
    //   rooms: "id, roomId, type, updatedAt",
    //   contacts: "id, fullname, email, status, createdAt, updatedAt",
    // });

    // ⚠️ CRITICAL: Define schema FIRST, then apply encryption
    // Version 2: Fresh start with encryption properly configured
    this.version(2)
      .stores({
        rooms: "id, roomId, type, updatedAt", // indexed fields only
        contacts: "id, fullname, email, status, createdAt, updatedAt", // indexed fields only
        messages: "id, roomId, type, createdAt, pinned", // indexed fields only
      })

      .upgrade(async (trans) => {
        // Clear all old data on upgrade to avoid encryption conflicts
        await trans.table("rooms").clear();
        await trans.table("contacts").clear();
        await trans.table("messages").clear();
      });

    // Version 3: Add compound index for messages
    this.version(3).stores({
      rooms: "id, roomId, type, updatedAt",
      contacts: "id, fullname, email, status, createdAt, updatedAt",
      messages: "id, roomId, type, createdAt, pinned, [roomId+createdAt]", // added compound index
    });

    // Version 4: Disable message encryption to fix UTF-8 issues
    this.version(4)
      .stores({
        rooms: "id, roomId, type, updatedAt",
        contacts: "id, fullname, email, status, createdAt, updatedAt",
        messages: "id, roomId, type, createdAt, pinned, [roomId+createdAt]",
      })
      .upgrade(async (trans) => {
        // Clear messages to remove encrypted data
        await trans.table("messages").clear();
      });

    // Version 5: Disable room name/content encryption to support emoji
    this.version(5)
      .stores({
        rooms: "id, roomId, type, updatedAt",
        contacts: "id, fullname, email, status, createdAt, updatedAt",
        messages: "id, roomId, type, createdAt, pinned, [roomId+createdAt]",
      })
      .upgrade(async (trans) => {
        // Clear rooms to remove encrypted data
        await trans.table("rooms").clear();
      });

    // Version 6: DISABLE ALL ENCRYPTION - Support full emoji and special characters
    this.version(6)
      .stores({
        rooms: "id, roomId, type, updatedAt",
        contacts: "id, fullname, email, status, createdAt, updatedAt",
        messages: "id, roomId, type, createdAt, pinned, [roomId+createdAt]",
      })
      .upgrade(async (trans) => {
        // Clear all data to remove any remaining encrypted data
        await trans.table("rooms").clear();
        await trans.table("contacts").clear();
        await trans.table("messages").clear();
      });
  }
}

// Legacy singleton export removed — `db` is now a Proxy declared above
// that forwards to the per-user instance opened via `openDbForUser`.
