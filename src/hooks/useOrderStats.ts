import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"

type OrderStats = {
  dailySales: number
  completedOrders: number
}

export function useOrderStats() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const todayKey = new Date().toISOString().slice(0, 10)

  const fetchStats = useCallback(async (): Promise<OrderStats> => {
    const { data, error } = await supabase
       .rpc("get_daily_order_stats", { restaurant_id_param: restaurantId })
       .single<{ daily_sales: number; completed_orders: number }>()

    if (error) throw error

    return {
      dailySales: Number(data?.daily_sales ?? 0),
      completedOrders: Number(data?.completed_orders ?? 0),
    }
  }, [restaurantId])

  const { data, isLoading, isPendingRetry, error } = useCache<OrderStats>(
    `order-stats-${restaurantId ?? "pending"}-${todayKey}`,
    fetchStats,
    { enabled: Boolean(restaurantId), revalidateOnMount: true }
  )

  if (error) {
    logger.error("Error cargando estadisticas", error)
  }

  return {
    dailySales: data?.dailySales ?? 0,
    completedOrders: data?.completedOrders ?? 0,
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar estadisticas" : ""),
  }
}