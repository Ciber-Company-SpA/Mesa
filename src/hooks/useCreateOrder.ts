import { useCallback, useState } from "react"
import type { CartItem } from "@/types/cart-item"
import { useCartStore } from "@/store/cartStore"
import { useTableCartStore } from "@/store/tableCartStore"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { createOrderAction } from "@/app/actions/order-actions"
import type { CreateOrderItemInput } from "@/lib/validation/order"
import { getOrCreateDinerToken } from "@/lib/diner-token"

type UseCreateOrderProps = {
  items: CartItem[]
  tableId: number
  restaurantId: number
}

export function useCreateOrder({ items, tableId, restaurantId }: UseCreateOrderProps) {
  const clearCart = useTableCartStore((state) => state.clear)
  const setLastOrder = useCartStore((state) => state.setLastOrder)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { run: createOrderWithRetry, isPending } = useOfflineRetry(async () => {
    const orderItems: CreateOrderItemInput[] = items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      productQuantity: item.quantity,
      notes: item.notes ?? null,
    }))

    const dinerToken = getOrCreateDinerToken(tableId)

    const result = await createOrderAction({
      tableId,
      dinerToken,
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

    await clearCart()
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
      handleMutationError(err, {
        logTag: "Error creando pedido",
        fallback: "Error al crear el pedido, intenta de nuevo.",
        setError,
      })
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