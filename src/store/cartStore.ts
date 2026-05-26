import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { LastOrderStore } from "@/types/cart-store"

export const useCartStore = create<LastOrderStore>()(
  persist(
    (set) => ({
      lastOrder: null,
      setLastOrder: (order) => set({ lastOrder: order }),
      clearLastOrder: () => set({ lastOrder: null }),
    }),
    { name: "cart" }
  )
)
