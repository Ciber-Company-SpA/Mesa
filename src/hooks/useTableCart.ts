import { useEffect } from "react"
import {
  useTableCartStore,
  subscribeToTableCart,
  unsubscribeFromTableCart,
} from "@/store/tableCartStore"

export function useTableCart(tableId: number | null, restaurantId: number | null) {
  const items = useTableCartStore((s) => s.items)
  const isLoading = useTableCartStore((s) => s.isLoading)
  const addItem = useTableCartStore((s) => s.addItem)
  const updateQuantity = useTableCartStore((s) => s.updateQuantity)
  const removeItem = useTableCartStore((s) => s.removeItem)
  const clear = useTableCartStore((s) => s.clear)
  const setTable = useTableCartStore((s) => s.setTable)
  const fetchItems = useTableCartStore((s) => s.fetchItems)

  useEffect(() => {
    if (!tableId || !restaurantId) return

    setTable(tableId, restaurantId, useTableCartStore.getState().qrCode)
    fetchItems()
    subscribeToTableCart(tableId)

    return () => {
      unsubscribeFromTableCart()
    }
  }, [tableId, restaurantId, setTable, fetchItems])

  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0)

  return { items, total, isLoading, addItem, updateQuantity, removeItem, clear }
}
