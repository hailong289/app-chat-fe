import { ContactType } from "@/store/types/contact.type";
import { MessageType } from "@/store/types/message.state";
import { roomType } from "@/store/types/room.state";
import Dexie, { Table } from "dexie";
import { applyEncryptionMiddleware, ENCRYPT_LIST } from "dexie-encrypted";

/**
 * Helper function to clear IndexedDB completely
 * Use this in browser console if you need to reset: clearIndexedDB()
 */
export const clearIndexedDB = async () => {
  try {
    await Dexie.delete("app-chat-db");
    console.log("✅ IndexedDB cleared successfully. Please refresh the page.");
    return true;
  } catch (error) {
    console.error("❌ Failed to clear IndexedDB:", error);
    return false;
  }
};

// Make it available globally for debugging
if (typeof window !== "undefined") {
  (window as any).clearIndexedDB = clearIndexedDB;
}

export class AppDB extends Dexie {
  // table1!: Table<Table1, number>;
  // table2!: Table<Table2, number>;
  rooms!: Table<roomType, string>; // roomStore
  contacts!: Table<ContactType, string>; // contactStore
  messages!: Table<MessageType, string>; // messageStore

  constructor() {
    super("app-chat-db");

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
        console.log("🔄 Cleared encrypted messages, will reload from API");
      });

    // Apply encryption AFTER schema is defined
    const rawKey =
      "1f0f48c72e7ba865b9cbc0a0b280b2d2af8d3f7f9befa7ecf34e318b3c9c12c7";
    const encoded = new TextEncoder().encode(rawKey);
    const keyBytes = new Uint8Array(32);
    keyBytes.set(encoded.slice(0, 32));

    const encryptionSettings: any = {
      rooms: {
        type: ENCRYPT_LIST,
        fields: ["name", "avatar"], // encrypt non-indexed string fields only, exclude complex objects like members
      },
      contacts: {
        type: ENCRYPT_LIST,
        fields: ["avatar", "phone", "gender", "dateOfBirth"], // encrypt sensitive contact fields
      },
      // Temporarily disable encryption for messages to debug UTF-8 issues
      // messages: {
      //   type: ENCRYPT_LIST,
      //   fields: ["content"], // Only encrypt content (string), exclude sender (object) and attachments (array)
      // },
    };

    applyEncryptionMiddleware(
      this,
      keyBytes,
      encryptionSettings,
      async () => {}
    );
  }
}

export const db = new AppDB();
