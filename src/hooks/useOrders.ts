import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Order } from "@/types/order"

export function useOrders({ limit = 30 }: { limit?: number } = {}) {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const fetchOrders = useCallback(async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, table_id, total, status_id, created_at, order_status(status_name), tables(table_number), order_qr_codes(qr_code, qr_active)")
      .eq("restaurant_id", restaurantId)
      .in("status_id", [1, 2, 3])
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data ?? []) as unknown as Order[]
  }, [limit, restaurantId])

  const { data, isLoading, isPendingRetry, error } = useCache<Order[]>(
    `orders-${restaurantId ?? "pending"}-${limit}`,
    fetchOrders,
    { enabled: Boolean(restaurantId), revalidateOnMount: true }
  )

  if (error) {
    logger.error("Error cargando pedidos", error)
  }

  return {
    orders: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar pedidos" : ""),
  }
}
