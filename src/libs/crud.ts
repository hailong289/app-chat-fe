// crud.ts
import type { Table } from "dexie";

// === GENERIC HELPERS (dùng cho mọi Table có khóa kiểu number) ===

// Thêm 1 record (trả về id mới)
export async function insertOne<T extends { id?: number }>(
  table: Table<T, number>,
  data: Omit<T, "id"> | T
): Promise<number> {
  // add: chỉ thêm mới (fail nếu trùng khóa)
  return table.add(data as T);
}

// Thêm nhiều record (trả về danh sách id)
export async function insertMany<T extends { id?: number }>(
  table: Table<T, number>,
  items: Array<Omit<T, "id"> | T>
): Promise<number[]> {
  // bulkAdd nhanh hơn add nhiều lần
  return table.bulkAdd(items as T[], { allKeys: true }) as Promise<number[]>;
}

// Xóa 1 record theo id
export async function deleteOne<T>(
  table: Table<T, number>,
  id: number
): Promise<void> {
  await table.delete(id);
}

// Xóa nhiều record theo list id
export async function deleteMany<T>(
  table: Table<T, number>,
  ids: number[]
): Promise<void> {
  await table.bulkDelete(ids);
}

// Lấy tất cả record
export async function getAll<T>(table: Table<T, number>): Promise<T[]> {
  return table.toArray();
}

// Lấy 1 record theo id
export async function getOne<T>(
  table: Table<T, number>,
  id: number
): Promise<T | undefined> {
  return table.get(id);
}
