import { create } from "zustand";
import { CounterState } from "./types/count.state";
import { db } from "@/libs/db.";


export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increase: async () => {
    // Tạo dữ liệu mẫu local
    await db.table1.add({ name: "Hero", color: "Red" });
    await db.table2.add({ title: "Hero2", content: "Blue" });
    set((state) => ({ count: state.count + 1 }));
  },
  decrease: () => {
    set((state) => ({ count: state.count - 1 }));
  },
  getData: async () => {
    const allTable1 = await db.table1.toArray();
    const allTable2 = await db.table2.toArray();
    console.log("All Table1:", allTable1);
    console.log("All Table2:", allTable2);
  }
}));
