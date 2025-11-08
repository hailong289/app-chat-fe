import { create } from "zustand";
import { CounterState } from "./types/count.state";
import { createJSONStorage, persist } from "zustand/middleware";
// import { db } from "@/libs/db";

const useCounterStore = create<CounterState>()(
  persist(
    (set) => ({
      count: 0,
      isToggled: true,
      setToggleState: (value: boolean) => set({ isToggled: value }),
      tab: "home",
      setTab: (tab: string) => set({ tab }),
    }),

    {
      name: "counter-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, the storage is sessionStorage
    }
  )
);
export default useCounterStore;
