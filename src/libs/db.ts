import { ContactType } from "@/store/types/contact.type";
import { roomType } from "@/store/types/room.state";
import Dexie, { Table } from "dexie";
import { applyEncryptionMiddleware, ENCRYPT_LIST } from "dexie-encrypted";

export class AppDB extends Dexie {
  // table1!: Table<Table1, number>;
  // table2!: Table<Table2, number>;
  rooms!: Table<roomType, string>; // roomStore
  contacts!: Table<ContactType, string>; // contactStore

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
      })
      .upgrade(async (trans) => {
        // Clear all old data on upgrade to avoid encryption conflicts
        await trans.table("rooms").clear();
        await trans.table("contacts").clear();
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
        fields: ["name", "avatar", "members"], // encrypt non-indexed fields
      },
      contacts: {
        type: ENCRYPT_LIST,
        fields: ["avatar", "phone", "gender", "dateOfBirth"], // encrypt sensitive contact fields
      },
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
