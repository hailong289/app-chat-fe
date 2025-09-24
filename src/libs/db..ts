import Dexie, { Table } from 'dexie';

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

  constructor() {
    super("app-chat-db");
    this.version(1).stores({
      table1: "++id, name, color",    // table1
      table2: "++id, title, content", // table2
    });
  }
}

export const db = new AppDB();
