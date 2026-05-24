import { useCallback, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { CartItem } from "@/types/cart-item"
import type { Order } from "@/types/order"
import { useCartStore } from "@/store/cartStore"
import { getSafeErrorMessage } from "@/lib/safe-error"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

type OrderStatusName = Pick<NonNullable<Order["order_status"]>, "status_name">
type OrderStatusRelation = OrderStatusName | OrderStatusName[] | null

type UseCreateOrderProps = {
  items: CartItem[]
  tableId: number
  restaurantId: number
}

function getOrderStatusName(orderStatus: OrderStatusRelation) {
  if (Array.isArray(orderStatus)) return orderStatus[0]?.status_name ?? null
  return orderStatus?.status_name ?? null
}

function getCreateOrderErrorMessage(err: unknown) {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "42501"
  ) {
    return "Supabase esta bloqueando la creacion del pedido por permisos."
  }

  return getSafeErrorMessage(err, "Error al crear el pedido, intenta de nuevo.", [])
}

export function useCreateOrder({ items, tableId, restaurantId }: UseCreateOrderProps) {
  const clearCart = useCartStore((state) => state.clear)
  const setLastOrder = useCartStore((state) => state.setLastOrder)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0)

  const { run: createOrderWithRetry, isPending } = useOfflineRetry(async () => {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        total,
        table_id: tableId,
        restaurant_id: restaurantId,
        status_id: 1,
      })
      .select("id, status_id, created_at, table_id, restaurant_id, total, order_status(status_name)")
      .single()

    if (error) throw error

    setLastOrder({
      id: data.id,
      statusId: data.status_id,
      statusName: getOrderStatusName(data.order_status) ?? "Nuevo",
      createdAt: data.created_at,
      tableId: data.table_id,
      restaurantId: data.restaurant_id,
      total: data.total,
    })
    clearCart()
  })

  async function createOrder() {
    if (!items.length) return
    if (!tableId || !restaurantId) {
      setError("No se pudo identificar la mesa del pedido.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await createOrderWithRetry()
    } catch (err) {
      if (isNetworkError(err)) return
      setError(getCreateOrderErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const resetOrderDraft = useCallback(() => {
    setError(null)
  }, [])

  return {
    isLoading: isLoading || isPending,
    isWaitingConnection: isPending,
    error,
    createOrder,
    resetOrderDraft,
  }
}
