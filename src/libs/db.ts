import { room } from "@/store/types/room.state";
import Dexie, { Table } from "dexie";

export interface Table1 {
  id?: number;
  name: string;
  color: string;
}

export interface Table2 {
  id?: number;
  title: string;
  content: string;
}

export class AppDB extends Dexie {
  table1!: Table<Table1, number>;
  table2!: Table<Table2, number>;
  rooms!: Table<room, string>; // roomStore

  constructor() {
    super("app-chat-db");
    this.version(1).stores({
      // table1: "++id, name, color",    // table1
      // table2: "++id, title, content", // table2
      rooms: "++id, roomId, type, updatedAt,name,avatar,members", // roomStore
    });
  }
}

export const db = new AppDB();
