// crud.ts
import type { Table, UpdateSpec } from "dexie";

/**
 * T là dạng bản ghi có khóa chính id: string
 * Yêu cầu DB store: stores({ ...: "id, otherIndexes..." })
 */
export type WithStringId = { id: string };

/* =========================
 *      CREATE / INSERT
 * ========================= */

/** Thêm 1 record. YÊU CẦU có sẵn id:string trong data. Trả về id */
export async function insertOne<T extends WithStringId>(
  table: Table<T, string>,
  data: T
): Promise<string> {
  return table.add(data);
}

/** Thêm nhiều record. Trả về danh sách id */
export async function insertMany<T extends WithStringId>(
  table: Table<T, string>,
  items: T[]
): Promise<string[]> {
  return table.bulkAdd(items, { allKeys: true }) as Promise<string[]>;
}

/* =========================
 *        UPSERT / PUT
 * ========================= */

/** Upsert 1 record (có thì cập nhật, chưa có thì thêm). Trả về id */
export async function upsertOne<T extends WithStringId>(
  table: Table<T, string>,
  data: T
): Promise<string> {
  try {
    await table.put(data);
    return data.id;
  } catch (error: any) {
    // Log chi tiết lỗi để debug
    console.error("❌ Error in upsertOne:", {
      error: error.message,
      table: table.name,
      dataId: data.id,
      errorType: error.name,
    });

    // Nếu là lỗi UTF-8, thử sanitize và retry
    if (
      error.message?.includes("utf8") ||
      error.message?.includes("invalid string")
    ) {
      console.warn("⚠️ UTF-8 error detected, skipping problematic data");
      // Throw lại để caller có thể handle
      throw new Error(`UTF-8 encoding error: ${error.message}`);
    }

    throw error;
  }
}

/** Upsert nhiều record */
export async function upsertMany<T extends WithStringId>(
  table: Table<T, string>,
  items: T[]
): Promise<void> {
  try {
    await table.bulkPut(items);
  } catch (error: any) {
    // Log chi tiết lỗi để debug
    console.error("❌ Error in upsertMany:", {
      error: error.message || error.toString(),
      errorStack: error.stack,
      table: table.name,
      itemCount: items.length,
      errorType: error.name,
      fullError: error,
    });

    // Log sample data để debug
    if (items.length > 0) {
      console.log(
        "Sample item causing error:",
        JSON.stringify(items[0], null, 2)
      );
    }

    // Nếu là lỗi UTF-8, thử từng item một để tìm item lỗi
    if (
      error.message?.includes("utf8") ||
      error.message?.includes("invalid string")
    ) {
      console.warn(
        "⚠️ UTF-8 error in bulk operation, trying items individually..."
      );

      let successCount = 0;
      let errorCount = 0;

      for (const item of items) {
        try {
          await table.put(item);
          successCount++;
        } catch (itemError: any) {
          errorCount++;
          console.warn(`⚠️ Skipping item with ID: ${item.id}`, {
            error: itemError.message,
          });
        }
      }

      console.log(
        `✅ Bulk upsert completed: ${successCount} success, ${errorCount} skipped`
      );
      return;
    }

    throw error;
  }
}

/* =========================
 *         UPDATE
 * ========================= */

/** Patch 1 record theo id. Trả về số record bị ảnh hưởng (0 hoặc 1) */
export async function updateOne<T extends WithStringId>(
  table: Table<T, string>,
  id: string,
  patch: Partial<T>
): Promise<number> {
  return table.update(id, patch as UpdateSpec<T>);
}

/* =========================
 *       READ / QUERY
 * ========================= */

/** Lấy tất cả record */
export async function getAll<T extends WithStringId>(
  table: Table<T, string>
): Promise<T[]> {
  return table.toArray();
}

/** Lấy 1 record theo id */
export async function getOne<T extends WithStringId>(
  table: Table<T, string>,
  id: string
): Promise<T | undefined> {
  return table.get(id);
}

/** Kiểm tra tồn tại theo id */
export async function exists<T extends WithStringId>(
  table: Table<T, string>,
  id: string
): Promise<boolean> {
  const found = await table.get(id);
  return !!found;
}

/**
 * Lấy theo index (đã khai báo trong stores).
 * Ví dụ: stores({ rooms: "id, roomId, type, updatedAt" })
 */
export async function getByIndex<
  T extends WithStringId,
  K extends keyof T & string
>(table: Table<T, string>, index: K, value: T[K]): Promise<T[]> {
  return table
    .where(index)
    .equals(value as any)
    .toArray();
}

/* =========================
 *        DELETE
 * ========================= */

/** Xóa 1 record theo id */
export async function deleteOne<T extends WithStringId>(
  table: Table<T, string>,
  id: string
): Promise<void> {
  await table.delete(id);
}

/** Xóa nhiều record theo list id */
export async function deleteMany<T extends WithStringId>(
  table: Table<T, string>,
  ids: string[]
): Promise<void> {
  await table.bulkDelete(ids);
}

/** Xóa toàn bộ store (cẩn thận!) */
export async function clearAll<T extends WithStringId>(
  table: Table<T, string>
): Promise<void> {
  await table.clear();
}
