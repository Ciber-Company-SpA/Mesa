import { useCallback, useState } from "react"
import type { CartItem } from "@/types/cart-item"
import { useCartStore } from "@/store/cartStore"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { createOrderAction } from "@/app/actions/order-actions"
import type { CreateOrderItemInput } from "@/lib/validation/order"

type UseCreateOrderProps = {
  items: CartItem[]
  tableId: number
  restaurantId: number
}

export function useCreateOrder({ items, tableId, restaurantId }: UseCreateOrderProps) {
  const clearCart = useCartStore((state) => state.clear)
  const setLastOrder = useCartStore((state) => state.setLastOrder)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { run: createOrderWithRetry, isPending } = useOfflineRetry(async () => {
    // Mapear CartItem → CreateOrderItemInput
    const orderItems: CreateOrderItemInput[] = items.map((item) => ({
      productId: item.productId ?? item.id,
      productName: item.name,
      productPrice: item.price,
      productQuantity: item.quantity,
      notes: null,
    }))

    const result = await createOrderAction({
      tableId,
      restaurantId,
      items: orderItems,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    setLastOrder({
      id: result.data.id,
      statusId: result.data.statusId,
      statusName: result.data.statusName ?? "Nuevo",
      createdAt: result.data.createdAt,
      tableId: result.data.tableId,
      restaurantId: result.data.restaurantId,
      total: result.data.total,
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
      setError(err instanceof Error ? err.message : "Error al crear el pedido, intenta de nuevo.")
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